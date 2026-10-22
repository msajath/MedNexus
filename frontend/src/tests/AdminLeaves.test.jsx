import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import AdminLeaves from '../pages/AdminLeaves'
import { apiFetch, apiFetchJson } from '../config'

vi.mock('../config', () => ({ API_BASE: '', apiFetch: vi.fn(), apiFetchJson: vi.fn() }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })
const leave = { _id: 'leave1', doctor: { user: { name: 'Dr. Ada', email: 'ada@example.com' }, specialty: 'Cardiology' }, startDate: '2026-11-04', endDate: '2026-11-06', reason: 'Family event', status: 'pending', createdAt: '2026-10-22T00:00:00Z' }
const clearPreview = { conflicts: [], conflictCount: 0, processingCount: 0, overlapLeaveCount: 0, doctor: { active: true, verified: true } }
const renderPage = () => render(<MemoryRouter><AdminLeaves /></MemoryRouter>)
const checkAndAcknowledge = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Check appointments' }))
  await screen.findByText('Doctor account: Active and verified')
  fireEvent.click(screen.getByRole('checkbox', { name: /I have reviewed/ }))
}
beforeEach(() => { apiFetch.mockReset(); apiFetchJson.mockReset() })
afterEach(cleanup)

test('requires conflict preview and acknowledgement before approving with an admin note', async () => {
  apiFetchJson.mockResolvedValueOnce({ leaves: [leave] }).mockResolvedValueOnce(clearPreview)
  apiFetch.mockResolvedValueOnce(response({ leave: { ...leave, status: 'approved', adminNote: 'Cover arranged' } }))
  renderPage()
  expect(await screen.findByRole('button', { name: 'Approve leave' })).toBeDisabled()
  expect(screen.getByRole('checkbox', { name: /I have reviewed/ })).toBeDisabled()
  await checkAndAcknowledge()
  fireEvent.change(screen.getByRole('textbox', { name: 'Admin note (optional)' }), { target: { value: 'Cover arranged' } })
  fireEvent.click(screen.getByRole('button', { name: 'Approve leave' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Leave request approved.')
  expect(screen.getByText('Cover arranged')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Approve leave' })).not.toBeInTheDocument()
  expect(apiFetch).toHaveBeenLastCalledWith('/api/leaves/leave1/review', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ status: 'approved', adminNote: 'Cover arranged' }) }))
})

test.each([
  { ...clearPreview, conflicts: [{ id: 'a1', patientName: 'Pat', date: '2026-11-04', time: '09:00', status: 'pending' }], conflictCount: 1 },
  { ...clearPreview, overlapLeaveCount: 1 },
  { ...clearPreview, doctor: { active: false, verified: true } },
  { ...clearPreview, doctor: { active: true, verified: false } },
])('blocks approval when preview reports conflicts or an ineligible doctor: %j', async preview => {
  apiFetchJson.mockResolvedValueOnce({ leaves: [leave] }).mockResolvedValueOnce(preview)
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Check appointments' }))
  await screen.findByText(/Doctor account:/)
  fireEvent.click(screen.getByRole('checkbox', { name: /I have reviewed/ }))
  expect(screen.getByRole('button', { name: 'Approve leave' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Reject leave' })).toBeEnabled()
  expect(apiFetch).not.toHaveBeenCalled()
})

test('a new booking at approval time remains unapproved and requires a fresh review', async () => {
  apiFetchJson.mockResolvedValueOnce({ leaves: [leave] }).mockResolvedValueOnce(clearPreview)
  apiFetch.mockResolvedValueOnce(response({ message: 'Resolve active appointments first.', conflicts: [{ id: 'a1', date: '2026-11-04', time: '09:00' }], conflictCount: 1 }, 409))
  renderPage()
  await checkAndAcknowledge()
  fireEvent.click(screen.getByRole('button', { name: 'Approve leave' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Leave was not approved')
  expect(screen.getByText('Conflicting appointments: 1')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /view appointments/i })).toHaveAttribute('href', '/admin/appointments')
  expect(screen.getByRole('button', { name: 'Approve leave' })).toBeDisabled()
  expect(screen.getByRole('checkbox', { name: /I have reviewed/ })).not.toBeChecked()
  expect(screen.queryByText('Leave request approved.')).not.toBeInTheDocument()
})

test('failed or malformed previews cannot enable approval and can be retried', async () => {
  apiFetchJson.mockResolvedValueOnce({ leaves: [leave] }).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ conflicts: [] }).mockResolvedValueOnce(clearPreview)
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Check appointments' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/check appointment conflicts/)
  expect(screen.getByRole('button', { name: 'Approve leave' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Check appointments' }))
  await waitFor(() => expect(apiFetchJson).toHaveBeenCalledTimes(3))
  expect(await screen.findByRole('alert')).toHaveTextContent(/check appointment conflicts/)
  await checkAndAcknowledge()
  expect(screen.getByRole('button', { name: 'Approve leave' })).toBeEnabled()
})

test('allows review recovery for interrupted requests and rejection without approval checks', async () => {
  apiFetchJson.mockResolvedValueOnce({ leaves: [{ ...leave, status: 'reviewing' }] })
  apiFetch.mockResolvedValueOnce(response({ leave: { ...leave, status: 'rejected' } }))
  renderPage()
  expect(await screen.findByText(/previous review is incomplete/i)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reject leave' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Leave request rejected.')
})

test('load failure can be retried without showing a false success', async () => {
  apiFetchJson.mockRejectedValueOnce(new Error('Service unavailable')).mockResolvedValueOnce({ leaves: [] })
  renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable')
  fireEvent.click(screen.getByRole('button', { name: 'Reload requests' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(screen.getByText('No leave requests found.')).toBeInTheDocument()
})
