import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { formatMoney } from '../utils/admin'
import PrivacyPolicy from '../pages/PrivacyPolicy'
import TermsOfService from '../pages/TermsOfService'
import RegisterPage from '../pages/RegisterPage'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    register: vi.fn(),
    isAuthenticated: false,
  }),
}))

vi.mock('../components/Navbar', () => ({ default: () => <nav data-testid="mock-navbar">Navbar</nav> }))
vi.mock('../components/Footer', () => ({ default: () => <footer data-testid="mock-footer">Footer</footer> }))

describe('Sri Lankan Healthcare Regulatory Compliance & Localization Tests', () => {
  afterEach(cleanup)

  test('formatMoney formats Sri Lankan Rupees (LKR) and USD accurately', () => {
    // Default USD formatting (preserving backward compatibility)
    expect(formatMoney(100)).toBe('$100.00')
    expect(formatMoney(75.5)).toBe('$75.50')

    // LKR formatting
    const lkrResult = formatMoney(2500, 'LKR')
    expect(lkrResult).toMatch(/LKR|Rs/)

    // Fallback for non-numbers
    expect(formatMoney(null)).toBe('Fee unavailable')
    expect(formatMoney(undefined)).toBe('Fee unavailable')
  })

  test('PrivacyPolicy renders Sri Lankan PDPA 2022/2025 compliance provisions', () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { level: 1, name: /Privacy Notice/i })).toBeInTheDocument()
    expect(screen.getAllByText(/Personal Data Protection Act No\. 9 of 2022/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Data Controller and Data Processor/i)).toBeInTheDocument()
    expect(screen.getByText(/Data Subject Rights Under PDPA/i)).toBeInTheDocument()
    expect(screen.getByText(/Cross-Border Data Hosting/i)).toBeInTheDocument()
  })

  test('TermsOfService renders Suwa Seriya 1990 Emergency disclaimer and SLMC scope', () => {
    render(
      <MemoryRouter>
        <TermsOfService />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { level: 1, name: /Terms of Service/i })).toBeInTheDocument()
    expect(screen.getByText(/1990 \(Suwa Seriya\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Sri Lanka Medical Council \(SLMC\)/i)).toBeInTheDocument()
    expect(screen.getByText(/National Medicines Regulatory Authority/i)).toBeInTheDocument()
    expect(screen.getByText(/Democratic Socialist Republic of Sri Lanka/i)).toBeInTheDocument()
  })

  test('RegisterPage renders SLMC Registration Number input for doctors and links to Terms & Privacy', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    )

    // Switch to doctor role using fireEvent
    const doctorTab = screen.getByRole('button', { name: /Doctor/i })
    fireEvent.click(doctorTab)

    expect(screen.getByLabelText(/SLMC Registration Number/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Sri Lanka Medical Council/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Terms of Service/i })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: /Privacy Policy/i })).toHaveAttribute('href', '/privacy')
  })
})
