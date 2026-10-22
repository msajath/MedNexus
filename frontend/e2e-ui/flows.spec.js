import { test, expect } from '@playwright/test'

const doctorId = '507f1f77bcf86cd799439012'
const patientId = '507f1f77bcf86cd799439013'
const schedule = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => ({ day, enabled: true, start: '09:00', end: '17:00' }))
const dateAhead = (days = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const paymentSummary = payments => {
  const receivedAmount = payments.reduce((total, payment) => total + payment.amount, 0)
  const refundedAmount = payments.filter(payment => payment.status === 'refunded').reduce((total, payment) => total + payment.amount, 0)
  return { receivedAmount, refundedAmount, netReceived: receivedAmount - refundedAmount, receivedPayments: payments.filter(payment => payment.status === 'received').length, currency: 'USD', basis: 'recorded_payments' }
}
const mockAPI = async (page, role = null) => {
  const state = { role, records: [], read: false, status: 'new', appointment: null, leaves: [], payments: [], adminRecordRequests: 0 }
  const doctor = { id: doctorId, _id: doctorId, userId: doctorId, name: 'QA Doctor', email: 'doctor@qa.example', specialty: 'General Practice', fee: 125, available: true, languages: ['English'], education: [], experienceHistory: [], bio: 'QA clinician', isVerified: true }
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method()
    const user = state.role ? { id: patientId, _id: patientId, name: `QA ${state.role}`, email: `${state.role}@qa.example`, role: state.role, doctorProfile: doctor } : null
    let data = { success: true }, status = 200
    if (path === '/api/auth/me') { data.user = user; if (!user) status = 401 }
    else if (path === '/api/auth/login') { state.role = request.postDataJSON().email.startsWith('admin') ? 'admin' : 'patient'; data.user = { ...user, role: state.role, name: 'QA Patient', email: 'patient@qa.example' } }
    else if (path === '/api/auth/logout') { state.role = null }
    else if (path === '/api/auth/password') { data.message = 'Password updated successfully!' }
    else if (path === '/api/auth/profile') { data.user = { ...user, ...request.postDataJSON() } }
    else if (path === '/api/doctors') data.doctors = [doctor]
    else if (path.startsWith('/api/doctors/')) data.doctor = doctor
    else if (path.startsWith('/api/availability/slots/')) { data.slots = { morning: ['09:00 AM', '09:30 AM', '10:00 AM'], afternoon: [], evening: [] }; data.unavailableSlots = { morning: [], afternoon: [], evening: [] }; data.bookedSlots = [] }
    else if (path.startsWith('/api/availability')) data.schedule = method === 'PUT' ? request.postDataJSON().schedule : schedule
    else if (path === '/api/appointments' && method === 'POST') { state.appointment = { _id: 'appointment-1', id: 'appointment-1', ...request.postDataJSON(), status: 'pending', feeAtBooking: 125, doctor: { ...doctor, user: { name: doctor.name } }, patient: { name: 'QA Patient', _id: patientId } }; data.appointment = state.appointment }
    else if (path === '/api/appointments/my') data.appointments = state.appointment ? [state.appointment] : []
    else if (path.startsWith('/api/appointments/')) {
      if (state.appointment) {
        if (path.endsWith('/reschedule')) Object.assign(state.appointment, request.postDataJSON(), { status: 'pending' })
        else state.appointment.status = 'cancelled'
      }
      data.appointment = state.appointment
    }
    else if (path === '/api/records' && method === 'POST') { const record = { _id: 'record-1', ...request.postDataJSON(), addedBy: 'patient' }; state.records.push(record); data.record = record }
    else if (path === '/api/records/my') data.records = state.records
    else if (path.startsWith('/api/records/') && method === 'DELETE') state.records = []
    else if (path === '/api/messages') data.messages = [{ _id: 'message-1', senderName: 'QA Clinic', subject: 'Welcome', body: 'Welcome to the clinic', read: state.read }]
    else if (path === '/api/messages/message-1/read') state.read = true
    else if (path === '/api/admin/contact-messages') data.messages = [{ _id: 'contact-1', name: 'QA Visitor', email: 'visitor@qa.example', subject: 'QA contact', message: 'Support request', status: state.status }]
    else if (path === '/api/admin/contact-messages/contact-1/status') state.status = 'in-progress'
    else if (path === '/api/payments/my') data.earnings = paymentSummary(state.payments)
    else if (path === '/api/leaves/my') { data.leaves = state.leaves; data.clinicDate = dateAhead() }
    else if (path === '/api/leaves' && method === 'POST') { const leave = { _id: `leave-${state.leaves.length + 1}`, ...request.postDataJSON(), status: 'pending', doctor: { ...doctor, user: { name: doctor.name, email: doctor.email } }, createdAt: new Date().toISOString() }; state.leaves.unshift(leave); data.leave = leave }
    else if (path === '/api/leaves') data.leaves = state.leaves
    else if (/^\/api\/leaves\/[^/]+\/cancel$/.test(path)) { const leave = state.leaves.find(item => item._id === path.split('/')[3]); leave.status = 'cancelled'; data.leave = leave }
    else if (/^\/api\/leaves\/[^/]+\/conflicts$/.test(path)) { const leave = state.leaves.find(item => item._id === path.split('/')[3]); data.conflicts = state.appointment && ['pending', 'confirmed'].includes(state.appointment.status) && state.appointment.date >= leave.startDate && state.appointment.date <= leave.endDate ? [{ id: state.appointment._id, patientName: state.appointment.patient?.name, date: state.appointment.date, time: state.appointment.time, status: state.appointment.status }] : []; data.conflictCount = data.conflicts.length; data.overlapLeaveCount = 0; data.processingCount = 0; data.doctor = { active: true, verified: true } }
    else if (/^\/api\/leaves\/[^/]+\/review$/.test(path)) { const leave = state.leaves.find(item => item._id === path.split('/')[3]); Object.assign(leave, request.postDataJSON()); data.leave = leave }
    else if (path === '/api/admin/stats') { data.stats = { totalDoctors: '1', totalPatients: '1', monthlyAppointments: state.appointment ? '1' : '0', pendingApprovals: '2' }; data.appointmentSummary = { total: state.appointment ? 1 : 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, rescheduled: 0 }; if (state.appointment) { data.appointmentSummary[state.appointment.status] = 1; data.appointmentSummary.rescheduled = state.appointment.rescheduleHistory?.length ? 1 : 0 } data.earnings = paymentSummary(state.payments) }
    else if (path === '/api/admin/earnings') { data.earnings = paymentSummary(state.payments); data.doctors = [{ doctorId, userId: doctorId, name: doctor.name, specialty: doctor.specialty, isActive: true, completedAppointments: state.appointment?.status === 'completed' ? 1 : 0, ...data.earnings }] }
    else if (path === '/api/admin/recent-activity') data.activity = [{ id: '1', type: 'registration', message: 'QA patient registered', time: '2026-10-11T00:00:00Z' }]
    else if (path === '/api/admin/users') data.users = [{ _id: doctorId, name: 'QA Doctor', role: 'doctor', email: 'doctor@qa.example', isVerified: true }]
    else if (path === '/api/admin/doctors-detail') data.doctors = [doctor]
    else if (path === '/api/admin/records') { state.adminRecordRequests += 1; status = 403; data.message = 'Clinical records are not available to administrators.' }
    else if (path === '/api/admin/appointments') { const payment = state.payments.findLast(item => item.status === 'received') || state.payments.at(-1) || null; data.appointments = state.appointment ? [{ ...state.appointment, paymentStatus: payment?.status || 'unpaid', payment }] : [] }
    else if (/^\/api\/admin\/appointments\/[^/]+\/status$/.test(path)) { state.appointment.status = request.postDataJSON().status; data.appointment = state.appointment }
    else if (/^\/api\/admin\/appointments\/[^/]+\/payment$/.test(path)) { const payment = { id: `payment-${state.payments.length + 1}`, appointmentId: state.appointment._id, ...request.postDataJSON(), status: 'received', receivedAt: new Date().toISOString(), recordedAt: new Date().toISOString() }; state.payments.push(payment); data.payment = payment }
    else if (/^\/api\/admin\/payments\/[^/]+\/refund$/.test(path)) { const payment = state.payments.find(item => item.id === path.split('/')[4]); Object.assign(payment, { status: 'refunded', refundReason: request.postDataJSON().reason, refundedAt: new Date().toISOString() }); data.payment = payment }
    else if (path === '/api/admin/payments') data.payments = state.payments
    else if (path === '/api/admin/doctors') { data.user = { id: doctorId }; data.doctor = doctor }
    else if (path === '/api/contact') data.message = 'Your message has been received'
    else if (path === '/api/ready') data.status = 'ready'
    else if (path.includes('forgot-password')) data.message = 'If an account exists, a reset code has been sent'
    else { status = 404; data.message = `Unhandled mock route: ${method} ${path}` }
    await route.fulfill({ status, json: data })
  })
  return { state, errors }
}

