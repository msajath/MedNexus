import { test, expect } from './fixtures.js'
import { randomUUID } from 'node:crypto'

const password = 'QA-password-123456'
const headers = { 'X-MedNexus-Request': '1' }
const uniqueEmail = (testInfo, prefix) => `${prefix}-${testInfo.project.name}-${Date.now()}@qa.example`
const register = async (page, email, role = 'patient') => {
  const response = await page.request.post('/api/auth/register', { headers, data: { name: `Workflow ${role}`, email, password, role, ...(role === 'doctor' ? { licenseNumber: 'QA-LICENSE' } : {}) } })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()).user
}
const openMenu = async page => {
  const button = page.getByRole('button', { name: 'Open navigation menu' })
  if (await button.isVisible()) await button.click()
}

test('registration validates input, rejects duplicate email, and persists a patient session', async ({ page }, testInfo) => {
  const email = uniqueEmail(testInfo, 'register')
  await page.goto('/register')
  await page.getByLabel('First Name').fill('Workflow')
  await page.getByLabel('Last Name').fill('Patient')
  await page.getByLabel('Email Address').fill(email)
  await page.locator('#password').fill('short')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create Account', exact: true }).click()
  expect(await page.locator('#password').evaluate(input => input.validity.tooShort)).toBe(true)
  await expect(page).toHaveURL(/\/register$/)

  await page.locator('#password').fill('password123')
  const rejected = page.waitForResponse(response => response.url().endsWith('/api/auth/register') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Create Account', exact: true }).click()
  expect((await rejected).status()).toBe(400)
  await expect(page.getByText('Choose a less common password that is different from your name or email')).toBeVisible()

  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Create Account', exact: true }).click()
  await expect(page).toHaveURL(/\/patient\/appointments$/)
  const identity = await (await page.request.get('/api/auth/me')).json()
  expect(identity.user.email).toBe(email)
  expect(identity.user.role).toBe('patient')
  expect(identity.user.password).toBeUndefined()
  await page.reload()
  await expect(page.locator('#my-appointments')).toBeVisible()
  // This check reruns in the new document if Vite finishes a development reload.
  await page.waitForFunction(() => localStorage.getItem('token') === null, undefined, { timeout: 5000 })

  await openMenu(page)
  await page.getByRole('button', { name: /Logout/i }).click()
  await expect(page).toHaveURL(/\/(?:login)?$/)
  expect((await page.request.get('/api/auth/me')).status()).toBe(401)
  await page.goto('/register')
  await page.getByLabel('First Name').fill('Duplicate')
  await page.getByLabel('Last Name').fill('Patient')
  await page.getByLabel('Email Address').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create Account', exact: true }).click()
  await expect(page.getByText('User already exists with this email')).toBeVisible()
})

test('doctor self-registration creates a pending doctor profile without public verification', async ({ page }, testInfo) => {
  const email = uniqueEmail(testInfo, 'doctor-registration')
  await page.goto('/register')
  await page.getByRole('button', { name: /Doctor$/ }).click()
  await page.getByLabel('First Name').fill('Workflow')
  await page.getByLabel('Last Name').fill('Doctor')
  await page.getByLabel('Email Address').fill(email)
  await page.locator('#password').fill(password)
  await page.getByLabel('Medical License Number').fill('QA-SELF-REGISTERED')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create Account', exact: true }).click()
  await expect(page).toHaveURL(/\/doctor\/dashboard$/)
  await page.reload()
  await expect(page.locator('#doctor-dashboard')).toBeVisible()
  const current = (await (await page.request.get('/api/auth/me')).json()).user
  expect(current.role).toBe('doctor')
  expect(current.doctorProfile.licenseNumber).toBe('QA-SELF-REGISTERED')
  const listing = await (await page.request.get('/api/doctors')).json()
  expect(listing.doctors.some(doctor => (doctor._id || doctor.id) === current.doctorProfile._id)).toBe(false)
})

test('patient, doctor, and administrator sign in through their actual forms and retain their role on refresh', async ({ page }) => {
  for (const role of ['patient', 'doctor', 'admin']) {
    await page.context().clearCookies()
    await page.goto(role === 'admin' ? '/admin/login' : '/login')
    await page.getByPlaceholder(role === 'admin' ? 'admin@mednexus.com' : 'Enter your email').fill(`${role}@qa.example`)
    await page.getByPlaceholder('Enter your password').fill(password)
    await page.getByRole('button', { name: role === 'admin' ? 'Sign in to Admin Panel' : 'Sign In', exact: true }).click()
    await expect(page).toHaveURL(role === 'patient' ? /\/patient\/appointments$/ : new RegExp(`/${role}/dashboard$`))
    await page.reload()
    expect((await (await page.request.get('/api/auth/me')).json()).user.role).toBe(role)
    await expect(page.locator('#dashboard-sidebar')).toBeAttached()
  }
})

test('invalid credentials and inactive accounts show safe errors and do not acquire a session', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email Address').fill('patient@qa.example')
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.getByText('Invalid email or password', { exact: true })).toBeVisible()
  expect((await page.request.get('/api/auth/me')).status()).toBe(401)

  await page.getByLabel('Email Address').fill('inactive@qa.example')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.getByText('Invalid email or password', { exact: true })).toBeVisible()
  await page.goto('/patient/records')
  await expect(page).toHaveURL(/\/login$/)
})

