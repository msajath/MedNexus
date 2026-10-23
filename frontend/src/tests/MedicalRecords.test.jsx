import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import MedicalRecords from '../pages/MedicalRecords'
import { apiFetch } from '../config'

vi.mock('../config', () => ({ API_BASE: '', apiFetch: vi.fn() }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => url === '/api/records/my'
    ? { ok: true, json: async () => ({ records: [] }) }
    : { ok: true, json: async () => ({ success: true, record: { _id: 'record-1', title: 'Blood test', attachments: [] } }) })
})
afterEach(() => cleanup())

test('patient can upload a PDF report with a medical record', async () => {
  render(<MedicalRecords />)
  fireEvent.click(screen.getByRole('button', { name: /add record/i }))
  fireEvent.change(screen.getByPlaceholderText(/blood test report/i), { target: { value: 'Blood test' } })
  fireEvent.change(screen.getByLabelText(/upload patient report/i), {
    target: { files: [new File(['%PDF-1.4\nresult'], 'results.pdf', { type: 'application/pdf' })] },
  })
  fireEvent.click(screen.getByRole('button', { name: /save record/i }))
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/records', expect.anything()))
  const body = JSON.parse(apiFetch.mock.calls.find(([url]) => url === '/api/records')[1].body)
  expect(body.attachments).toEqual([{ name: 'results.pdf', type: 'application/pdf', url: expect.stringMatching(/^data:application\/pdf;base64,/) }])
})

test('rejects an oversized report before posting', async () => {
  render(<MedicalRecords />)
  fireEvent.click(screen.getByRole('button', { name: /add record/i }))
  fireEvent.change(screen.getByLabelText(/upload patient report/i), {
    target: { files: [new File([new Uint8Array(701 * 1024)], 'large.pdf', { type: 'application/pdf' })] },
  })
  expect(screen.getByRole('alert')).toHaveTextContent(/700 KB/i)
  expect(apiFetch.mock.calls.some(([url]) => url === '/api/records')).toBe(false)
})

test('allows removing a mistakenly selected file before saving', async () => {
  render(<MedicalRecords />)
  fireEvent.click(screen.getByRole('button', { name: /add record/i }))
  fireEvent.change(screen.getByLabelText(/upload patient report/i), {
    target: { files: [new File(['%PDF-1.4\nwrong'], 'mistake.pdf', { type: 'application/pdf' })] },
  })
  expect(screen.getByText('mistake.pdf')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /remove/i }))
  expect(screen.queryByText('mistake.pdf')).toBeNull()
})

test('allows selecting a specific doctor to share report with', async () => {
  apiFetch.mockImplementation(async url => {
    if (url === '/api/records/my') return { ok: true, json: async () => ({ records: [] }) }
    if (url === '/api/doctors') return { ok: true, json: async () => ({ doctors: [{ id: 'doc-42', name: 'Dr. Jane Smith', specialty: 'Cardiology' }] }) }
    return { ok: true, json: async () => ({ success: true, record: { _id: 'rec-2', title: 'Heart ECG', doctor: { name: 'Dr. Jane Smith' } } }) }
  })
  render(<MedicalRecords />)
  fireEvent.click(screen.getByRole('button', { name: /add record/i }))
  fireEvent.change(screen.getByPlaceholderText(/blood test report/i), { target: { value: 'Heart ECG' } })
  await waitFor(() => expect(screen.getByText(/Dr\. Jane Smith/i)).toBeInTheDocument())
  fireEvent.change(screen.getByLabelText(/doctor access/i), { target: { value: 'doc-42' } })
  fireEvent.click(screen.getByRole('button', { name: /save record/i }))
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/records', expect.anything()))
  const postCall = apiFetch.mock.calls.find(([url]) => url === '/api/records')
  const payload = JSON.parse(postCall[1].body)
  expect(payload.doctorId).toBe('doc-42')
})

test('shows a failed medical-record load and retries instead of claiming the records are empty', async () => {
  let failed = true
  apiFetch.mockImplementation(async url => url === '/api/records/my'
    ? { ok: !failed, json: async () => failed ? { message: 'Records temporarily unavailable' } : { records: [{ _id: 'rec-1', title: 'Recovered record', type: 'Other', addedBy: 'patient' }] } }
    : { ok: true, json: async () => ({ doctors: [] }) })
  render(<MedicalRecords />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Records temporarily unavailable')
  expect(screen.queryByText('No records found')).not.toBeInTheDocument()
  failed = false
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Recovered record')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test.each([
  ['script.exe', 'application/octet-stream'],
  ['notes.txt', 'text/plain'],
  ['unknown', ''],
])('rejects unsupported report %s before attempting an upload', async (name, type) => {
  render(<MedicalRecords />)
  fireEvent.click(screen.getByRole('button', { name: /add record/i }))
  fireEvent.change(screen.getByLabelText(/upload patient report/i), {
    target: { files: [new File(['unsupported content'], name, { type })] },
  })
  expect(screen.getByRole('alert')).toHaveTextContent(/PDF, PNG, JPEG, or WebP/i)
  expect(screen.queryByText(name)).not.toBeInTheDocument()
  expect(apiFetch.mock.calls.some(([url]) => url === '/api/records')).toBe(false)
})

test('clinical records remain readable without offering an unauthorized delete action', async () => {
  apiFetch.mockImplementation(async url => ({ ok: true, json: async () => url === '/api/records/my'
    ? { records: [{ _id: 'clinical-1', title: 'Clinical diagnosis', type: 'Diagnosis', addedBy: 'doctor', appointment: 'appointment-1' }] }
    : { doctors: [] } }))
  render(<MedicalRecords />)
  fireEvent.click(await screen.findByText('Clinical diagnosis'))
  expect(screen.getByText('Added by your doctor')).toBeInTheDocument()
  expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /delete record/i })).not.toBeInTheDocument()
})
