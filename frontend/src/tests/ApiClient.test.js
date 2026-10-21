import { afterEach, expect, test, vi } from 'vitest'
import { apiFetch, apiFetchJson } from '../config'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const pendingFetch = (_, { signal }) => new Promise((_, reject) => {
  if (signal.aborted) reject(signal.reason)
  else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
})
test('cookie mutations send the request protection header without legacy bearer tokens', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetch)
  await apiFetch('/api/auth/profile', { method: 'PUT', headers: { Authorization: 'Bearer old-token', 'Content-Type': 'application/json' }, body: '{}' })
  const init = fetch.mock.calls[0][1]
  expect(init.credentials).toBe('include')
  expect(init.headers.get('Authorization')).toBeNull()
  expect(init.headers.get('X-MedNexus-Request')).toBe('1')
  expect(init.headers.get('Content-Type')).toBe('application/json')
})
test('reads preserve request options and leave the global fetch function unchanged', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetch)
  await apiFetch('/api/doctors', { cache: 'no-store' })
  expect(globalThis.fetch).toBe(fetch)
  expect(fetch.mock.calls[0][1].cache).toBe('no-store')
  expect(fetch.mock.calls[0][1].headers.get('X-MedNexus-Request')).toBeNull()
})

test('retries a temporary gateway failure for doctor reads', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn()
    .mockResolvedValueOnce({ status: 502 })
    .mockResolvedValueOnce({ status: 200, ok: true })
  vi.stubGlobal('fetch', fetch)

  const request = apiFetch('/api/doctors')
  await vi.advanceTimersByTimeAsync(2000)

  expect((await request).ok).toBe(true)
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('does not replay a failed mutation', async () => {
  const fetch = vi.fn().mockResolvedValue({ status: 502 })
  vi.stubGlobal('fetch', fetch)

  expect((await apiFetch('/api/appointments', { method: 'POST' })).status).toBe(502)
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('stops waiting for an unresponsive API', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn(pendingFetch)
  vi.stubGlobal('fetch', fetch)

  const request = apiFetch('/api/doctors')
  const result = expect(request).rejects.toMatchObject({
    message: 'The server is taking too long to respond',
    name: 'TimeoutError',
    code: 'API_TIMEOUT',
  })
  await vi.advanceTimersByTimeAsync(89999)
  expect(fetch).toHaveBeenCalledTimes(5)
  expect(fetch.mock.calls.at(-1)[1].signal.aborted).toBe(false)
  await vi.advanceTimersByTimeAsync(1)

  await result
  expect(fetch.mock.calls.every(([, { signal }]) => signal.aborted)).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

test('recovers from a stalled read before the overall deadline', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn()
    .mockImplementationOnce(pendingFetch)
    .mockResolvedValueOnce({ status: 200, ok: true })
  vi.stubGlobal('fetch', fetch)

  const request = apiFetch('/api/doctors')
  await vi.advanceTimersByTimeAsync(15000)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
  await vi.advanceTimersByTimeAsync(2000)

  expect((await request).ok).toBe(true)
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(vi.getTimerCount()).toBe(0)
  await vi.advanceTimersByTimeAsync(90000)
  expect(fetch.mock.calls[1][1].signal.aborted).toBe(false)
})

test('retries network failures on HEAD requests', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({ status: 200 })
  vi.stubGlobal('fetch', fetch)

  const request = apiFetch('/api/health', { method: 'HEAD' })
  await vi.advanceTimersByTimeAsync(2000)

  expect((await request).status).toBe(200)
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(vi.getTimerCount()).toBe(0)
})

test.each([400, 401, 403, 404, 429])('does not retry terminal HTTP %s responses', async (status) => {
  vi.useFakeTimers()
  const fetch = vi.fn().mockResolvedValue({ status })
  vi.stubGlobal('fetch', fetch)

  expect((await apiFetch('/api/doctors')).status).toBe(status)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

test('does not retry errors unrelated to the network', async () => {
  vi.useFakeTimers()
  const error = new Error('Unexpected implementation error')
  const fetch = vi.fn().mockRejectedValue(error)
  vi.stubGlobal('fetch', fetch)

  await expect(apiFetch('/api/doctors')).rejects.toBe(error)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

test.each(['POST', 'PUT', 'PATCH', 'DELETE'])('does not replay a %s after a network failure', async (method) => {
  vi.useFakeTimers()
  const error = new TypeError('Failed to fetch')
  const fetch = vi.fn().mockRejectedValue(error)
  vi.stubGlobal('fetch', fetch)

  await expect(apiFetch('/api/appointments', { method })).rejects.toBe(error)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

test('cancels an active attempt immediately when the caller aborts', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
  const fetch = vi.fn(pendingFetch)
  vi.stubGlobal('fetch', fetch)
  const reason = new Error('Navigation cancelled')

  const request = apiFetch('/api/doctors', { signal: controller.signal })
  const result = expect(request).rejects.toBe(reason)
  controller.abort(reason)

  await result
  expect(fetch.mock.calls[0][1].signal.reason).toBe(reason)
  expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
  expect(vi.getTimerCount()).toBe(0)
  await vi.advanceTimersByTimeAsync(90000)
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('cancels during retry backoff without making another request', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const fetch = vi.fn().mockResolvedValue({ status: 503 })
  vi.stubGlobal('fetch', fetch)
  const reason = new Error('Navigation cancelled')

  const request = apiFetch('/api/doctors', { signal: controller.signal })
  const result = expect(request).rejects.toBe(reason)
  await vi.advanceTimersByTimeAsync(1000)
  controller.abort(reason)

  await result
  expect(vi.getTimerCount()).toBe(0)
  await vi.advanceTimersByTimeAsync(90000)
  expect(fetch).toHaveBeenCalledTimes(1)
})

test.each(['GET', 'POST'])('does not start a pre-aborted %s request', async (method) => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const reason = new Error('Already cancelled')
  controller.abort(reason)
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)

  await expect(apiFetch('/api/doctors', { method, signal: controller.signal })).rejects.toBe(reason)
  expect(fetch).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

test('removes the caller abort listener after a successful read', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const addListener = vi.spyOn(controller.signal, 'addEventListener')
  const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
  const fetch = vi.fn().mockResolvedValue({ status: 200 })
  vi.stubGlobal('fetch', fetch)

  await apiFetch('/api/doctors', { signal: controller.signal })

  const listener = addListener.mock.calls[0][1]
  expect(removeListener).toHaveBeenCalledWith('abort', listener)
  expect(vi.getTimerCount()).toBe(0)
  controller.abort()
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(false)
})

test('does not retry arbitrary third-party URLs', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn().mockResolvedValue({ status: 503 })
  vi.stubGlobal('fetch', fetch)

  expect((await apiFetch('https://example.com/api/doctors')).status).toBe(503)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

test('bounds retries when the API keeps returning gateway errors', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn().mockResolvedValue({ status: 504 })
  vi.stubGlobal('fetch', fetch)

  const request = apiFetch('/api/doctors')
  await vi.advanceTimersByTimeAsync(60000)

  expect((await request).status).toBe(504)
  expect(fetch).toHaveBeenCalledTimes(9)
  expect(vi.getTimerCount()).toBe(0)
})

test('JSON reads retry a stalled body and return the recovered payload', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn()
    .mockResolvedValueOnce({ status: 200, ok: true, json: () => new Promise(() => {}) })
    .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ doctors: [] }) })
  vi.stubGlobal('fetch', fetch)

  const request = apiFetchJson('/api/doctors')
  await vi.advanceTimersByTimeAsync(15000)
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
  await vi.advanceTimersByTimeAsync(2000)

  expect(await request).toEqual({ doctors: [] })
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(vi.getTimerCount()).toBe(0)
})

test('JSON reads retain the overall deadline while consuming response bodies', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => new Promise(() => {}) })
  vi.stubGlobal('fetch', fetch)

  const request = apiFetchJson('/api/doctors')
  const result = expect(request).rejects.toMatchObject({
    code: 'API_TIMEOUT',
    message: 'The server is taking too long to respond',
  })
  await vi.advanceTimersByTimeAsync(90000)

  await result
  expect(fetch).toHaveBeenCalledTimes(5)
  expect(fetch.mock.calls.every(([, { signal }]) => signal.aborted)).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

test('caller cancellation stays active after JSON response headers arrive', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const json = vi.fn(() => new Promise(() => {}))
  const fetch = vi.fn().mockResolvedValue({ status: 200, ok: true, json })
  vi.stubGlobal('fetch', fetch)
  const reason = new Error('Page closed while reading the response')

  const request = apiFetchJson('/api/doctors', { signal: controller.signal })
  const result = expect(request).rejects.toBe(reason)
  await vi.advanceTimersByTimeAsync(0)
  expect(json).toHaveBeenCalledTimes(1)
  controller.abort(reason)

  await result
  expect(fetch.mock.calls[0][1].signal.reason).toBe(reason)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

test('JSON reads throw safe HTTP errors and do not retry a bad request', async () => {
  vi.useFakeTimers()
  const json = vi.fn().mockResolvedValue({ message: 'Internal server details' })
  const fetch = vi.fn().mockResolvedValue({ status: 400, ok: false, json })
  vi.stubGlobal('fetch', fetch)

  await expect(apiFetchJson('/api/doctors')).rejects.toMatchObject({
    code: 'API_HTTP_ERROR',
    status: 400,
    message: 'The request could not be completed',
  })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(json).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

test('JSON reads recover from transient HTTP responses without reading their bodies', async () => {
  vi.useFakeTimers()
  const failedJson = vi.fn()
  const fetch = vi.fn()
    .mockResolvedValueOnce({ status: 503, ok: false, json: failedJson })
    .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ['recovered'] })
  vi.stubGlobal('fetch', fetch)

  const request = apiFetchJson('/api/doctors')
  await vi.advanceTimersByTimeAsync(2000)

  expect(await request).toEqual(['recovered'])
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(failedJson).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

test.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])('JSON helper rejects %s without sending a request', async (method) => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)

  await expect(apiFetchJson('/api/appointments', { method })).rejects.toThrow('JSON reads only support GET and HEAD')
  expect(fetch).not.toHaveBeenCalled()
})

