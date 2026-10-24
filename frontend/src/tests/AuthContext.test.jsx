import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { apiFetch } from '../config'

const fetchMock = vi.fn()
globalThis.fetch = fetchMock

function Harness() {
  const auth = useAuth()
  return (
    <div>
      <span data-testid="state">{auth.loading ? 'loading' : auth.user?.role || auth.error || 'signed-out'}</span>
      <button onClick={async () => { try { await auth.login('admin@example.test', 'secret') } catch (error) { void error } }}>login</button>
      <button onClick={async () => { try { await auth.register('New User', 'new@example.test', 'password', 'patient') } catch (error) { void error } }}>register</button>
      <button onClick={() => auth.logout()}>logout</button>
      <button onClick={() => apiFetch('/api/appointments/my')}>load protected data</button>
    </div>
  )
}

beforeEach(() => {
  fetchMock.mockReset()
})

test('a delayed signed-out response cannot clear a newer successful login', async () => {
  let resolveOldSession
  fetchMock.mockReturnValueOnce(new Promise(resolve => { resolveOldSession = resolve }))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { role: 'admin' } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { role: 'admin' } }) })
  render(<AuthProvider><Harness /></AuthProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'login' }))
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('admin'))
  await act(async () => resolveOldSession(new Response(JSON.stringify({ code: 'AUTH_SESSION_INVALID' }), { status: 401 })))
  expect(screen.getByTestId('state')).toHaveTextContent('admin')
})

test('loads the current user and logs out through the cookie API', async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ user: { role: 'admin' } }) })
    .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) })

  render(<AuthProvider><Harness /></AuthProvider>)
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('admin'))
  fireEvent.click(screen.getByRole('button', { name: 'logout' }))
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('signed-out'))
  expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }))
})

test('exposes login errors without leaking a response payload', async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: false, json: vi.fn().mockResolvedValue({}) })
    .mockResolvedValueOnce({ ok: false, json: vi.fn().mockResolvedValue({ message: 'Invalid credentials' }) })
  render(<AuthProvider><Harness /></AuthProvider>)
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('signed-out'))
  fireEvent.click(screen.getByRole('button', { name: 'login' }))
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('Invalid credentials'))
  expect(screen.getByTestId('state')).not.toHaveTextContent('password')
})

test('registers a user and refreshes the current session', async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: false, json: vi.fn().mockResolvedValue({}) })
    .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ user: { role: 'patient' } }) })
    .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ user: { role: 'patient' } }) })
  render(<AuthProvider><Harness /></AuthProvider>)
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('signed-out'))
  fireEvent.click(screen.getByRole('button', { name: 'register' }))
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('patient'))
})

test('clears a cached identity when the API reports an expired or revoked session', async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { role: 'patient' } }) })
    .mockResolvedValueOnce({ ok: false, status: 401, clone: () => ({ json: async () => ({ code: 'AUTH_SESSION_INVALID' }) }) })
  render(<AuthProvider><Harness /></AuthProvider>)
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('patient'))
  fireEvent.click(screen.getByRole('button', { name: 'load protected data' }))
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('signed-out'))
})

test('a rejected login attempt does not silently discard the existing session', async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { role: 'patient' } }) })
    .mockResolvedValueOnce({ ok: false, status: 401, clone: () => ({ json: async () => ({ message: 'Invalid credentials' }) }), json: async () => ({ message: 'Invalid credentials' }) })
  render(<AuthProvider><Harness /></AuthProvider>)
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('patient'))
  fireEvent.click(screen.getByRole('button', { name: 'login' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(screen.getByTestId('state')).toHaveTextContent('patient')
})
