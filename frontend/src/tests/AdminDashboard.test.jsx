import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import AdminDashboard from '../pages/AdminDashboard'
import { apiFetch } from '../config'

vi.mock('../config', () => ({ API_BASE: '', apiFetch: vi.fn() }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))
const response = (data, ok = true) => ({ ok, json: async () => data })

beforeEach(() => { apiFetch.mockReset() })
afterEach(cleanup)

test('shows operational counts and receipt-based net earnings for every doctor', async () => {
  apiFetch.mockImplementation(async url => {
    if (url.endsWith('/ready')) return response({})
    if (url.endsWith('/recent-activity')) return response({ activity: [] })
    if (url.endsWith('/earnings')) return response({ earnings: { receivedAmount: 150, refundedAmount: 25, netReceived: 125, receivedPayments: 2, basis: 'recorded_payments' }, doctors: [
      { doctorId: 'one', name: 'Dr. Ada', specialty: 'Cardiology', completedAppointments: 2, receivedAmount: 150, refundedAmount: 25, netReceived: 125, receivedPayments: 2 },
      { doctorId: 'two', name: 'Dr. Zero', specialty: 'Neurology', completedAppointments: 10, receivedAmount: 0, refundedAmount: 0, netReceived: 0, receivedPayments: 0, isActive: false },
    ] })
    return response({ stats: { totalDoctors: '2', totalPatients: '50', monthlyAppointments: '25', pendingApprovals: '0' }, appointmentSummary: { total: 8, pending: 1, confirmed: 2, completed: 3, cancelled: 2, rescheduled: 1 } })
  })
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
  expect(await screen.findByText('Dr. Zero')).toBeInTheDocument()
  const summary = screen.getByRole('region', { name: 'Appointment Summary' })
  expect(within(summary).getByText('8')).toBeInTheDocument()
  expect(within(summary).getByText(/^rescheduled$/i)).toBeInTheDocument()
  expect(within(summary).getByText(/also counted under their current status/i)).toBeInTheDocument()
  const row = screen.getByRole('row', { name: /Dr. Ada/ })
  expect(within(row).getByText('$125.00')).toBeInTheDocument()
  expect(within(row).getByText('$150.00')).toBeInTheDocument()
  expect(within(row).getByText('$25.00')).toBeInTheDocument()
  expect(screen.getByText(/historical consultation fees do not count as payment/i)).toBeInTheDocument()
  expect(screen.getByRole('row', { name: /Dr. Zero/ })).toHaveTextContent('$0.00')
  expect(screen.getByRole('link', { name: /review leave requests/i })).toHaveAttribute('href', '/admin/leaves')
  expect(screen.queryByText(/medical records|total revenue|15%/i)).not.toBeInTheDocument()
})

test('reports failed stats without presenting zero estimates as real data and permits retry', async () => {
  apiFetch.mockRejectedValue(new Error('Dashboard unavailable'))
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Dashboard unavailable')
  expect(screen.getByRole('button', { name: /download operations report/i })).toBeDisabled()
  expect(screen.queryByText('$0.00')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /try again/i }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Dashboard unavailable'))
  expect(apiFetch.mock.calls.length).toBe(8)
})
