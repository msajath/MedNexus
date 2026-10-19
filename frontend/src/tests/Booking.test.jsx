import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import DoctorProfile from '../pages/DoctorProfile'
import BookAppointment from '../pages/BookAppointment'
import { apiFetch } from '../config'
import { bookingDateKey, getBookingDays } from '../utils/bookingDates'

vi.mock('../config', () => ({ API_BASE: '', apiFetch: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }))
vi.mock('../components/Navbar', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))
vi.mock('../assets/assets', () => ({ assets: { profile_pic: '/doctor.png' } }))
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'doctor-1' }),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}))

const doctor = { _id: 'doctor-1', name: 'Dr. Test Doctor', specialty: 'Cardiology', fee: 50, available: true }
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })
const slotsResponse = (slots = { morning: ['09:00'], afternoon: [], evening: [] }, bookedSlots = []) => response({
  success: true, slots, bookedSlots,
  unavailableSlots: { morning: ['08:00'], afternoon: [], evening: [] },
})
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const dateButtons = () => screen.getAllByRole('button', { name: /^(mon|tue|wed|thu|fri)\s*\d/i })
const appointmentCalls = () => apiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-19T04:00:00Z'))
  apiFetch.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe.each([
  { name: 'doctor profile', Component: DoctorProfile, autoLoads: true, count: 7, confirm: 'Book an appointment' },
  { name: 'booking page', Component: BookAppointment, autoLoads: false, count: 10, confirm: 'Confirm Booking' },
])('$name', ({ Component, autoLoads, count, confirm }) => {
  async function openPage() {
    render(<Component />)
    await screen.findByRole('heading', { name: /Dr\. Test Doctor/ })
    if (!autoLoads) fireEvent.click(dateButtons()[0])
  }

  test('offers only weekdays and prevents duplicate booking submissions', async () => {
    const booking = deferred()
    apiFetch.mockImplementation((url, options) => {
      if (options?.method === 'POST') return booking.promise
      return Promise.resolve(url.includes('/availability/') ? slotsResponse() : response({ doctor }))
    })

    await openPage()
    expect(dateButtons()).toHaveLength(count)
    expect(screen.queryByRole('button', { name: /^(sat|sun)\s*\d/i })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: '09:00' }))
    const submit = screen.getByRole('button', { name: confirm })
    act(() => {
      fireEvent.click(submit)
      fireEvent.click(submit)
    })
    expect(appointmentCalls()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Booking...' })).toBeDisabled()
    expect(JSON.parse(appointmentCalls()[0][1].body)).toEqual({
      doctorId: doctor._id, date: '2026-10-19', time: '09:00',
    })

    await act(async () => { booking.resolve(response({ success: true })) })
    expect(await screen.findByRole('heading', { name: 'Appointment Booked!' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(appointmentCalls()).toHaveLength(1)
  })

  test('keeps the selected day slots when an older request finishes last', async () => {
    const oldDay = deferred()
    let slotRequests = 0
    apiFetch.mockImplementation(url => {
      if (!url.includes('/availability/')) return Promise.resolve(response({ doctor }))
      slotRequests++
      return slotRequests === 1 ? oldDay.promise : Promise.resolve(slotsResponse({ morning: ['10:00'], afternoon: [], evening: [] }))
    })

    await openPage()
    fireEvent.click(dateButtons()[1])
    expect(await screen.findByRole('button', { name: '10:00' })).toBeInTheDocument()
    await act(async () => { oldDay.resolve(slotsResponse()) })
    expect(screen.queryByRole('button', { name: '09:00' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '10:00' })).toBeEnabled()
  })

  test('shows a retry action when the availability API fails', async () => {
    let slotRequests = 0
    apiFetch.mockImplementation(url => {
      if (!url.includes('/availability/')) return Promise.resolve(response({ doctor }))
      return Promise.resolve(++slotRequests === 1
        ? response({ message: 'Booking times are temporarily unavailable.' }, 503)
        : slotsResponse())
    })

    await openPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Booking times are temporarily unavailable.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: '09:00' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('refreshes a newly booked slot and shows the conflict without a success screen', async () => {
    let slotRequests = 0
    apiFetch.mockImplementation((url, options) => {
      if (options?.method === 'POST') return Promise.resolve(response({ message: 'This time slot is already booked' }, 409))
      if (!url.includes('/availability/')) return Promise.resolve(response({ doctor }))
      return Promise.resolve(slotsResponse(undefined, ++slotRequests > 1 ? ['09:00'] : []))
    })

    await openPage()
    fireEvent.click(await screen.findByRole('button', { name: '09:00' }))
    fireEvent.click(screen.getByRole('button', { name: confirm }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This time slot is already booked')
    expect(screen.queryByRole('heading', { name: 'Appointment Booked!' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '09:00' })).toBeDisabled())
    expect(screen.getByRole('button', { name: confirm })).toBeDisabled()
  })
})

test('automatically shows afternoon appointments for a doctor without morning availability', async () => {
  apiFetch.mockImplementation(url => Promise.resolve(url.includes('/availability/')
    ? slotsResponse({ morning: [], afternoon: ['14:00', '14:30'], evening: [] })
    : response({ doctor })))
  render(<BookAppointment />)
  await screen.findByRole('heading', { name: doctor.name })
  fireEvent.click(dateButtons()[0])
  expect(await screen.findByRole('button', { name: '14:00' })).toBeEnabled()
  expect(screen.getByRole('button', { name: '14:30' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: '08:00' })).not.toBeInTheDocument()
})

test('uses the clinic calendar across UTC midnight and skips the whole weekend', () => {
  const days = getBookingDays(3, new Date('2026-10-23T23:00:00Z'))
  expect(days.map(bookingDateKey)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28'])
})
