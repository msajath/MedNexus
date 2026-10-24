import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import AboutPage from '../pages/AboutPage'
import { apiFetchJson } from '../config'

vi.mock('../config', () => ({ API_BASE: '', apiFetchJson: vi.fn() }))
vi.mock('../components/Navbar', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))

beforeEach(() => {
  apiFetchJson.mockReset()
})

afterEach(cleanup)

test('renders real platform statistics for doctors, patients, and specialties from API', async () => {
  apiFetchJson.mockResolvedValueOnce({
    success: true,
    stats: {
      verifiedDoctors: 15,
      happyPatients: 42,
      specialties: 6,
    },
  })

  render(
    <MemoryRouter>
      <AboutPage />
    </MemoryRouter>
  )

  expect(await screen.findByText('15+')).toBeInTheDocument()
  expect(screen.getByText('42+')).toBeInTheDocument()
  expect(screen.getByText('6+')).toBeInTheDocument()
  expect(screen.getByText('Verified Doctors')).toBeInTheDocument()
  expect(screen.getByText('Happy Patients')).toBeInTheDocument()
  expect(screen.getByText('Specialties')).toBeInTheDocument()

  // Verify fake hardcoded stats are not present
  expect(screen.queryByText('10K+')).not.toBeInTheDocument()
  expect(screen.queryByText('50K+')).not.toBeInTheDocument()
  expect(screen.queryByText('100+')).not.toBeInTheDocument()
})

test('falls back gracefully to doctors list when platform-stats endpoint fails', async () => {
  apiFetchJson
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValueOnce({
      doctors: [
        { id: '1', specialty: 'Cardiology' },
        { id: '2', specialty: 'Neurology' },
        { id: '3', specialty: 'Dermatology' },
      ],
    })

  render(
    <MemoryRouter>
      <AboutPage />
    </MemoryRouter>
  )

  expect((await screen.findAllByText('3+')).length).toBeGreaterThan(0)
  expect(screen.queryByText('10K+')).not.toBeInTheDocument()
  expect(screen.queryByText('50K+')).not.toBeInTheDocument()
})