test('an invalidated session redirects an already open protected page to reauthentication', async ({ page }, testInfo) => {
  await register(page, uniqueEmail(testInfo, 'expired-session'))
  await page.goto('/patient/appointments')
  await expect(page.locator('#my-appointments')).toBeVisible()
  await page.context().clearCookies()
  await openMenu(page)
  const rejected = page.waitForResponse(response => response.url().endsWith('/api/messages') && response.status() === 401)
  await page.getByRole('link', { name: /Messages$/ }).click()
  expect((await (await rejected).json()).code).toBe('AUTH_SESSION_INVALID')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible()
})

test('password reset delivers a real test email, changes the password once, and revokes the old session', async ({ page }, testInfo) => {
  const email = uniqueEmail(testInfo, 'password-reset')
  await register(page, email)
  const session = (await page.context().cookies()).find(cookie => cookie.name === 'mednexus_session')
  expect(session.httpOnly).toBe(true)
  await page.goto('/forgot-password')
  await page.getByLabel('Email Address').fill(email)
  const requested = page.waitForResponse(response => response.url().endsWith('/api/auth/forgot-password'))
  await page.getByRole('button', { name: 'Send Reset Code', exact: true }).click()
  expect((await requested).status()).toBe(200)
  await expect(page.getByText('If the email exists, a six-digit reset code has been sent. The code expires in 5 minutes.')).toBeVisible()
  const mailbox = await page.request.get(`http://127.0.0.1:5001/__qa/mail?email=${encodeURIComponent(email)}`)
  expect(mailbox.ok()).toBe(true)
  const messages = (await mailbox.json()).messages
  expect(messages).toHaveLength(1)
  const code = messages[0].text.match(/reset code is: (\d{6})/)[1]
  expect(messages[0].subject).toContain('password reset code')
  expect(messages[0].text).toContain('expires in 5 minutes')
  expect(JSON.stringify(await (await requested).json())).not.toContain(code)
  const changedPassword = `Clinic-${randomUUID()}`
  await page.getByLabel('Reset Code', { exact: true }).fill(code)
  await page.getByLabel('New Password', { exact: true }).fill(changedPassword)
  await page.getByLabel('Confirm Password', { exact: true }).fill('Mismatched-passphrase-123')
  await page.getByRole('button', { name: 'Reset Password', exact: true }).click()
  await expect(page.getByText(/Passwords do not match/)).toBeVisible()
  await page.getByLabel('Confirm Password', { exact: true }).fill(changedPassword)
  await page.getByRole('button', { name: 'Reset Password', exact: true }).click()
  await expect(page.getByText('Your password has been reset. You can now sign in.')).toBeVisible()
  expect((await page.request.get('/api/auth/me', { headers: { Cookie: `${session.name}=${session.value}` } })).status()).toBe(401)
  const replay = await page.request.post('/api/auth/reset-password', { headers, data: { email, resetCode: code, newPassword: changedPassword } })
  expect(replay.status()).toBe(400)
  expect((await replay.json()).message).toBe('Invalid or expired reset code')
  const oldLogin = await page.request.post('/api/auth/login', { headers, data: { email, password } })
  expect(oldLogin.status()).toBe(401)
  await page.goto('/login')
  await page.getByLabel('Email Address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(changedPassword)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page).toHaveURL(/\/patient\/appointments$/)
  await page.reload()
  expect((await (await page.request.get('/api/auth/me')).json()).user.email).toBe(email)
})
