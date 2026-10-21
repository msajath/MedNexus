import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import DoctorListing from '../pages/DoctorListing'
import useDoctors from '../hooks/useDoctors'
import { apiFetchJson as apiFetch } from '../config'

vi.mock('../config', () => ({ API_BASE: '', apiFetchJson: vi.fn() }))
vi.mock('../components/Navbar', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))
vi.mock('../components/DoctorCard', () => ({
  default: ({ doctor }) => <article aria-label={doctor.name}>{doctor.name}</article>,
}))

const doctors = [
  { _id: 'doctor-1', name: 'Dr. Archer', specialty: 'General Practice', location: 'Colombo' },
  { id: 'doctor-2', name: 'Dr. Bailey', specialty: 'Dermatologist', location: 'Kandy' },
]
const httpFailure = status => Object.assign(new Error('Doctor service request failed'), { status, code: 'API_HTTP_ERROR' })
const renderPage = (path = '/doctors') => render(<MemoryRouter initialEntries={[path]}><DoctorListing /></MemoryRouter>)
const settle = () => act(async () => {})
const advanceRecovery = () => act(async () => { await vi.advanceTimersByTimeAsync(15000) })

beforeEach(() => {
  apiFetch.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test('shows one loading status while a request is pending', () => {
  apiFetch.mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.getAllByRole('status')).toHaveLength(1)
  expect(screen.getByRole('status')).toHaveTextContent(/loading doctors/i)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test.each([
  ['an envelope', { doctors }],
  ['a bare array', doctors],
])('supports searching and filtering %s with MongoDB or public IDs', async (_, payload) => {
  apiFetch.mockResolvedValue(payload)
  renderPage()
  expect(await screen.findAllByRole('article')).toHaveLength(2)
  fireEvent.change(screen.getByRole('combobox', { name: 'Location' }), { target: { value: 'Kandy' } })
  expect(screen.getByRole('article', { name: 'Dr. Bailey' })).toBeInTheDocument()
  expect(screen.queryByRole('article', { name: 'Dr. Archer' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search doctors' }), { target: { value: 'Archer' } })
  expect(screen.getByText(/no doctors found matching your criteria/i)).toBeInTheDocument()
})

test.each([
  ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
  ['a timeout', () => Promise.reject(Object.assign(new Error('Internal API timeout details'), { name: 'TimeoutError', code: 'API_TIMEOUT' }))],
  ['a gateway error', () => Promise.reject(httpFailure(503))],
])('automatically recovers from %s and keeps the selected specialty and search', async (_, failure) => {
  vi.useFakeTimers()
  apiFetch.mockImplementationOnce(failure).mockResolvedValueOnce({ doctors })
  renderPage('/doctors?specialty=General%20Practice')
  await settle()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search doctors' }), { target: { value: 'Archer' } })
  expect(screen.getByRole('status')).toHaveTextContent(/temporarily unavailable.*reconnect/i)
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await advanceRecovery()
  expect(apiFetch).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('article', { name: 'Dr. Archer' })).toBeInTheDocument()
  expect(screen.queryByRole('article', { name: 'Dr. Bailey' })).not.toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Specialty' })).toHaveValue('General Practice')
  expect(screen.getByRole('searchbox', { name: 'Search doctors' })).toHaveValue('Archer')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('bounds automatic recovery, shows one calm notice and allows a fresh manual retry', async () => {
  vi.useFakeTimers()
  apiFetch.mockRejectedValue(httpFailure(502))
  renderPage()
  await settle()
  await advanceRecovery()
  expect(apiFetch).toHaveBeenCalledTimes(2)
  expect(screen.getAllByRole('alert')).toHaveLength(1)
  expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t load the doctors right now/i)
  expect(screen.queryByText(/error loading doctors|failed to fetch|502/i)).not.toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
  expect(apiFetch).toHaveBeenCalledTimes(2)
  apiFetch.mockResolvedValueOnce({ doctors })
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await settle()
  expect(screen.getAllByRole('article')).toHaveLength(2)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('lets the user retry immediately and cancels the previous scheduled check', async () => {
  vi.useFakeTimers()
  apiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ doctors })
  renderPage()
  await settle()
  const previousSignal = apiFetch.mock.calls[0][1].signal
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await settle()
  expect(previousSignal.aborted).toBe(true)
  expect(screen.getAllByRole('article')).toHaveLength(2)
  await advanceRecovery()
  expect(apiFetch).toHaveBeenCalledTimes(2)
})

test.each([
  ['a malformed envelope', { doctors: 'invalid' }],
  ['an invalid doctor entry', { doctors: [null] }],
  ['a non-transient HTTP failure', httpFailure(404)],
])('does not automatically retry %s', async (_, result) => {
  vi.useFakeTimers()
  if (result instanceof Error) apiFetch.mockRejectedValue(result)
  else apiFetch.mockResolvedValue(result)
  renderPage()
  await settle()
  expect(screen.getByRole('alert')).toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
  expect(apiFetch).toHaveBeenCalledTimes(1)
})

test('keeps the successful list visible while a refresh reconnects', async () => {
  vi.useFakeTimers()
  apiFetch.mockResolvedValueOnce({ doctors }).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  const { result } = renderHook(() => useDoctors())
  await settle()
  expect(result.current.doctors).toEqual(doctors)
  act(() => result.current.retry())
  await settle()
  expect(result.current.doctors).toEqual(doctors)
  expect(result.current.retrying).toBe(true)
  expect(result.current.error).toBeNull()
})

test('aborts the pending doctor request when leaving the page', () => {
  apiFetch.mockReturnValue(new Promise(() => {}))
  const { unmount } = renderPage()
  const [url, options] = apiFetch.mock.calls[0]
  expect(url).toBe('/api/doctors')
  expect(options.signal.aborted).toBe(false)
  unmount()
  expect(options.signal.aborted).toBe(true)
})

test('cleans up scheduled recovery when leaving the page', async () => {
  vi.useFakeTimers()
  apiFetch.mockRejectedValue(new TypeError('Failed to fetch'))
  const { unmount } = renderPage()
  await settle()
  expect(screen.getByRole('status')).toHaveTextContent(/reconnect/i)
  unmount()
  await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
  expect(apiFetch).toHaveBeenCalledTimes(1)
})
