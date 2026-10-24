import { test, expect } from './fixtures.js'
import { Buffer } from 'node:buffer'
import { bookingDateKey, getBookingDays } from '../src/utils/bookingDates.js'

const password = 'QA-password-123456'
const requestHeaders = { 'X-MedNexus-Request': '1' }
const operationsEmail = 'operations-doctor@qa.example'
const checkedJson = async response => {
  expect(response.ok(), await response.text()).toBe(true)
  return response.json()
}
const signIn = async (page, email) => checkedJson(await page.request.post('/api/auth/login', {
  headers: requestHeaders, data: { email, password },
}))
const createPatient = async (newContext, name) => {
  const context = await newContext()
  const page = await context.newPage()
  await checkedJson(await page.request.post('/api/auth/register', {
    headers: requestHeaders, data: { name, email: `${name.toLowerCase().replaceAll(' ', '-')}-${Date.now()}@qa.example`, password, role: 'patient' },
  }))
  return { context, page }
}
const operationsDoctor = async page => {
  const data = await checkedJson(await page.request.get('/api/doctors'))
  const doctor = data.doctors.find(item => item.name === 'QA operations doctor')
  expect(doctor).toBeDefined()
  return doctor._id || doctor.id
}
const book = async (page, doctorId, startIndex = 15) => {
  for (const day of getBookingDays(70).slice(startIndex)) {
    const date = bookingDateKey(day)
    const available = await checkedJson(await page.request.get(`/api/availability/slots/${doctorId}/${date}`))
    const time = Object.values(available.slots).flat().find(slot => !available.bookedSlots.includes(slot))
    if (!time) continue
    const data = await checkedJson(await page.request.post('/api/appointments', {
      headers: requestHeaders,
      data: { doctorId, date, time, notes: 'PRIVATE_SYNTHETIC_CLINICAL_NOTES', symptoms: 'PRIVATE_SYNTHETIC_SYMPTOMS' },
    }))
    return data.appointment
  }
  throw new Error('No disposable appointment slot was available')
}
const readDownload = async download => {
  const chunks = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
const requestFor = (page, path, method) => page.waitForResponse(response => response.url().endsWith(path) && response.request().method() === method)

test('completion automatically credits the booked fee once, supports a reversal, and exports a redacted operations report', async ({ page, newContext }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const patient = await createPatient(newContext, 'QA Receipt Patient')
  const doctorContext = await newContext()
  const doctorPage = await doctorContext.newPage()
  try {
    const doctorId = await operationsDoctor(patient.page)
    const appointment = await book(patient.page, doctorId)
    await signIn(page, 'admin@qa.example')
    await signIn(doctorPage, operationsEmail)
    const before = (await checkedJson(await doctorPage.request.get('/api/payments/my'))).earnings
    await page.goto('/admin/appointments')
    await page.getByRole('searchbox', { name: 'Search appointments' }).fill(appointment._id)
    const row = page.getByRole('row').filter({ hasText: appointment._id })
    await expect(row.getByText('Record received payment', { exact: true })).toHaveCount(0)
    const status = row.getByRole('combobox')
    let saved = requestFor(page, `/api/admin/appointments/${appointment._id}/status`, 'PUT')
    await status.selectOption('confirmed')
    expect((await saved).ok()).toBe(true)
    await expect(status).toHaveValue('confirmed')
    saved = requestFor(page, `/api/admin/appointments/${appointment._id}/status`, 'PUT')
    await status.selectOption('completed')
    expect((await saved).ok()).toBe(true)
    await expect(row.getByText('Earnings credited', { exact: true })).toBeVisible()
    const paymentPath = `/api/admin/appointments/${appointment._id}/status`
    expect((await page.request.put(paymentPath, { headers: requestHeaders, data: { status: 'completed' } })).ok()).toBe(true)
    const receipts = await checkedJson(await page.request.get(`/api/admin/payments?appointmentId=${appointment._id}`))
    expect(receipts.payments).toHaveLength(1)
    const payment = receipts.payments[0]
    expect(payment).toMatchObject({ appointmentId: appointment._id, amount: appointment.feeAtBooking, method: 'auto_credit', status: 'received' })
    await page.reload()
    await page.getByRole('searchbox', { name: 'Search appointments' }).fill(appointment._id)
    await expect(row.getByText(payment.id, { exact: true })).toBeVisible()
    await doctorPage.goto('/doctor/dashboard')
    const earningsCard = doctorPage.getByText('Consultation Earnings', { exact: true }).locator('..')
    await expect(earningsCard.getByText(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(before.netReceived + appointment.feeAtBooking), { exact: true })).toBeVisible()
    const after = (await checkedJson(await doctorPage.request.get('/api/payments/my'))).earnings
    expect(after.netReceived).toBeCloseTo(before.netReceived + appointment.feeAtBooking, 2)
    expect((await patient.page.request.post(`/api/admin/payments/${payment.id}/refund`, { headers: requestHeaders, data: { reason: 'Unauthorized attempt' } })).status()).toBe(403)
    await row.getByText('Reverse earnings credit', { exact: true }).click()
    const refundForm = row.getByRole('form', { name: 'Record refund for QA Receipt Patient' })
    await refundForm.getByLabel('Refund reason for QA Receipt Patient').fill('Synthetic full refund already issued outside this site')
    await refundForm.getByRole('checkbox').check()
    const refundResult = requestFor(page, `/api/admin/payments/${payment.id}/refund`, 'POST')
    await refundForm.getByRole('button', { name: 'Reverse credit' }).click()
    expect((await refundResult).status()).toBe(200)
    await expect(row.getByText('Refunded', { exact: true })).toBeVisible()
    await page.reload()
    await page.getByRole('searchbox', { name: 'Search appointments' }).fill(appointment._id)
    await expect(row.getByText('Synthetic full refund already issued outside this site')).toBeVisible()
    const duplicateRefund = await page.request.post(`/api/admin/payments/${payment.id}/refund`, { headers: requestHeaders, data: { reason: 'Duplicate refund' } })
    expect(duplicateRefund.status()).toBe(409)
    const persisted = await checkedJson(await page.request.get(`/api/admin/payments?appointmentId=${appointment._id}`))
    expect(persisted.payments).toHaveLength(1)
    expect(persisted.payments[0]).toMatchObject({ id: payment.id, status: 'refunded', amount: appointment.feeAtBooking })
    await doctorPage.reload()
    const net = (await checkedJson(await doctorPage.request.get('/api/payments/my'))).earnings.netReceived
    expect(net).toBe(before.netReceived)
    await expect(earningsCard.getByText(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(net), { exact: true })).toBeVisible()
    await page.goto('/admin/dashboard')
    const expectedStats = await checkedJson(await page.request.get('/api/admin/stats'))
    const expectedEarnings = await checkedJson(await page.request.get('/api/admin/earnings'))
    const reportButton = page.getByRole('button', { name: /Download Operations Report/ })
    await reportButton.scrollIntoViewIfNeeded()
    await expect(reportButton).toBeInViewport({ ratio: 1 })
    const downloadPromise = page.waitForEvent('download')
    await reportButton.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('mednexus-report.json')
    const report = await readDownload(download)
    expect(report.stats).toEqual(expectedStats.stats)
    expect(report.appointmentSummary).toEqual(expectedStats.appointmentSummary)
    expect(report.earnings).toEqual(expectedEarnings.earnings)
    expect(report.doctorEarnings).toEqual(expectedEarnings.doctors)
    expect(Number.isNaN(Date.parse(report.generatedAt))).toBe(false)
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE_SYNTHETIC|symptoms|"notes"|patientId|password|tokenVersion/)
    expect((await patient.page.request.get('/api/admin/stats')).status()).toBe(403)
    expect((await doctorPage.request.get('/api/admin/earnings')).status()).toBe(403)
    expect(errors).toEqual([])
  } finally {
    await patient.context.close()
    await doctorContext.close()
  }
})

