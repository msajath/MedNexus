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
  apiFetch.mockImplementation(async url => url.endsWith('/earnings') ? response({ earnings: { receivedAmount: 100, refundedAmount: 20, netReceived: 80, receivedPayments: 1 }, doctors: [
    { doctorId: 'd1', userId: 'u1', name: 'Dr. Active', specialty: 'Cardiology', completedAppointments: 2, receivedAmount: 100, refundedAmount: 20, netReceived: 80, receivedPayments: 1, isActive: true },
    { doctorId: 'd2', userId: 'u2', name: 'Dr. Inactive', specialty: 'Dermatology', completedAppointments: 20, receivedAmount: 0, refundedAmount: 0, netReceived: 0, receivedPayments: 0, isActive: false },
  ] }) : response({ doctors: [{ _id: 'd1', userId: 'u1', name: 'Dr. Active', email: 'active@example.com', specialty: 'Cardiology', fee: 999, isVerified: true }] }))
  render(<AdminDoctors />)
  const inactive = await screen.findByRole('row', { name: /Dr. Inactive/ })
  expect(within(inactive).getByText('Inactive')).toBeInTheDocument()
  expect(within(inactive).getAllByText('$0.00')).toHaveLength(3)
  const active = screen.getByRole('row', { name: /Dr. Active/ })
  expect(within(active).getByText('$80.00')).toBeInTheDocument()
  expect(within(active).getByText('$100.00')).toBeInTheDocument()
  expect(within(active).getByText('$20.00')).toBeInTheDocument()
  expect(screen.getByText(/historical fees never automatically count as paid/i)).toBeInTheDocument()
  expect(screen.queryByText('$999.00')).not.toBeInTheDocument()
})

test('shows a failed earnings load instead of silently showing an empty successful dashboard', async () => {
  apiFetch.mockResolvedValue(response({ message: 'Unable to read earnings' }, false))
  render(<AdminDoctors />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to read earnings')
  expect(screen.getByRole('button', { name: 'Reload doctors' })).toBeInTheDocument()
})