test('all public pages and doctor detail render on desktop and mobile', async ({ page }) => {
  const { errors } = await mockAPI(page)
  for (const path of ['/', '/about', '/contact', '/doctors', `/doctors/${doctorId}`, '/login', '/register', '/forgot-password', '/admin/login']) {
    await page.goto(path); await expect(page.locator('h1,h2').first()).toBeVisible()
  }
  await page.goto('/doctors')
  await page.locator('#specialty-filter').selectOption('General Practice')
  await expect(page.getByText('QA Doctor', { exact: true }).first()).toBeVisible()
  await page.goto('/patient/records'); await expect(page).toHaveURL(/\/login/)
  expect(errors).toEqual([])
})

test('doctor pages recover from a temporary service failure without a manual refresh', async ({ page }) => {
  const { errors } = await mockAPI(page)
  for (const path of ['/', '/doctors']) {
    let requests = 0
    const interruptedRead = async route => {
      requests += 1
      if (requests === 1) return route.fulfill({ status: 503, json: { message: 'Temporary backend interruption' } })
      return route.fallback()
    }
    await page.route('**/api/doctors', interruptedRead)
    await page.goto(path)
    const doctors = path === '/' ? page.locator('#top-doctors') : page.locator('#doctor-listing')
    await expect(doctors.getByText('QA Doctor', { exact: true })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(requests).toBe(2)
    await page.unroute('**/api/doctors', interruptedRead)
  }
  expect(errors).toEqual([])
})

test('doctor listing shows one clear notice during an outage and supports manual recovery', async ({ page }) => {
  const { errors } = await mockAPI(page)
  let unavailable = true
  await page.route('**/api/doctors', route => unavailable
    ? route.fulfill({ status: 500, json: { message: 'Internal database details must stay private' } })
    : route.fallback())
  await page.goto('/doctors')
  await expect(page.getByRole('alert')).toHaveCount(1)
  await expect(page.getByRole('alert')).toContainText('Please try again shortly')
  await expect(page.getByText(/Error loading doctors|Internal database details|The server is taking too long/)).toHaveCount(0)
  unavailable = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('QA Doctor', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('patient records, messages, profile, password, booking and cancellation work against API contracts', async ({ page }) => {
  const { state, errors } = await mockAPI(page, 'patient')
  await page.goto('/patient/messages'); await page.getByRole('button', { name: /QA Clinic/ }).click()
  await expect(page.getByText('You have 0 unread messages')).toBeVisible(); expect(state.read).toBe(true)
  await page.goto('/patient/records'); await page.getByRole('button', { name: /Add Record/ }).click()
  await page.getByPlaceholder('e.g. Blood Test Report June 2025').fill('QA record')
  // The Chrome mobile emulator can misplace a pointer click in this scrollable modal.
  // Enter still submits the real form and checks the record-saving contract.
  await page.getByRole('button', { name: 'Save Record' }).press('Enter'); await expect(page.getByText('Record added successfully!')).toBeVisible()
  page.on('dialog', dialog => dialog.accept())
  await page.getByTitle('Delete', { exact: true }).click(); await expect(page.getByText('QA record', { exact: true })).toHaveCount(0)
  await page.goto('/patient/profile')
  await page.getByLabel('Current Password', { exact: true }).fill('QA-password-123456')
  await page.getByLabel('New Password', { exact: true }).fill('QA-new-password-123456')
  await page.getByLabel('Confirm New Password', { exact: true }).fill('QA-new-password-123456')
  await page.getByRole('button', { name: 'Update Password' }).click(); await expect(page.getByRole('status')).toHaveText('Password updated successfully!')
  await page.getByRole('button', { name: 'Save Changes' }).click(); await expect(page.getByText('Profile updated successfully!')).toBeVisible()
  await page.goto(`/book/${doctorId}`)
  await page.locator('#book-appointment button').filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).first().click()
  await page.getByRole('button', { name: '09:00 AM', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm Booking' }).click()
  await expect(page.getByText('Appointment Booked!')).toBeVisible(); expect(state.appointment.status).toBe('pending')
  await page.goto('/patient/appointments'); await expect(page.getByRole('row').filter({ hasText: 'QA Doctor' })).toBeVisible()
  await page.getByRole('button', { name: 'Reschedule', exact: true }).click()
  await expect(page).toHaveURL(/reschedule=appointment-1/)
  await page.locator('#book-appointment button').filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).first().click()
  await page.getByRole('button', { name: '09:30 AM', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm Reschedule' }).click()
  await expect(page.getByText('Appointment Rescheduled!')).toBeVisible()
  expect(state.appointment.time).toBe('09:30 AM')
  await page.goto('/patient/appointments')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect.poll(() => state.appointment.status).toBe('cancelled')
  expect(errors).toEqual([])
})

test('doctor routes load and weekly availability saves', async ({ page }) => {
  const { errors } = await mockAPI(page, 'doctor')
  for (const path of ['/doctor/dashboard', '/doctor/appointments', '/doctor/profile', '/doctor/messages']) {
    await page.goto(path); await expect(page.locator('h1,h2').first()).toBeVisible()
  }
  await page.goto('/doctor/availability'); await expect(page.getByText('Monday', { exact: true })).toBeVisible()
  const saved = page.waitForRequest(request => request.url().endsWith('/api/availability') && request.method() === 'PUT')
  page.on('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: /Save/ }).click()
  expect((await saved).postDataJSON().schedule).toHaveLength(7); expect(errors).toEqual([])
})

test('administrator dashboard, report download, navigation and message triage work', async ({ page }) => {
  const { state, errors } = await mockAPI(page, 'admin')
  await page.goto('/admin/dashboard'); await expect(page.getByText('QA patient registered')).toBeVisible()
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: /Download Operations Report/ }).click()
  expect((await download).suggestedFilename()).toBe('mednexus-report.json')
  await page.getByRole('button', { name: 'Review Now' }).click(); await expect(page).toHaveURL(/\/admin\/doctors/)
  for (const path of ['/admin/users', '/admin/appointments', '/admin/doctors', '/admin/leaves']) {
    await page.goto(path); await expect(page.locator('h1').first()).toBeVisible()
  }
  await page.goto('/admin/records'); await expect(page).toHaveURL(/\/admin\/dashboard/)
  await expect(page.getByRole('link', { name: /Medical Records/i })).toHaveCount(0)
  expect(state.adminRecordRequests).toBe(0)
  await page.goto('/admin/messages'); await page.getByRole('button', { name: /QA contact/ }).click()
  await expect(page.getByText('You have 0 unread messages')).toBeVisible(); expect(state.status).toBe('in-progress'); expect(errors).toEqual([])
})

test('contact and recovery forms submit and patient roles cannot open admin pages', async ({ page }) => {
  await mockAPI(page, 'patient')
  await page.goto('/admin/users'); await expect(page).toHaveURL(/\/admin\/login/)
  await page.goto('/contact')
  await page.getByLabel('Full Name').fill('QA Visitor'); await page.getByLabel('Email Address').fill('visitor@qa.example')
  await page.getByLabel('Subject').fill('QA Support'); await page.getByLabel('Message', { exact: true }).fill('This is a browser support request.')
  await page.locator('form button[type="submit"]').click(); await expect(page.getByRole('status')).toHaveText('Your message has been received')
  await page.goto('/forgot-password'); await page.getByLabel('Email Address').fill('patient@qa.example')
  await page.locator('form button[type="submit"]').click(); await expect(page.locator('#reset-code')).toBeVisible()
  await expect(page.getByText(/code expires in 5 minutes/i)).toBeVisible()
  await expect(page.getByLabel('New Password')).toHaveAttribute('minlength', '10')
  await expect(page.getByRole('button', { name: 'Request a new code' })).toBeVisible()
})
