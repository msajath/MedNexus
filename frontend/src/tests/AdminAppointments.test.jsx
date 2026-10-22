import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import AdminAppointments from '../pages/AdminAppointments'
import { apiFetch } from '../config'

vi.mock('../config', () => ({ API_BASE: '', apiFetch: vi.fn() }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))
const response = (data, ok = true) => ({ ok, json: async () => data })
const appointments = [
  { _id: 'a1', patient: { name: 'Pat One', email: 'one@example.com', phone: '0771234567' }, doctor: { user: { name: 'Dr. Ada' }, specialty: 'Cardiology' }, date: '2026-11-05', time: '09:00', type: 'Consultation', status: 'pending', feeAtBooking: 75, notes: 'Secret clinical note', symptoms: 'Private symptom', rescheduled: true, rescheduleHistory: [{ fromDate: '2026-11-04', fromTime: '10:00', toDate: '2026-11-05', toTime: '09:00', changedAt: '2026-10-22T01:00:00Z' }] },
  { _id: 'a2', patient: { name: 'Pat Two' }, doctor: { user: { name: 'Dr. Ada' } }, date: '2026-11-05', time: '10:00', type: 'Follow-up', status: 'completed', feeAtBooking: null },
]
beforeEach(() => { apiFetch.mockReset() })
afterEach(cleanup)

test('shows administrative details, fee snapshots and overlapping reschedule history without clinical notes', async () => {
  apiFetch.mockResolvedValue(response({ appointments }))
  render(<AdminAppointments />)
  expect(await screen.findByText('Pat One')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'pending (1)' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'rescheduled (1)' })).toBeInTheDocument()
  expect(screen.getByText('$75.00')).toBeInTheDocument()
  expect(screen.getByText('Fee unavailable')).toBeInTheDocument()
  expect(screen.getByText('0771234567')).toBeInTheDocument()
  expect(screen.getByText(/Reschedule history \(1\)/)).toBeInTheDocument()
  expect(screen.queryByText(/Secret clinical note|Private symptom/)).not.toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Status for Pat Two' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'rescheduled (1)' }))
  expect(screen.queryByText('Pat Two')).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search appointments' }), { target: { value: 'one@example.com' } })
  expect(screen.getByText('Pat One')).toBeInTheDocument()
})

test('does not change status on an unsuccessful update and recovers on a successful retry', async () => {
  apiFetch.mockResolvedValueOnce(response({ appointments })).mockResolvedValueOnce(response({ message: 'The appointment has already changed.' }, false)).mockResolvedValueOnce(response({ appointment: { status: 'confirmed' } }))
  render(<AdminAppointments />)
  const select = await screen.findByRole('combobox', { name: 'Status for Pat One' })
  expect(within(select).getByRole('option', { name: 'Completed' })).toBeDisabled()
  fireEvent.change(select, { target: { value: 'confirmed' } })
  expect(await screen.findByRole('alert')).toHaveTextContent('The appointment has already changed.')
  expect(select).toHaveValue('pending')
  fireEvent.change(select, { target: { value: 'confirmed' } })
  await waitFor(() => expect(select).toHaveValue('confirmed'))
  expect(screen.getByRole('status')).toHaveTextContent('Appointment marked confirmed.')
  expect(apiFetch).toHaveBeenLastCalledWith('/api/admin/appointments/a1/status', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ status: 'confirmed' }) }))
})

