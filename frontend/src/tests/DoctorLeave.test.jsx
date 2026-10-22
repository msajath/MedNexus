import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import DoctorLeave from '../pages/DoctorLeave'
import { apiFetch, apiFetchJson } from '../config'

vi.mock('../config', () => ({ API_BASE: '', apiFetch: vi.fn(), apiFetchJson: vi.fn() }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))

const pending = { _id: 'leave-1', startDate: '2026-11-03', endDate: '2026-11-04', reason: 'Family commitment', status: 'pending' }
const response = (data, ok = true) => ({ ok, json: async () => data })
const ready = async () => expect(await screen.findByRole('button', { name: 'Submit leave request' })).toBeEnabled()
const fillRequest = () => {
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: pending.startDate } })
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: pending.endDate } })
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: pending.reason } })
}

beforeEach(() => {
  apiFetch.mockReset()
  apiFetchJson.mockReset().mockResolvedValue({ leaves: [], clinicDate: '2026-11-02' })
})
afterEach(() => cleanup())

test('submits inclusive leave dates for approval and shows the pending request', async () => {
  apiFetch.mockResolvedValue(response({ leave: pending }))
  render(<DoctorLeave />)
  await waitFor(ready)
  expect(screen.getByLabelText('Start date')).toHaveAttribute('min', '2026-11-02')
  fillRequest()
  fireEvent.click(screen.getByRole('button', { name: 'Submit leave request' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Leave request submitted for admin approval.')
  expect(screen.getByText('Pending approval')).toBeInTheDocument()
  const [url, options] = apiFetch.mock.calls[0]
  expect(url).toBe('/api/leaves')
  expect(options.method).toBe('POST')
  expect(JSON.parse(options.body)).toEqual({ startDate: pending.startDate, endDate: pending.endDate, reason: pending.reason })
})

test('keeps the form after an overlapping request is rejected by the server', async () => {
  apiFetch.mockResolvedValue(response({ message: 'An existing leave request overlaps these dates' }, false))
  render(<DoctorLeave />)
  await waitFor(ready)
  fillRequest()
  fireEvent.click(screen.getByRole('button', { name: 'Submit leave request' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/overlaps these dates/)
  expect(screen.getByLabelText('Reason')).toHaveValue(pending.reason)
  expect(screen.queryByText('Pending approval')).not.toBeInTheDocument()
})

test('only pending requests can be cancelled and the confirmed server result updates the row', async () => {
  apiFetchJson.mockResolvedValue({ leaves: [pending, { ...pending, _id: 'approved', status: 'approved' }] })
  apiFetch.mockResolvedValue(response({ leave: { ...pending, status: 'cancelled' } }))
  render(<DoctorLeave />)
  const cancel = await screen.findByRole('button', { name: /Cancel leave request/ })
  expect(screen.getAllByRole('button', { name: /Cancel leave request/ })).toHaveLength(1)
  fireEvent.click(cancel)
  expect(await screen.findByText('Cancelled')).toBeInTheDocument()
  expect(screen.getByText('Approved')).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledWith('/api/leaves/leave-1/cancel', { method: 'PUT' })
})

test('does not pretend a cancellation succeeded when the admin has already reviewed it', async () => {
  apiFetchJson.mockResolvedValue({ leaves: [pending] })
  apiFetch.mockResolvedValue(response({ message: 'Only your own pending leave requests can be cancelled' }, false))
  render(<DoctorLeave />)
  fireEvent.click(await screen.findByRole('button', { name: /Cancel leave request/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/pending leave requests/)
  expect(screen.getByText('Pending approval')).toBeInTheDocument()
  expect(screen.queryByText('Cancelled')).not.toBeInTheDocument()
})

test('load failures can be retried before submitting a request', async () => {
  apiFetchJson.mockRejectedValueOnce(new TypeError('Offline'))
  render(<DoctorLeave />)
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t load your leave requests/)
  expect(screen.getByRole('button', { name: 'Submit leave request' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(ready)
  expect(screen.getByText('You haven’t requested leave yet.')).toBeInTheDocument()
})

test('leaving the page cancels its pending read', () => {
  apiFetchJson.mockReturnValue(new Promise(() => {}))
  const { unmount } = render(<DoctorLeave />)
  const signal = apiFetchJson.mock.calls[0][1].signal
  expect(signal.aborted).toBe(false)
  unmount()
  expect(signal.aborted).toBe(true)
})
