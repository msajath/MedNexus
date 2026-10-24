import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import PatientProfile from '../pages/PatientProfile'
import DoctorProfileSettings from '../pages/DoctorProfileSettings'
import AdminProfile from '../pages/AdminProfile'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../config'

vi.mock('../config', () => ({ API_BASE: '', apiFetch: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))
vi.mock('../components/PasswordChangeForm', () => ({ default: () => null }))

const setUser = vi.fn()
const initialUser = {
  name: 'QA Example', email: 'profile@qa.example', bloodType: 'Unknown',
  doctorProfile: { specialty: 'General Practice', fee: 0 },
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ user: initialUser, setUser })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

test.each([PatientProfile, AdminProfile])('%s clears the previous account photo when account identity changes', Profile => {
  useAuth.mockReturnValue({ user: { ...initialUser, id: 'first', avatar: 'data:image/png;base64,aW1hZ2U=' }, setUser })
  const view = openProfile(Profile)
  expect(screen.getByRole('img', { name: 'Profile' })).toBeInTheDocument()
  useAuth.mockReturnValue({ user: { ...initialUser, id: 'second', avatar: null }, setUser })
  view.rerender(<MemoryRouter><Profile /></MemoryRouter>)
  expect(screen.queryByRole('img', { name: 'Profile' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Upload Photo/ })).toBeInTheDocument()
})

