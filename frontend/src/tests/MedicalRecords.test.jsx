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
