import { test, expect } from './fixtures.js'
import { Buffer } from 'node:buffer'
import { bookingDateKey, getBookingDays } from '../src/utils/bookingDates.js'

const password = 'QA-password-123456'
const login = async (page, role) => {
  const response = await page.request.post('/api/auth/login', { data: { email: `${role}@qa.example`, password }, headers: { 'X-MedNexus-Request': '1' } })
  expect(response.ok()).toBe(true)
}

test('public pages, doctor search and mobile navigation render without runtime errors', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  for (const route of ['/', '/about', '/contact', '/doctors', '/login', '/register', '/forgot-password', '/admin/login']) {
    await page.goto(route)
    await expect(page.locator('#root')).not.toBeEmpty()
    await expect(page.locator('h1, h2').first()).toBeVisible()
  }
  await page.goto('/doctors')
  await page.getByPlaceholder('Search by name, specialty, or location...').fill('QA doctor')
  await expect(page.getByText('QA doctor', { exact: true }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('registration creates a cookie session, persists on reload, and logs out', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('First Name').fill('QA')
  await page.getByLabel('Last Name').fill('New Patient')
  await page.getByLabel('Email Address').fill(`new-${Date.now()}@qa.example`)
  await page.locator('#password').fill(password)
  await page.getByRole('checkbox').check()
  await page.locator('form button[type="submit"]').click()
  await expect(page).toHaveURL(/\/patient\/appointments/)
  await page.reload()
  await expect(page.locator('#my-appointments')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
  if (await page.getByRole('button', { name: 'Open navigation menu' }).isVisible()) await page.getByRole('button', { name: 'Open navigation menu' }).click()
  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page).toHaveURL(/\/($|login)/)
  await page.goto('/patient/records')
  await expect(page).toHaveURL(/\/login/)
})

test('role boundaries redirect patients away from administrator pages', async ({ page }) => {
  await login(page, 'patient')
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/admin\/login/)
})

test('patient messages can be marked read and medical records can be added and removed', async ({ page }) => {
  await login(page, 'patient')
  await page.goto('/patient/messages')
  await page.getByRole('button', { name: /QA welcome/ }).click()
  await expect(page.getByText('You have 0 unread messages')).toBeVisible()
  await page.goto('/patient/records')
  await page.getByRole('button', { name: /Add Record/ }).click()
  const recordTitle = `QA record ${Date.now()}`
  await page.getByPlaceholder('e.g. Blood Test Report June 2025').fill(recordTitle)
  await page.getByLabel('Upload patient report').setInputFiles({ name: 'qa-report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nQA report') })
  const uploadResponsePromise = page.waitForResponse(response => response.url().endsWith('/api/records') && response.request().method() === 'POST')
  await page.locator('form button[type="submit"]').click()
  const uploadResponse = await uploadResponsePromise
  expect(uploadResponse.ok(), await uploadResponse.text()).toBe(true)
  await expect(page.getByText('Report uploaded successfully!')).toBeVisible()
  await page.getByText(recordTitle, { exact: true }).first().click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /qa-report\.pdf/ }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('qa-report.pdf')
  page.on('dialog', dialog => dialog.accept())
  await page.getByTitle('Delete', { exact: true }).first().click()
  await expect(page.getByText(recordTitle, { exact: true })).toHaveCount(0)
})

test('doctor pages and availability saving work', async ({ page }) => {
  await login(page, 'doctor')
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  for (const route of ['/doctor/dashboard', '/doctor/appointments', '/doctor/profile', '/doctor/messages']) {
    await page.goto(route)
    await expect(page.locator('h1,h2').first()).toBeVisible()
  }
  await page.goto('/doctor/availability')
  page.on('dialog', dialog => { expect(dialog.message()).toContain('successfully'); dialog.accept() })
  await page.getByRole('button', { name: /Save/ }).click()
  expect(errors).toEqual([])
})

test('admin pages, real report download, and contact message triage work', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/dashboard')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Download Operations Report/ }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('mednexus-report.json')
  await page.getByRole('button', { name: 'Review Now' }).click()
  await expect(page).toHaveURL(/\/admin\/doctors/)
  for (const route of ['/admin/users', '/admin/appointments', '/admin/records', '/admin/doctors']) {
    await page.goto(route); await expect(page.locator('h1').first()).toBeVisible()
  }
  await page.goto('/admin/messages')
  await page.getByRole('button', { name: /QA contact/ }).click()
  await expect.poll(async () => {
    const result = await page.request.get('/api/admin/contact-messages');
    const data = await result.json();
    return data.messages.find(message => message.subject === 'QA contact').status;
  }).toBe('in-progress')
})

test('contact form submits successfully', async ({ page }) => {
  await page.goto('/contact')
  await page.getByLabel('Full Name').fill('QA Visitor')
  await page.getByLabel('Email Address').fill('visitor@qa.example')
  await page.getByLabel('Subject').fill('Browser QA')
  await page.getByLabel('Message', { exact: true }).fill('This is a browser QA support request.')
  await page.locator('form button[type="submit"]').click()
  await expect(page.getByRole('status')).toHaveText('Your message has been received')
})

test('a patient books, reschedules and cancels one appointment without duplicates', async ({ page }) => {
  await login(page, 'patient')
  const doctors = await (await page.request.get('/api/doctors')).json()
  const doctor = doctors.doctors.find(item => item.name === 'QA doctor')
  expect(doctor).toBeDefined()
  const doctorId = doctor._id || doctor.id
  let dateIndex, slots
  const bookingDays = getBookingDays(10)
  for (let index = 0; index < bookingDays.length; index++) {
    const day = bookingDateKey(bookingDays[index])
    const data = await (await page.request.get(`/api/availability/slots/${doctorId}/${day}`)).json()
    const available = data.slots.morning.filter(slot => !data.bookedSlots.includes(slot))
    if (available.length >= 2) { dateIndex = index; slots = available; break }
  }
  expect(dateIndex).toBeDefined()
  const choose = async (slot, button) => {
    await page.locator('#book-appointment button').filter({ hasText: /Mon|Tue|Wed|Thu|Fri/ }).nth(dateIndex).click()
    await page.getByRole('button', { name: slot, exact: true }).click()
    await page.getByRole('button', { name: button, exact: true }).click()
  }
  await page.goto(`/book/${doctorId}`)
  await choose(slots[0], 'Confirm Booking')
  await expect(page.getByText('Appointment Booked!')).toBeVisible()
  await page.goto('/patient/appointments')
  await page.getByRole('button', { name: 'Reschedule', exact: true }).click()
  await choose(slots[1], 'Confirm Reschedule')
  await expect(page.getByText('Appointment Rescheduled!')).toBeVisible()
  const appointments = await (await page.request.get('/api/appointments/my')).json()
  const active = appointments.appointments.filter(item => item.status === 'pending' || item.status === 'confirmed')
  expect(active).toHaveLength(1)
  expect(active[0].time).toBe(slots[1])
  await page.goto('/patient/appointments')
  page.on('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect.poll(async () => {
    const data = await (await page.request.get('/api/appointments/my')).json()
    return data.appointments.find(item => item.id === active[0].id).status
  }).toBe('cancelled')
})
