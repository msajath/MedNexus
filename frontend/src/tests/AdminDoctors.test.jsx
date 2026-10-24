import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
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

test('only confirmed completed transfers count as paid while all payout requests remain in history', async () => {
  const payouts = ['completed', 'pending', 'processing', 'failed', 'unverified', 'cancelled'].map((status, index) => ({
    _id: `payout-${index}`, status, amount: 10, createdAt: '2026-10-20T10:00:00Z',
  }))
  apiFetch.mockImplementation(async url => {
    if (url.endsWith('/payouts')) return response({ payouts })
    if (url.endsWith('/earnings')) return response({ earnings: { netReceived: 100 }, totalDoctorPayouts: 10, hospitalRetained: 90, doctors: [] })
    return response({ doctors: [] })
  })
  render(<AdminDoctors />)
  expect(await screen.findByText('Confirmed bank transfers: 1')).toBeInTheDocument()
  expect(screen.getByText('6 payout records')).toBeInTheDocument()
  expect(screen.queryByText('6 bank transfers completed')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancel payout request' })).toBeInTheDocument()
})

const setupPortal = mutation => {
  const doctor = { _id: 'd1', userId: 'u1', name: 'Dr. Active', email: 'active@example.test', specialty: 'Cardiology', fee: 150, isVerified: true }
  apiFetch.mockImplementation(async (url, options) => {
    if (options?.method) return mutation(url, options)
    if (url.endsWith('/doctors-detail')) return response({ doctors: [doctor] })
    if (url.endsWith('/earnings')) return response({ earnings: { netReceived: 200 }, doctors: [{ doctorId: 'd1', name: doctor.name, netReceived: 200, pendingBalance: 200 }] })
    return response({ payouts: [] })
  })
}
test('admin edits a consultation fee, retries a rejected save and preserves a zero charge', async () => {
  let attempts = 0
  setupPortal(async () => ++attempts === 1 ? response({ message: 'Fee changed; please retry' }, false) : response({ success: true }))
  render(<AdminDoctors />)
  fireEvent.click((await screen.findAllByText('active@example.test'))[0])
  fireEvent.click(screen.getByRole('button', { name: /Fix Charge/ }))
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } })
  fireEvent.click(screen.getByRole('button', { name: /Save Charge/ }))
  expect(await screen.findByText('Fee changed; please retry')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Save Charge/ }))
  expect(await screen.findByText('Fee successfully updated to $0.')).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledWith('/api/admin/doctors/d1/fee', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ fee: 0 }) }))
})
test('salary portal saves an explicit pending request without claiming money was sent', async () => {
  setupPortal(async () => response({ success: true, message: 'Payout request saved. No money has been transferred.', payout: { status: 'pending' } }))
  const { container } = render(<AdminDoctors />)
  fireEvent.click(await screen.findByRole('button', { name: /Prepare Payout/ }))
  const form = container.querySelector('form')
  const input = label => within(form).getByText(label, { selector: 'label' }).parentElement.querySelector('input')
  fireEvent.change(input('Bank Name *'), { target: { value: 'Sample Bank' } })
  fireEvent.change(input('Account Number *'), { target: { value: '0000012345' } })
  fireEvent.change(input('Account Holder Name *'), { target: { value: 'Sample Doctor' } })
  fireEvent.change(input('Routing / IFSC Code'), { target: { value: 'SAMPLE' } })
  fireEvent.change(input('Payment Reference / Salary Note'), { target: { value: 'Salary request' } })
  fireEvent.click(within(form).getByRole('button', { name: /Save Payout Request/ }))
  expect(await screen.findByText('Payout request saved. No money has been transferred.')).toBeInTheDocument()
  const call = apiFetch.mock.calls.find(([, options]) => options?.method === 'POST')
  expect(call[0]).toBe('/api/admin/payouts')
  expect(JSON.parse(call[1].body)).toMatchObject({ amount: 200, doctorId: 'd1' })
  expect(screen.queryByText(/Successfully sent/)).not.toBeInTheDocument()
})
test('failed payout history cannot be displayed as a successful empty list', async () => {
  setupPortal(async () => response({ success: true }))
  const original = apiFetch.getMockImplementation()
  apiFetch.mockImplementation((url, options) => url.endsWith('/payouts') ? Promise.resolve(response({ message: 'History unavailable' }, false)) : original(url, options))
  render(<AdminDoctors />)
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
})
