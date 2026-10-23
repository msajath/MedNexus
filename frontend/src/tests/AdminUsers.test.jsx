import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import AdminUsers from '../pages/AdminUsers'
import { apiFetch } from '../config'

vi.mock('../config', () => ({ API_BASE: '', apiFetch: vi.fn() }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))
const response = (data, ok = true) => ({ ok, json: async () => data })
const doctor = { _id: 'doctor-user', name: 'Dr. Pending', email: 'pending@example.test', role: 'doctor', isVerified: false }
beforeEach(() => { apiFetch.mockReset() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

test('failed user loads show the server error and retry instead of an empty successful list', async () => {
  apiFetch.mockResolvedValueOnce(response({ message: 'User directory unavailable' }, false))
    .mockResolvedValueOnce(response({ users: [doctor] }))
  render(<AdminUsers />)
  expect(await screen.findByRole('alert')).toHaveTextContent('User directory unavailable')
  expect(screen.queryByText('No users found')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reload users' }))
  expect(await screen.findByText('Dr. Pending')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('failed account deactivation remains visible without removing the account', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  apiFetch.mockResolvedValueOnce(response({ users: [doctor] }))
    .mockResolvedValueOnce(response({ message: 'Account cannot be deactivated now' }, false))
  render(<AdminUsers />)
  fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Account cannot be deactivated now')
  expect(screen.getByText('Dr. Pending')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Deactivate' })).toBeEnabled()
})

test('failed verification preserves pending status and presents an actionable error', async () => {
  apiFetch.mockResolvedValueOnce(response({ users: [doctor] }))
    .mockResolvedValueOnce(response({ message: 'This doctor is no longer active' }, false))
  render(<AdminUsers />)
  fireEvent.click(await screen.findByRole('button', { name: 'Verify', exact: true }))
  expect(await screen.findByRole('alert')).toHaveTextContent('This doctor is no longer active')
  expect(screen.getByText('Pending')).toBeInTheDocument()
})

test('failed doctor details do not render fabricated zero earnings and empty patient history', async () => {
  apiFetch.mockResolvedValueOnce(response({ users: [doctor] }))
    .mockResolvedValueOnce(response({ message: 'Doctor profile not found' }, false))
  render(<AdminUsers />)
  fireEvent.click(await screen.findByRole('button', { name: 'Dr. Pending' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Doctor profile not found')
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Close doctor details' })).not.toBeInTheDocument())
  expect(screen.queryByText('No patients have booked this doctor yet.')).not.toBeInTheDocument()
})

test('doctor appointment history shows the booked fee instead of the current doctor price or implied payment', async () => {
  apiFetch.mockResolvedValueOnce(response({ users: [doctor] })).mockResolvedValueOnce(response({ doctor: {
    ...doctor, fee: 999, earnings: 0, appointments: [
      { _id: 'historic', patient: { name: 'Historic Patient' }, date: '2030-01-07', time: '09:00 AM', status: 'completed', feeAtBooking: 125 },
      { _id: 'pending', patient: { name: 'Pending Patient' }, date: '2030-01-07', time: '10:00 AM', status: 'pending', feeAtBooking: 75 },
      { _id: 'legacy', patient: { name: 'Legacy Patient' }, date: '2030-01-07', time: '11:00 AM', status: 'completed', feeAtBooking: null },
    ],
  } }))
  render(<AdminUsers />)
  fireEvent.click(await screen.findByRole('button', { name: 'Dr. Pending' }))
  const historic = await screen.findByRole('row', { name: /Historic Patient/ })
  expect(within(historic).getByText('$125.00')).toBeInTheDocument()
  expect(within(screen.getByRole('row', { name: /Pending Patient/ })).getByText('$75.00')).toBeInTheDocument()
  expect(within(screen.getByRole('row', { name: /Legacy Patient/ })).getByText('Fee unavailable')).toBeInTheDocument()
  expect(screen.queryByText('$999')).not.toBeInTheDocument()
})