test.each([PatientProfile, AdminProfile])('%s removes an uploaded photo and saves an empty avatar', async Profile => {
  const user = { ...initialUser, avatar: 'data:image/png;base64,aW1hZ2U=' }
  useAuth.mockReturnValue({ user, setUser })
  apiFetch.mockResolvedValue(reply({ success: true, user: { ...user, avatar: null } }))
  openProfile(Profile)
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  expect(screen.queryByRole('img', { name: 'Profile' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  await screen.findByText(/profile updated successfully!/i)
  expect(JSON.parse(apiFetch.mock.calls[0][1].body).avatar).toBeNull()
})

// The profile labels are visual siblings of their inputs in the current UI.
const field = label => screen.getByText(label, { selector: 'label' }).parentElement.querySelector('input, select, textarea')
const change = (label, value) => fireEvent.change(field(label), { target: { value } })
const reply = data => ({ json: async () => data })
const openProfile = (Profile = PatientProfile) => render(<MemoryRouter><Profile /></MemoryRouter>)

test('patient profile displays an unknown blood type accurately', () => {
  render(<MemoryRouter><PatientProfile /></MemoryRouter>)
  expect(screen.getByDisplayValue('Unknown')).toBeInTheDocument()
})

test('a doctor with a zero consultation fee keeps that saved fee when opening profile settings', () => {
  render(<MemoryRouter><DoctorProfileSettings /></MemoryRouter>)
  expect(screen.getByRole('spinbutton')).toHaveValue(0)
})

test('patient can save their personal details while their login email remains read-only', async () => {
  const savedUser = { ...initialUser, name: 'Nora Patient', phone: '0712345678', dob: '1995-04-18', gender: 'Female', bloodType: 'A+', address: '10 Example Road' }
  apiFetch.mockResolvedValue(reply({ success: true, user: savedUser }))
  openProfile()
  expect(field('Email Address')).toBeDisabled()
  change('First Name', 'Nora')
  change('Last Name', 'Patient')
  change('Phone Number', savedUser.phone)
  change('Date of Birth', savedUser.dob)
  change('Gender', savedUser.gender)
  change('Blood Type', savedUser.bloodType)
  change('Address', savedUser.address)
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(await screen.findByText('Profile updated successfully!')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Nora Patient' })).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledWith('/api/auth/profile', expect.objectContaining({ method: 'PUT' }))
  const payload = JSON.parse(apiFetch.mock.calls[0][1].body)
  expect(payload).toEqual({ name: savedUser.name, phone: savedUser.phone, dob: savedUser.dob, gender: savedUser.gender, bloodType: savedUser.bloodType, address: savedUser.address, avatar: null })
  expect(payload).not.toHaveProperty('email')
  expect(setUser).toHaveBeenCalledWith(savedUser)
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
})

test.each([PatientProfile, DoctorProfileSettings, AdminProfile])('%s rejects unsupported and oversized avatar files before saving', async Profile => {
  apiFetch.mockResolvedValue(reply({ success: true, user: initialUser }))
  const { container } = openProfile(Profile)
  const fileInput = container.querySelector('input[type="file"]')
  fireEvent.change(fileInput, { target: { files: [new File(['private report'], 'report.pdf', { type: 'application/pdf' })] } })
  expect(screen.getByText('Choose a PNG, JPEG or WebP image up to 2 MB.')).toBeInTheDocument()
  const largeImage = new File(['image'], 'oversized.png', { type: 'image/png' })
  Object.defineProperty(largeImage, 'size', { value: 2 * 1024 * 1024 + 1 })
  fireEvent.change(fileInput, { target: { files: [largeImage] } })
  expect(screen.queryByRole('img', { name: 'Profile' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  await screen.findByText(/profile updated successfully!/i)
  expect(JSON.parse(apiFetch.mock.calls[0][1].body).avatar).toBeNull()
})

test.each([PatientProfile, DoctorProfileSettings, AdminProfile])('%s previews and saves a supported avatar image', async Profile => {
  apiFetch.mockResolvedValue(reply({ success: true, user: initialUser }))
  const { container } = openProfile(Profile)
  const fileInput = container.querySelector('input[type="file"]')
  const click = vi.spyOn(fileInput, 'click')
  fireEvent.click(screen.getByRole('button', { name: /(?:Upload|Change) Photo/ }))
  expect(click).toHaveBeenCalledOnce()
  fireEvent.change(fileInput, { target: { files: [new File(['qa-image'], 'avatar.png', { type: 'image/png' })] } })
  const image = await screen.findByRole('img', { name: 'Profile' })
  expect(image.getAttribute('src')).toMatch(/^data:image\/png;base64,/)
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  await screen.findByText(/profile updated successfully!/i)
  expect(JSON.parse(apiFetch.mock.calls[0][1].body).avatar).toBe(image.getAttribute('src'))
})

test.each([PatientProfile, DoctorProfileSettings])('%s displays a rejected save without overwriting the signed-in user', async Profile => {
  apiFetch.mockResolvedValue(reply({ success: false, message: 'Please provide a valid phone number.' }))
  openProfile(Profile)
  change('Phone Number', 'invalid')
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(await screen.findByText('Please provide a valid phone number.')).toBeInTheDocument()
  expect(setUser).not.toHaveBeenCalled()
  expect(field('Phone Number')).toHaveValue('invalid')
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
})

test.each([PatientProfile, DoctorProfileSettings])('%s keeps edited details available after a connection failure', async Profile => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  apiFetch.mockRejectedValue(new Error('Connection unavailable'))
  openProfile(Profile)
  change('Address', '22 Saved Draft Road')
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(await screen.findByText('An error occurred while saving.')).toBeInTheDocument()
  expect(field('Address')).toHaveValue('22 Saved Draft Road')
  expect(setUser).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
})

test('doctor saves professional details without requiring password confirmation for an unchanged email', async () => {
  const doctorUser = { ...initialUser, name: 'Dr. Nora Example', doctorProfile: { specialty: 'General Practice', fee: 0 } }
  useAuth.mockReturnValue({ user: doctorUser, setUser })
  const savedUser = { ...doctorUser, name: 'Dr. Nora Clinician', doctorProfile: { specialty: 'Cardiology', fee: 125, experience: '8+ Years', location: 'Example Clinic', bio: 'Cardiology consultations.' } }
  apiFetch.mockResolvedValue(reply({ success: true, user: savedUser }))
  openProfile(DoctorProfileSettings)
  expect(field('First Name')).toHaveValue('Dr. Nora')
  change('Last Name', 'Clinician')
  change('Specialty', 'Cardiology')
  expect(screen.getByRole('spinbutton')).toBeDisabled()
  change('Experience', '8+ Years')
  change('Clinic Location', 'Example Clinic')
  change('Professional Bio', 'Cardiology consultations.')
  change('Phone Number', '0711111111')
  change('Address', 'Example Clinic Road')
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(await screen.findByText('Profile updated successfully!')).toBeInTheDocument()
  const payload = JSON.parse(apiFetch.mock.calls[0][1].body)
  expect(payload).toMatchObject({ name: 'Dr. Nora Clinician', email: initialUser.email, specialty: 'Cardiology', experience: '8+ Years', location: 'Example Clinic', bio: 'Cardiology consultations.', phone: '0711111111', address: 'Example Clinic Road' })
  expect(payload).not.toHaveProperty('fee')
  expect(payload).not.toHaveProperty('currentPassword')
  expect(setUser).toHaveBeenCalledWith(savedUser)
})

test('doctor email change sends password confirmation and displays an incorrect-password response before retry', async () => {
  apiFetch.mockResolvedValueOnce(reply({ success: false, message: 'Current password is incorrect' }))
    .mockResolvedValueOnce(reply({ success: true, user: { ...initialUser, email: 'new-email@qa.example' } }))
  openProfile(DoctorProfileSettings)
  change('Email Address', 'new-email@qa.example')
  const confirmation = screen.getByLabelText('Confirm your current password to change email')
  fireEvent.change(confirmation, { target: { value: 'incorrect-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
  expect(setUser).not.toHaveBeenCalled()
  expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({ email: 'new-email@qa.example', currentPassword: 'incorrect-password' })
  fireEvent.change(confirmation, { target: { value: 'valid-current-passphrase' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(await screen.findByText('Profile updated successfully!')).toBeInTheDocument()
  expect(JSON.parse(apiFetch.mock.calls[1][1].body).currentPassword).toBe('valid-current-passphrase')
  expect(confirmation).toHaveValue('')
  expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'new-email@qa.example' }))
})

const enterDoctorPassword = (confirmation = 'a-new-safe-passphrase') => {
  fireEvent.change(screen.getByPlaceholderText('Enter current password'), { target: { value: 'current-safe-passphrase' } })
  fireEvent.change(screen.getByPlaceholderText('At least 10 characters'), { target: { value: 'a-new-safe-passphrase' } })
  fireEvent.change(screen.getByPlaceholderText('Repeat new password'), { target: { value: confirmation } })
}

test('doctor password confirmation must match before any request is sent', () => {
  openProfile(DoctorProfileSettings)
  enterDoctorPassword('different-safe-passphrase')
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))
  expect(screen.getByText('New passwords do not match.')).toBeInTheDocument()
  expect(apiFetch).not.toHaveBeenCalled()
})

test('doctor can change their password and all password fields clear after success', async () => {
  apiFetch.mockResolvedValue(reply({ success: true }))
  openProfile(DoctorProfileSettings)
  enterDoctorPassword()
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))
  expect(await screen.findByText('Password updated successfully!')).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledWith('/api/auth/password', expect.objectContaining({ method: 'PUT' }))
  expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ currentPassword: 'current-safe-passphrase', newPassword: 'a-new-safe-passphrase' })
  expect(screen.getByPlaceholderText('Enter current password')).toHaveValue('')
  expect(screen.getByPlaceholderText('At least 10 characters')).toHaveValue('')
  expect(screen.getByPlaceholderText('Repeat new password')).toHaveValue('')
})

test.each([
  [{ success: false, message: 'Current password is incorrect' }, 'Current password is incorrect'],
  [{ success: false, errors: [{ msg: 'Choose a less common password' }] }, 'Choose a less common password'],
])('doctor sees password rejection and retains fields for correction: %s', async (data, message) => {
  apiFetch.mockResolvedValue(reply(data))
  openProfile(DoctorProfileSettings)
  enterDoctorPassword()
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))
  expect(await screen.findByText(message)).toBeInTheDocument()
  expect(screen.getByPlaceholderText('At least 10 characters')).toHaveValue('a-new-safe-passphrase')
  expect(screen.getByRole('button', { name: 'Update Password' })).toBeEnabled()
})

test('doctor can retry a password change after a network error', async () => {
  apiFetch.mockRejectedValue(new Error('Connection unavailable'))
  openProfile(DoctorProfileSettings)
  enterDoctorPassword()
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))
  expect(await screen.findByText('An error occurred.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Update Password' })).toBeEnabled()
})