test('doctor leave review rechecks a stale preview, then approval persists and blocks patient slots', async ({ page, newContext }, testInfo) => {
  const patient = await createPatient(newContext, 'QA Leave Patient')
  const doctorContext = await newContext()
  const doctorPage = await doctorContext.newPage()
  try {
    await signIn(page, 'admin@qa.example')
    await signIn(doctorPage, operationsEmail)
    const doctorId = await operationsDoctor(patient.page)
    const dayIndex = testInfo.project.name === 'mobile' ? 45 : 35
    const day = bookingDateKey(getBookingDays(70)[dayIndex])
    const reason = `QA leave round trip ${testInfo.project.name} ${Date.now()}`
    await doctorPage.goto('/doctor/leave')
    await doctorPage.getByLabel('Start date', { exact: true }).fill(day)
    await doctorPage.getByLabel('End date', { exact: true }).fill(day)
    await doctorPage.getByLabel('Reason', { exact: true }).fill(reason)
    const submitted = requestFor(doctorPage, '/api/leaves', 'POST')
    await doctorPage.getByRole('button', { name: 'Submit leave request' }).click()
    expect((await submitted).status()).toBe(201)
    const created = (await (await submitted).json()).leave
    await doctorPage.reload()
    const history = doctorPage.getByRole('row').filter({ hasText: reason })
    await expect(history.getByText('Pending approval', { exact: true })).toBeVisible()
    await page.goto('/admin/leaves')
    const request = page.locator('article').filter({ hasText: reason })
    await request.getByRole('button', { name: 'Check appointments' }).click()
    await expect(request.getByText('Conflicting appointments: 0', { exact: true })).toBeVisible()
    await request.getByRole('checkbox').check()
    const appointment = await book(patient.page, doctorId, dayIndex)
    expect(appointment.date).toBe(day)
    const staleReview = requestFor(page, `/api/leaves/${created._id}/review`, 'PUT')
    await request.getByRole('button', { name: 'Approve leave' }).click()
    expect((await staleReview).status()).toBe(409)
    await expect(page.getByText('Leave was not approved', { exact: true })).toBeVisible()
    await expect(request.getByRole('button', { name: 'Approve leave' })).toBeDisabled()
    const stillPending = await checkedJson(await doctorPage.request.get('/api/leaves/my'))
    expect(stillPending.leaves.find(leave => leave._id === created._id).status).toBe('pending')
    const cancellation = await patient.page.request.put(`/api/appointments/${appointment._id}/cancel`, { headers: requestHeaders })
    expect(cancellation.ok()).toBe(true)
    await request.getByRole('button', { name: 'Check appointments' }).click()
    await expect(request.getByText('Conflicting appointments: 0', { exact: true })).toBeVisible()
    await request.getByRole('checkbox').check()
    await request.getByLabel('Admin note (optional)').fill('Synthetic scheduling review complete')
    const approval = requestFor(page, `/api/leaves/${created._id}/review`, 'PUT')
    await request.getByRole('button', { name: 'Approve leave' }).click()
    expect((await approval).status()).toBe(200)
    await expect(request.getByText('approved', { exact: true })).toBeVisible()
    await page.reload()
    await expect(request.getByText('approved', { exact: true })).toBeVisible()
    await doctorPage.reload()
    await expect(history.getByText('Approved', { exact: true })).toBeVisible()
    await expect(history.getByText('Synthetic scheduling review complete')).toBeVisible()
    const slots = await checkedJson(await patient.page.request.get(`/api/availability/slots/${doctorId}/${day}`))
    expect(Object.values(slots.slots).flat()).toHaveLength(0)
    const forbiddenBooking = await patient.page.request.post('/api/appointments', { headers: requestHeaders, data: { doctorId, date: day, time: appointment.time } })
    expect(forbiddenBooking.status()).toBe(409)
    expect((await doctorPage.request.put(`/api/leaves/${created._id}/review`, { headers: requestHeaders, data: { status: 'rejected' } })).status()).toBe(403)
    const overlap = await doctorPage.request.post('/api/leaves', { headers: requestHeaders, data: { startDate: day, endDate: day, reason: 'Overlapping synthetic application' } })
    expect(overlap.status()).toBe(409)
    // A separate pending application can be rejected, and another can be
    // cancelled by its doctor. Neither may remain an invisible booking block.
    const rejectedDay = bookingDateKey(getBookingDays(70)[dayIndex + 1])
    const rejectedReason = `${reason} rejected`
    const apply = async (date, text) => {
      await doctorPage.getByLabel('Start date', { exact: true }).fill(date)
      await doctorPage.getByLabel('End date', { exact: true }).fill(date)
      await doctorPage.getByLabel('Reason', { exact: true }).fill(text)
      const result = requestFor(doctorPage, '/api/leaves', 'POST')
      await doctorPage.getByRole('button', { name: 'Submit leave request' }).click()
      expect((await result).status()).toBe(201)
    }
    await apply(rejectedDay, rejectedReason)
    await page.reload()
    const rejectedArticle = page.locator('article').filter({ hasText: rejectedReason })
    await rejectedArticle.getByRole('button', { name: 'Reject leave' }).click()
    await expect(rejectedArticle.getByText('rejected', { exact: true })).toBeVisible()
    await doctorPage.reload()
    await expect(doctorPage.getByRole('row').filter({ hasText: rejectedReason }).getByText('Rejected', { exact: true })).toBeVisible()
    const cancelledDay = bookingDateKey(getBookingDays(70)[dayIndex + 2])
    const cancelledReason = `${reason} cancelled`
    await apply(cancelledDay, cancelledReason)
    const cancelledHistory = doctorPage.getByRole('row').filter({ hasText: cancelledReason })
    await cancelledHistory.getByRole('button', { name: /Cancel leave request/ }).click()
    await expect(cancelledHistory.getByText('Cancelled', { exact: true })).toBeVisible()
    await doctorPage.reload()
    await expect(cancelledHistory.getByText('Cancelled', { exact: true })).toBeVisible()
    for (const date of [rejectedDay, cancelledDay]) {
      const released = await checkedJson(await patient.page.request.get(`/api/availability/slots/${doctorId}/${date}`))
      expect(Object.values(released.slots).flat().length).toBeGreaterThan(0)
    }
  } finally {
    await patient.context.close()
    await doctorContext.close()
  }
})

