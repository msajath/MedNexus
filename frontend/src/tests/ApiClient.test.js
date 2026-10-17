import { afterEach, expect, test, vi } from 'vitest'
import { apiFetch } from '../config'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
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
