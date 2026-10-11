import { afterEach, expect, test, vi } from 'vitest'
import { apiFetch } from '../config'

afterEach(() => vi.unstubAllGlobals())
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
