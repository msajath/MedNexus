import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import HomePage from '../pages/HomePage'
import { apiFetchJson as apiFetch } from '../config'

vi.mock('../config', () => ({ API_BASE: '', apiFetchJson: vi.fn() }))
vi.mock('../components/Navbar', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))
vi.mock('../components/DoctorCard', () => ({
  default: ({ doctor }) => <article aria-label={doctor.name}>{doctor.name}</article>,
}))
vi.mock('framer-motion', async () => {
  const { createElement } = await import('react')
  const animationProps = new Set(['variants', 'initial', 'animate', 'exit', 'transition', 'whileInView', 'viewport'])
  const element = tag => props => createElement(tag, Object.fromEntries(
    Object.entries(props).filter(([key]) => !animationProps.has(key)),
  ))
  return { motion: Object.fromEntries(['div', 'h1', 'p', 'img'].map(tag => [tag, element(tag)])) }
})

const doctors = Array.from({ length: 6 }, (_, index) => ({ id: `doctor-${index}`, name: `Dr. ${index}` }))
const response = payload => payload
const renderPage = () => render(<MemoryRouter><HomePage /></MemoryRouter>)

beforeEach(() => {
  apiFetch.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test('shows a loading status while fetching doctors', () => {
  apiFetch.mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.getByRole('status')).toHaveTextContent(/loading doctors/i)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test.each([
  ['an envelope', { doctors }],
  ['a bare array', doctors],
])('renders the first four doctors from %s', async (_, payload) => {
  apiFetch.mockResolvedValue(response(payload))
  renderPage()
  expect(await screen.findAllByRole('article')).toHaveLength(4)
  expect(screen.getByRole('article', { name: 'Dr. 0' })).toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Dr. 3' })).toBeInTheDocument()
  expect(screen.queryByRole('article', { name: 'Dr. 4' })).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('explains when no doctors are available', async () => {
  apiFetch.mockResolvedValue(response({ doctors: [] }))
  renderPage()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/no doctors are available right now/i))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
})

test.each([
  ['an unsuccessful response', () => Promise.reject(Object.assign(new Error('Service failed'), { status: 500 }))],
  ['a malformed doctor list', () => Promise.resolve(response({ doctors: 'invalid' }))],
])('offers retry after %s and recovers', async (_, failure) => {
  apiFetch.mockImplementationOnce(failure).mockResolvedValueOnce(response({ doctors: [doctors[0]] }))
  renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load the doctors.*try again/i)
  fireEvent.click(screen.getByRole('button', { name: /try again/i }))
  expect(await screen.findByRole('article', { name: 'Dr. 0' })).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test.each([
  ['a temporary gateway failure', () => Promise.reject(Object.assign(new Error('Service unavailable'), { status: 503 }))],
  ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
])('automatically recovers the homepage after %s', async (_, failure) => {
  vi.useFakeTimers()
  apiFetch.mockImplementationOnce(failure).mockResolvedValueOnce(response({ doctors }))
  renderPage()
  await act(async () => {})
  expect(screen.getByRole('status')).toHaveTextContent(/temporarily unavailable.*reconnect/i)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
  expect(screen.getAllByRole('article')).toHaveLength(4)
  expect(apiFetch).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('cancels the doctor request when leaving the homepage', () => {
  apiFetch.mockReturnValue(new Promise(() => {}))
  const { unmount } = renderPage()
  const [url, options] = apiFetch.mock.calls[0]
  expect(url).toBe('/api/doctors')
  expect(options.signal).toBeInstanceOf(AbortSignal)
  expect(options.signal.aborted).toBe(false)
  unmount()
  expect(options.signal.aborted).toBe(true)
})