test('successful JSON HEAD requests return null without parsing a body', async () => {
  const json = vi.fn()
  const fetch = vi.fn().mockResolvedValue({ status: 200, ok: true, json })
  vi.stubGlobal('fetch', fetch)

  expect(await apiFetchJson('/api/ready', { method: 'HEAD' })).toBeNull()
  expect(json).not.toHaveBeenCalled()
})

test('JSON parsing errors are not retried', async () => {
  vi.useFakeTimers()
  const error = new SyntaxError('Unexpected token')
  const fetch = vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => { throw error } })
  vi.stubGlobal('fetch', fetch)

  await expect(apiFetchJson('/api/doctors')).rejects.toBe(error)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

test('absolute JSON reads have a bounded body read without retrying third-party services', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => new Promise(() => {}) })
  vi.stubGlobal('fetch', fetch)

  const request = apiFetchJson('https://example.com/api/doctors')
  const result = expect(request).rejects.toMatchObject({ code: 'API_TIMEOUT' })
  await vi.advanceTimersByTimeAsync(15000)

  await result
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

test('completed JSON reads clear deadlines and detach caller cancellation', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
  const fetch = vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ doctors: [] }) })
  vi.stubGlobal('fetch', fetch)

  await apiFetchJson('/api/doctors', { signal: controller.signal, headers: { Authorization: 'Bearer old-token' } })
  expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
  expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBeNull()
  expect(fetch.mock.calls[0][1].credentials).toBe('include')
  expect(vi.getTimerCount()).toBe(0)
  controller.abort()
  await vi.advanceTimersByTimeAsync(90000)
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(false)
})
