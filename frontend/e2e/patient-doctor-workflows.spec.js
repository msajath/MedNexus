import { test, expect } from './fixtures.js'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { bookingDateKey, getBookingDays } from '../src/utils/bookingDates.js'

const password = 'QA-password-123456'
const mutationHeaders = { 'X-MedNexus-Request': '1' }
const field = (page, name) => page.locator('label').filter({ hasText: new RegExp(`^${name}$`) }).locator('..').locator('input, textarea, select').first()

test.beforeEach(async ({ baseURL }) => {
  const url = new URL(baseURL)
  expect(['127.0.0.1', 'localhost']).toContain(url.hostname)
  expect(url.port).toBe('5174')
})

async function registerPatient(page) {
  const suffix = randomUUID()
  const name = `Workflow Patient ${suffix.slice(0, 8)}`
  const email = `workflow-${suffix}@qa.example`
  const response = await page.request.post('/api/auth/register', { headers: mutationHeaders, data: { name, email, password } })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()).user
}

async function loginDoctor(page) {
  const response = await page.request.post('/api/auth/login', { headers: mutationHeaders, data: { email: 'doctor@qa.example', password } })
  expect(response.ok(), await response.text()).toBe(true)
}

async function doctorAndSlot(page, count = 1) {
  const response = await page.request.get('/api/doctors')
  expect(response.ok()).toBe(true)
  const doctor = (await response.json()).doctors.find(item => item.name === 'QA doctor')
  expect(doctor).toBeDefined()
  const doctorId = doctor._id || doctor.id
  const days = getBookingDays(10)
  // Avoid time-sensitive same-day slots and use the same clinic dates as the UI.
  for (let index = 1; index < days.length; index++) {
    const date = bookingDateKey(days[index])
    const slotsResponse = await page.request.get(`/api/availability/slots/${doctorId}/${date}`)
    expect(slotsResponse.ok()).toBe(true)
    const data = await slotsResponse.json()
    const slots = Object.values(data.slots).flat().filter(slot => !data.bookedSlots.includes(slot))
    if (slots.length >= count) return { doctorId, date, index, slots, day: days[index].toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) }
  }
  throw new Error('No unbooked future weekday slots available in the disposable QA data')
}

async function selectBooking(page, booking, slot) {
  await page.goto(`/book/${booking.doctorId}`)
  const days = page.locator('#book-appointment button').filter({ hasText: /^(Mon|Tue|Wed|Thu|Fri)\s*\d/ })
  await expect(days).toHaveCount(10)
  const slotsPromise = page.waitForResponse(response => response.url().includes(`/api/availability/slots/${booking.doctorId}/${booking.date}`))
  await days.nth(booking.index).click()
  expect((await slotsPromise).ok()).toBe(true)
  await expect(page.getByText('Loading available slots...', { exact: true })).toBeHidden()
  // The slot may belong to another time period.
  for (const period of ['Morning', 'Afternoon', 'Evening']) {
    await page.getByRole('button', { name: new RegExp(`${period}$`) }).click()
    if (await page.getByRole('button', { name: slot, exact: true }).count()) break
  }
  await page.getByRole('button', { name: slot, exact: true }).click()
}

async function bookFromUi(page, booking, slot) {
  await selectBooking(page, booking, slot)
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/appointments') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Confirm Booking', exact: true }).click()
  const response = await responsePromise
  expect(response.status(), await response.text()).toBe(201)
  await expect(page.getByText('Appointment Booked!', { exact: true })).toBeVisible()
  return (await response.json()).appointment
}

