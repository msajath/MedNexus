import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import Messages from '../pages/Messages'
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Patient', role: 'patient' } }) }))
afterEach(() => vi.unstubAllGlobals())
test('marks a message read using its ID', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ _id: 'message-123', senderName: 'Clinic', subject: 'Welcome', body: 'Welcome', read: false }] }) })
  vi.stubGlobal('fetch', fetch)
  render(<MemoryRouter><Messages /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: /Clinic/ }))
  await waitFor(() => expect(screen.getByText('You have 0 unread messages')).toBeInTheDocument())
  expect(fetch.mock.calls[1][0]).toBe('/api/messages/message-123/read')
  expect(fetch.mock.calls[1][1].headers.get('X-MedNexus-Request')).toBe('1')
})
