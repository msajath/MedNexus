import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import DoctorDashboard from '../pages/DoctorDashboard'
import { apiFetchJson } from '../config'
import { getLocalDateString } from '../utils/date'

vi.mock('../config', () => ({ API_BASE: '', apiFetchJson: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Dr. Ada' } }) }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))
const earnings = netReceived => ({ receivedAmount: netReceived + 25, refundedAmount: 25, netReceived, receivedPayments: 1, currency: 'USD', basis: 'recorded_payments' })
const appointments = Array.from({ length: 6 }, (_, index) => ({ _id: `a${index}`, patient: { _id: `p${index}`, name: `Patient ${index}` }, date: getLocalDateString(), time: `${9 + index}:00`, status: 'completed', feeAtBooking: 999, doctor: { fee: 999 } }))
const renderPage = () => render(<MemoryRouter><DoctorDashboard /></MemoryRouter>)
const moneyCard = () => within(screen.getByText('Consultation Earnings').parentElement)
beforeEach(() => { apiFetchJson.mockReset() })
afterEach(cleanup)

test('shows the doctor payment endpoint net receipts and the full today count, without fee estimates', async () => {
  apiFetchJson.mockImplementation(async url => url.endsWith('/payments/my') ? { earnings: earnings(75) } : { appointments })
  renderPage()
  expect(await screen.findByText('$75.00')).toBeInTheDocument()
  expect(moneyCard().getByText('$75.00')).toBeInTheDocument()
  expect(screen.getByText('You have 6 appointments scheduled today.')).toBeInTheDocument()
  expect(screen.getAllByText(/Patient \d/)).toHaveLength(5)
  expect(apiFetchJson).toHaveBeenCalledWith('/api/payments/my')
  expect(screen.queryByText(/\$999|\$5,994|estimated/i)).not.toBeInTheDocument()
})

test('completed appointments remain zero earnings when no net payment has been received', async () => {
  apiFetchJson.mockImplementation(async url => url.endsWith('/payments/my') ? { earnings: earnings(0) } : { appointments })
  renderPage()
  expect(await screen.findAllByText('$0.00')).not.toHaveLength(0)
  expect(moneyCard().getByText('$0.00')).toBeInTheDocument()
  expect(screen.queryByText(/\$999|\$5,994/)).not.toBeInTheDocument()
})

test.each([
  ['a failed read', () => Promise.reject(new Error('Unavailable'))],
  ['a missing summary', () => Promise.resolve({})],
  ['a nonnumeric net amount', () => Promise.resolve({ earnings: { ...earnings(0), netReceived: '999' } })],
  ['an estimate instead of receipts', () => Promise.resolve({ earnings: { ...earnings(999), basis: 'estimated_fees' } })],
])('does not invent earnings after %s and retries successfully', async (_, failure) => {
  let failed = true
  apiFetchJson.mockImplementation(url => url.endsWith('/payments/my') ? failed ? failure() : Promise.resolve({ earnings: earnings(15) }) : Promise.resolve({ appointments }))
  renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t load your dashboard/i)
  expect(moneyCard().getByText('—')).toBeInTheDocument()
  expect(screen.queryByText(/\$999|\$0\.00/)).not.toBeInTheDocument()
  failed = false
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('$15.00')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