test('patient profile edits persist after refresh and invalid input leaves saved data intact', async ({ page }) => {
  await registerPatient(page)
  await page.goto('/patient/profile')
  await expect(page.locator('#patient-profile')).toBeVisible()
  await expect(field(page, 'Blood Type')).toHaveValue('Unknown')
  await field(page, 'Phone Number').fill('0771234567')
  await field(page, 'Address').fill('Synthetic QA address')
  await field(page, 'Date of Birth').fill('1995-06-15')
  const save = page.waitForResponse(response => response.url().endsWith('/api/auth/profile') && response.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  expect((await save).ok()).toBe(true)
  await expect(page.getByText('Profile updated successfully!', { exact: true })).toBeVisible()
  await page.reload()
  await expect(field(page, 'Phone Number')).toHaveValue('0771234567')
  await expect(field(page, 'Address')).toHaveValue('Synthetic QA address')
  await expect(field(page, 'Date of Birth')).toHaveValue('1995-06-15')
  await field(page, 'Address').fill('a'.repeat(1001))
  const invalidSave = page.waitForResponse(response => response.url().endsWith('/api/auth/profile') && response.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  expect((await invalidSave).status()).toBe(400)
  await expect(page.getByText('Error updating profile.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(field(page, 'Address')).toHaveValue('Synthetic QA address')
})

test('doctor discovery filters real data and opens a profile with weekday booking slots', async ({ page }) => {
  await page.goto('/doctors')
  await page.getByRole('searchbox', { name: 'Search doctors' }).fill('QA doctor')
  await expect(page.getByRole('heading', { name: 'QA doctor', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Specialty', exact: true }).selectOption('General Practice')
  await page.getByRole('searchbox', { name: 'Search doctors' }).fill('no-doctor-matches-this')
  await expect(page.getByText('No doctors found matching your criteria.', { exact: true })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search doctors' }).fill('QA doctor')
  await page.getByRole('heading', { name: 'QA doctor', exact: true }).click()
  await expect(page).toHaveURL(/\/doctors\/[a-f\d]{24}$/)
  await expect(page.locator('#doctor-profile').getByRole('heading', { level: 1 })).toContainText('QA doctor')
  await expect(page.getByRole('button', { name: /^(Sat|Sun)\s*\d/i })).toHaveCount(0)
  const booking = await doctorAndSlot(page)
  await page.getByRole('button', { name: /^(Mon|Tue|Wed|Thu|Fri)\s*\d/i }).nth(booking.index).click()
  await expect(page.getByRole('button', { name: booking.slots[0], exact: true })).toBeEnabled()
})

test('doctor profile saves a zero consultation fee without replacing it on reload or a later edit', async ({ page }) => {
  await loginDoctor(page)
  const me = (await (await page.request.get('/api/auth/me')).json()).user
  const original = { fee: me.doctorProfile.fee, location: me.doctorProfile.location }
  try {
    await page.goto('/doctor/profile')
    await page.getByRole('spinbutton').fill('0')
    const firstSave = page.waitForResponse(response => response.url().endsWith('/api/auth/profile') && response.request().method() === 'PUT')
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
    const response = await firstSave
    expect(response.ok(), await response.text()).toBe(true)
    expect((await response.json()).user.doctorProfile.fee).toBe(0)
    await page.reload()
    await expect(page.getByRole('spinbutton')).toHaveValue('0')
    await field(page, 'Clinic Location').fill('Synthetic QA clinic')
    const laterSave = page.waitForResponse(result => result.url().endsWith('/api/auth/profile') && result.request().method() === 'PUT')
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
    expect((await laterSave).ok()).toBe(true)
    await page.reload()
    await expect(page.getByRole('spinbutton')).toHaveValue('0')
    await expect(field(page, 'Clinic Location')).toHaveValue('Synthetic QA clinic')
    const doctors = (await (await page.request.get('/api/doctors')).json()).doctors
    expect(doctors.find(doctor => (doctor._id || doctor.id) === me.doctorProfile._id).fee).toBe(0)
  } finally {
    const restored = await page.request.put('/api/auth/profile', { headers: mutationHeaders, data: original })
    expect(restored.ok()).toBe(true)
  }
})

test('doctor availability changes reach patients and appointment confirmation/completion persists across roles', async ({ page, newContext }) => {
  const patient = await registerPatient(page)
  const doctorContext = await newContext()
  const doctorPage = await doctorContext.newPage()
  await loginDoctor(doctorPage)
  const booking = await doctorAndSlot(page)
  const original = (await (await doctorPage.request.get(`/api/availability/${booking.doctorId}`)).json()).schedule
  let appointment
  try {
    appointment = await bookFromUi(page, booking, booking.slots[0])
    await doctorPage.goto('/doctor/availability')
    const dayRow = doctorPage.getByText(booking.day, { exact: true }).locator('..').locator('..')
    await expect(dayRow.getByRole('checkbox')).toBeChecked()
    await dayRow.locator('label').first().click()
    const savePromise = doctorPage.waitForResponse(response => response.url().endsWith('/api/availability') && response.request().method() === 'PUT')
    doctorPage.once('dialog', dialog => dialog.accept())
    await doctorPage.getByRole('button', { name: 'Save Changes', exact: true }).click()
    expect((await savePromise).ok()).toBe(true)
    await doctorPage.reload()
    await expect(dayRow.getByRole('checkbox')).not.toBeChecked()
    const closedSlots = await (await page.request.get(`/api/availability/slots/${booking.doctorId}/${booking.date}`)).json()
    expect(Object.values(closedSlots.slots).flat()).toEqual([])
    await doctorPage.goto('/doctor/appointments')
    const card = doctorPage.getByRole('heading', { name: patient.name, exact: true }).locator('..').locator('..').locator('..').locator('..')
    await expect(card.getByText('Pending', { exact: true })).toBeVisible()
    await card.getByRole('button', { name: /Confirm$/ }).click()
    await expect(card.getByText('Confirmed', { exact: true })).toBeVisible()
    await doctorPage.reload()
    await expect(card.getByText('Confirmed', { exact: true })).toBeVisible()
    await page.goto('/patient/appointments')
    await expect(page.getByRole('cell', { name: 'Confirmed', exact: true })).toBeVisible()
    await card.getByRole('button', { name: /Complete$/ }).click()
    await expect(card.getByText('Completed', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('cell', { name: 'Completed', exact: true })).toBeVisible()
    const stored = (await (await page.request.get('/api/appointments/my')).json()).appointments
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ id: appointment._id, status: 'completed', date: booking.date, time: booking.slots[0] })
  } finally {
    const restored = await doctorPage.request.put('/api/availability', { headers: mutationHeaders, data: { schedule: original } })
    expect(restored.ok()).toBe(true)
    if (appointment) await page.request.put(`/api/appointments/${appointment._id}/cancel`, { headers: mutationHeaders })
    await doctorContext.close()
  }
})

test('private uploaded reports retain exact file contents after refresh and remain hidden from another patient', async ({ page, newContext }, testInfo) => {
  const patient = await registerPatient(page)
  const title = `Private report ${randomUUID()}`
  const contents = Buffer.from('%PDF-1.4\nSynthetic private patient report\n%%EOF')
  await page.goto('/patient/records')
  await page.getByRole('button', { name: /Add Record/ }).click()
  await page.getByPlaceholder('e.g. Blood Test Report June 2025').fill(title)
  await page.getByLabel('Upload patient report').setInputFiles({ name: 'private-qa.pdf', mimeType: 'application/pdf', buffer: contents })
  await page.getByRole('checkbox', { name: /Keep this record private/ }).check()
  const createPromise = page.waitForResponse(response => response.url().endsWith('/api/records') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Save Record', exact: true }).click()
  const response = await createPromise
  expect(response.status(), await response.text()).toBe(201)
  const record = (await response.json()).record
  expect(record).toMatchObject({ title, isPrivate: true, addedBy: 'patient' })
  await page.reload()
  await page.getByText(title, { exact: true }).first().click()
  await expect(page.getByText(/Private: Hidden from all doctors \(only visible to you\)$/)).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /private-qa\.pdf/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('private-qa.pdf')
  const downloadPath = testInfo.outputPath('private-qa.pdf')
  await download.saveAs(downloadPath)
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  expect(Buffer.concat(chunks)).toEqual(contents)
  const otherContext = await newContext()
  try {
    const otherPage = await otherContext.newPage()
    await registerPatient(otherPage)
    const otherRecords = (await (await otherPage.request.get('/api/records/my')).json()).records
    expect(otherRecords.some(item => item._id === record._id)).toBe(false)
    const forbidden = await otherPage.request.delete(`/api/records/${record._id}`, { headers: mutationHeaders })
    expect(forbidden.status()).toBe(403)
  } finally { await otherContext.close() }
  // Doctor record APIs exist without a corresponding doctor-side editor. Verify
  // the real treatment/privacy contract and patient rendering explicitly.
  const doctorContext = await newContext()
  try {
    const doctorPage = await doctorContext.newPage()
    await loginDoctor(doctorPage)
    const booking = await doctorAndSlot(page)
    const booked = await page.request.post('/api/appointments', { headers: mutationHeaders, data: { doctorId: booking.doctorId, date: booking.date, time: booking.slots[0] } })
    expect(booked.status(), await booked.text()).toBe(201)
    const appointment = (await booked.json()).appointment
    const confirmed = await doctorPage.request.put(`/api/appointments/${appointment._id}/status`, { headers: mutationHeaders, data: { status: 'confirmed' } })
    expect(confirmed.ok()).toBe(true)
    const clinicalRecords = await doctorPage.request.get(`/api/records/patient/${patient.id}`)
    expect(clinicalRecords.ok()).toBe(true)
    expect((await clinicalRecords.json()).records.some(item => item._id === record._id)).toBe(false)
    const clinicalTitle = `Clinical record ${randomUUID()}`
    const clinical = await doctorPage.request.post('/api/records/doctor-add', { headers: mutationHeaders, data: { patientId: patient.id, appointmentId: appointment._id, title: clinicalTitle, type: 'Diagnosis', diagnosis: 'Synthetic QA diagnosis' } })
    expect(clinical.status(), await clinical.text()).toBe(201)
    await page.reload()
    const clinicalRow = page.getByRole('heading', { name: clinicalTitle, exact: true }).first().locator('..').locator('..').locator('..')
    await expect(clinicalRow.getByTitle('Delete', { exact: true })).toHaveCount(0)
    await page.getByText(clinicalTitle, { exact: true }).first().click()
    await expect(page.getByText('Synthetic QA diagnosis', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Delete Record$/ })).toHaveCount(0)
    const cancellation = await page.request.put(`/api/appointments/${appointment._id}/cancel`, { headers: mutationHeaders })
    expect(cancellation.ok()).toBe(true)
  } finally { await doctorContext.close() }
  await page.getByText(title, { exact: true }).first().click()
  page.once('dialog', dialog => dialog.accept())
  const removePromise = page.waitForResponse(result => result.url().endsWith(`/api/records/${record._id}`) && result.request().method() === 'DELETE')
  await page.getByRole('button', { name: /Delete Record$/ }).click()
  expect((await removePromise).ok()).toBe(true)
  await page.reload()
  await expect(page.getByText(title, { exact: true })).toHaveCount(0)
})

test('competing patient browser bookings produce one appointment and a truthful conflict state', async ({ page, newContext }) => {
  await registerPatient(page)
  const otherContext = await newContext()
  const otherPage = await otherContext.newPage()
  try {
    await registerPatient(otherPage)
    const booking = await doctorAndSlot(page)
    await Promise.all([selectBooking(page, booking, booking.slots[0]), selectBooking(otherPage, booking, booking.slots[0])])
    const responses = [page, otherPage].map(candidate => candidate.waitForResponse(response => response.url().endsWith('/api/appointments') && response.request().method() === 'POST'))
    await Promise.all([page, otherPage].map(candidate => candidate.getByRole('button', { name: 'Confirm Booking', exact: true }).click()))
    const results = await Promise.all(responses)
    expect(results.filter(response => response.status() === 201)).toHaveLength(1)
    const conflict = results.find(response => response.status() !== 201)
    // A preflight conflict is 400; a simultaneous unique-index collision is 409.
    expect([400, 409]).toContain(conflict.status())
    expect((await conflict.json()).message).toBe('This time slot is already booked')
    const winner = [page, otherPage][results.findIndex(response => response.status() === 201)]
    const loser = [page, otherPage][results.findIndex(response => response.status() !== 201)]
    await expect(winner.getByText('Appointment Booked!', { exact: true })).toBeVisible()
    await expect(loser.getByRole('alert')).toHaveText('This time slot is already booked')
    await expect(loser.getByText('Appointment Booked!', { exact: true })).toHaveCount(0)
    const lists = await Promise.all([page, otherPage].map(async candidate => (await (await candidate.request.get('/api/appointments/my')).json()).appointments))
    expect(lists.flat()).toHaveLength(1)
    const appointment = lists.flat()[0]
    expect(appointment).toMatchObject({ date: booking.date, time: booking.slots[0], status: 'pending' })
    const cancellation = await winner.request.put(`/api/appointments/${appointment.id}/cancel`, { headers: mutationHeaders })
    expect(cancellation.ok()).toBe(true)
    await winner.reload()
    const persisted = (await (await winner.request.get('/api/appointments/my')).json()).appointments
    expect(persisted).toHaveLength(1)
    expect(persisted[0].status).toBe('cancelled')
  } finally { await otherContext.close() }
})