test('admin verifies a registered doctor and deactivates the account with persistence and session revocation', async ({ page, newContext }) => {
  const context = await newContext()
  const doctorPage = await context.newPage()
  const email = `pending-doctor-${Date.now()}@qa.example`
  const name = `QA Pending Doctor ${Date.now()}`
  try {
    const registered = await checkedJson(await doctorPage.request.post('/api/auth/register', {
      headers: requestHeaders, data: { name, email, password, role: 'doctor', licenseNumber: 'SYNTHETIC-QA-LICENSE' },
    }))
    const userId = registered.user.id || registered.user._id
    await signIn(page, 'admin@qa.example')
    await page.goto('/admin/users')
    await page.getByPlaceholder('Search by name or email...').fill(email)
    const row = page.getByRole('row').filter({ hasText: email })
    await expect(row.getByText('Pending', { exact: true })).toBeVisible()
    const verification = requestFor(page, `/api/admin/verify-doctor/${userId}`, 'PUT')
    await row.getByRole('button', { name: 'Verify', exact: true }).click()
    expect((await verification).status()).toBe(200)
    await expect(row.getByText(/Verified/)).toBeVisible()
    await page.reload()
    await page.getByPlaceholder('Search by name or email...').fill(email)
    await expect(row.getByText(/Verified/)).toBeVisible()
    await doctorPage.goto('/doctor/dashboard')
    await expect(doctorPage.getByRole('heading', { name: `Welcome back, ${name}!` })).toBeVisible()
    const details = await checkedJson(await page.request.get(`/api/admin/doctors/${userId}`))
    expect(details.doctor.isVerified).toBe(true)
    page.once('dialog', dialog => dialog.accept())
    const deactivation = requestFor(page, `/api/admin/users/${userId}`, 'DELETE')
    await row.getByRole('button', { name: 'Deactivate' }).click()
    expect((await deactivation).status()).toBe(200)
    await expect(row).toHaveCount(0)
    await page.reload()
    await page.getByPlaceholder('Search by name or email...').fill(email)
    await expect(row).toHaveCount(0)
    expect((await doctorPage.request.get('/api/auth/me')).status()).toBe(401)
    const deniedLogin = await doctorPage.request.post('/api/auth/login', { headers: requestHeaders, data: { email, password } })
    expect(deniedLogin.status()).toBe(401)
    const doctorId = details.doctor.id
    expect((await doctorPage.request.get(`/api/availability/slots/${doctorId}/${bookingDateKey(getBookingDays(3)[1])}`)).status()).toBe(404)
  } finally { await context.close() }
})