test('shows a load error with a reload action instead of silently accepting failure', async () => {
  apiFetch.mockResolvedValueOnce(response({ message: 'Not authorized' }, false)).mockResolvedValueOnce(response({ appointments: [] }))
  render(<AdminAppointments />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Not authorized')
  fireEvent.click(screen.getByRole('button', { name: 'Reload appointments' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(screen.getByText('No appointments found')).toBeInTheDocument()
})

test('records only explicitly confirmed received money and refreshes the receipt without losing filters', async () => {
  const completed = { ...appointments[1], paymentStatus: 'unpaid', payment: null }
  const receipt = { id: 'receipt2', status: 'received', amount: 42.5, currency: 'USD', method: 'card', reference: 'POS-123', receivedAt: '2026-10-22T03:00:00Z', recordedAt: '2026-10-22T03:01:00Z' }
  apiFetch.mockResolvedValueOnce(response({ appointments: [completed] }))
    .mockResolvedValueOnce(response({ payment: receipt }))
    .mockResolvedValueOnce(response({ appointments: [{ ...completed, paymentStatus: 'received', payment: receipt }] }))
  render(<AdminAppointments />)
  expect(await screen.findByText('No payment recorded')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'completed (1)' }))
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Pat Two' } })
  fireEvent.click(screen.getByText('Record received payment'))
  const form = screen.getByRole('form', { name: 'Record payment for Pat Two' })
  const save = within(form).getByRole('button', { name: 'Save received payment' })
  expect(save).toBeDisabled()
  fireEvent.change(within(form).getByRole('textbox', { name: 'Amount received for Pat Two' }), { target: { value: '42.555' } })
  fireEvent.click(within(form).getByRole('checkbox'))
  fireEvent.submit(form)
  expect(apiFetch).toHaveBeenCalledTimes(1)
  fireEvent.change(within(form).getByRole('textbox', { name: 'Amount received for Pat Two' }), { target: { value: '42.50' } })
  fireEvent.change(within(form).getByRole('combobox'), { target: { value: 'card' } })
  fireEvent.change(within(form).getByRole('textbox', { name: 'Receipt reference for Pat Two' }), { target: { value: ' POS-123 ' } })
  expect(within(form).queryByLabelText(/card number|security code|bank account/i)).not.toBeInTheDocument()
  fireEvent.click(save)
  expect(await screen.findByText('Payment received')).toBeInTheDocument()
  expect(screen.getByText('receipt2')).toBeInTheDocument()
  expect(screen.getByText('$42.50')).toBeInTheDocument()
  expect(screen.getByText('POS-123')).toBeInTheDocument()
  expect(screen.getByRole('searchbox')).toHaveValue('Pat Two')
  expect(screen.getByRole('button', { name: 'completed (1)' })).toHaveAttribute('aria-pressed', 'true')
  expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/admin/appointments/a2/payment', expect.objectContaining({ method: 'POST', body: JSON.stringify({ amount: 42.5, currency: 'USD', method: 'card', reference: 'POS-123' }) }))
})

test('requires an issued full refund confirmation and reason, then refreshes read-only refund details', async () => {
  const receipt = { id: 'receipt1', status: 'received', amount: 75, currency: 'USD', method: 'cash' }
  const paid = { ...appointments[0], paymentStatus: 'received', payment: receipt }
  const refunded = { ...receipt, status: 'refunded', refundedAt: '2026-10-22T05:00:00Z', refundReason: 'Appointment cancelled' }
  apiFetch.mockResolvedValueOnce(response({ appointments: [paid] })).mockResolvedValueOnce(response({ payment: refunded })).mockResolvedValueOnce(response({ appointments: [{ ...paid, paymentStatus: 'refunded', payment: refunded }] }))
  render(<AdminAppointments />)
  fireEvent.click(await screen.findByText('Record issued refund'))
  const form = screen.getByRole('form', { name: 'Record refund for Pat One' })
  const save = within(form).getByRole('button', { name: 'Save issued refund' })
  fireEvent.click(within(form).getByRole('checkbox'))
  fireEvent.submit(form)
  expect(save).toBeDisabled()
  expect(apiFetch).toHaveBeenCalledTimes(1)
  fireEvent.change(within(form).getByRole('textbox', { name: 'Refund reason for Pat One' }), { target: { value: ' Appointment cancelled ' } })
  fireEvent.click(save)
  expect(await screen.findByText('Refunded')).toBeInTheDocument()
  expect(screen.getByText('Appointment cancelled')).toBeInTheDocument()
  expect(screen.queryByText('Record issued refund')).not.toBeInTheDocument()
  expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/admin/payments/receipt1/refund', expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: 'Appointment cancelled' }) }))
})

test('refreshes a conflicting receipt without claiming that the attempted payment was saved', async () => {
  const receipt = { id: 'already-recorded', status: 'received', amount: 60, currency: 'USD', method: 'bank_transfer' }
  apiFetch.mockResolvedValueOnce(response({ appointments: [appointments[0]] })).mockResolvedValueOnce({ ...response({ message: 'A payment already exists.' }, false), status: 409 }).mockResolvedValueOnce(response({ appointments: [{ ...appointments[0], paymentStatus: 'received', payment: receipt }] }))
  render(<AdminAppointments />)
  fireEvent.click(await screen.findByText('Record received payment'))
  const form = screen.getByRole('form', { name: 'Record payment for Pat One' })
  fireEvent.change(within(form).getByRole('textbox', { name: 'Amount received for Pat One' }), { target: { value: '75' } })
  fireEvent.click(within(form).getByRole('checkbox'))
  fireEvent.submit(form)
  expect(await screen.findByRole('alert')).toHaveTextContent('A payment already exists.')
  expect(screen.getByText('already-recorded')).toBeInTheDocument()
  expect(screen.getByText('$60.00')).toBeInTheDocument()
  expect(screen.queryByText('Received payment recorded.')).not.toBeInTheDocument()
})

test('does not offer payment collection for cancelled appointments', async () => {
  apiFetch.mockResolvedValue(response({ appointments: [{ ...appointments[0], status: 'cancelled' }] }))
  render(<AdminAppointments />)
  expect(await screen.findByText('No payment recorded')).toBeInTheDocument()
  expect(screen.queryByText('Record received payment')).not.toBeInTheDocument()
})

test('reuses the receipt idempotency key after a lost response, while edited payment data gets a new key', async () => {
  apiFetch.mockResolvedValueOnce(response({ appointments: [appointments[0]] }))
    .mockRejectedValueOnce(new TypeError('Network interrupted'))
    .mockRejectedValueOnce(new TypeError('Network interrupted'))
    .mockRejectedValueOnce(new TypeError('Network interrupted'))
  render(<AdminAppointments />)
  fireEvent.click(await screen.findByText('Record received payment'))
  const form = screen.getByRole('form', { name: 'Record payment for Pat One' })
  const amount = within(form).getByRole('textbox', { name: 'Amount received for Pat One' })
  fireEvent.change(amount, { target: { value: '75' } })
  fireEvent.click(within(form).getByRole('checkbox'))
  fireEvent.submit(form)
  await screen.findByRole('alert')
  const firstKey = apiFetch.mock.calls[1][1].headers['Idempotency-Key']
  expect(firstKey).toMatch(/^[a-f0-9-]{36}$/)
  fireEvent.submit(form)
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3))
  await waitFor(() => expect(within(form).getByRole('button', { name: 'Save received payment' })).toBeEnabled())
  expect(apiFetch.mock.calls[2][1].headers['Idempotency-Key']).toBe(firstKey)
  fireEvent.change(amount, { target: { value: '80' } })
  fireEvent.submit(form)
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(4))
  expect(apiFetch.mock.calls[3][1].headers['Idempotency-Key']).not.toBe(firstKey)
})
