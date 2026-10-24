import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import AdminDoctors from '../pages/AdminDoctors'
import { apiFetch } from '../config'

vi.mock('../config', () => ({ API_BASE: '', apiFetch: vi.fn() }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))
const response = (data, ok = true) => ({ ok, json: async () => data })
beforeEach(() => { apiFetch.mockReset() })
afterEach(cleanup)

test('lists zero-earning and inactive doctors using received payments less refunds', async () => {
  apiFetch.mockImplementation(async (url) => {
    if (url.endsWith('/earnings')) {
      return response({ earnings: { receivedAmount: 100, refundedAmount: 20, netReceived: 80, receivedPayments: 1 }, doctors: [
        { doctorId: 'd1', userId: 'u1', name: 'Dr. Active', specialty: 'Cardiology', completedAppointments: 2, netReceived: 80, totalPaidOut: 50, pendingBalance: 30, isActive: true },
        { doctorId: 'd2', userId: 'u2', name: 'Dr. Inactive', specialty: 'Dermatology', completedAppointments: 20, netReceived: 0, totalPaidOut: 0, pendingBalance: 0, isActive: false },
      ] })
    }
    if (url.endsWith('/payouts')) {
      return response({ payouts: [] })
    }
    return response({ doctors: [{ _id: 'd1', userId: 'u1', name: 'Dr. Active', email: 'active@example.com', specialty: 'Cardiology', fee: 150, isVerified: true }] })
  })
  render(<AdminDoctors />)
  const inactive = await screen.findByRole('row', { name: /Dr. Inactive/ })
  expect(within(inactive).getByText('Deactivated')).toBeInTheDocument()
  expect(within(inactive).getAllByText('$0.00').length).toBeGreaterThanOrEqual(1)
  const active = screen.getByRole('row', { name: /Dr. Active/ })
  expect(within(active).getByText('$80.00')).toBeInTheDocument()
  expect(within(active).getByText('$50.00')).toBeInTheDocument()
  expect(within(active).getByText('$30.00')).toBeInTheDocument()
  expect(screen.getByText(/Revenue, Doctor Income & Bank Salary Management/i)).toBeInTheDocument()
})

test('shows a failed earnings load instead of silently showing an empty successful dashboard', async () => {
  apiFetch.mockResolvedValue(response({ message: 'Unable to read earnings' }, false))
  render(<AdminDoctors />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to read earnings')
  expect(screen.getByRole('button', { name: 'Reload data' })).toBeInTheDocument()
})
