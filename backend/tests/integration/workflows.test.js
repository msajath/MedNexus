const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { app } = require('../../server');
const User = require('../../models/User');
const Doctor = require('../../models/Doctor');
const Appointment = require('../../models/Appointment');
const Availability = require('../../models/Availability');
const MedicalRecord = require('../../models/MedicalRecord');
const Message = require('../../models/Message');
const ContactMessage = require('../../models/ContactMessage');
const { defaultSchedule } = require('../../utils/slots');
const assertTestDatabase = require('../helpers/testDatabase');
jest.mock('../../utils/mailer', () => ({ sendMail: jest.fn().mockResolvedValue({}) }));
const { sendMail } = require('../../utils/mailer');
const withMongo = process.env.MONGO_TEST_URI ? describe : describe.skip;
const password = 'QA-password-123456';
const auth = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, version: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })}` });
const futureMonday = () => {
  const date = new Date(); date.setUTCDate(date.getUTCDate() + 14 + (8 - date.getUTCDay()) % 7);
  return date.toISOString().slice(0, 10);
};
withMongo('Real database API workflows', () => {
  jest.setTimeout(30000);
  let patient, otherPatient, doctorUser, doctor, admin;
  beforeAll(async () => {
    assertTestDatabase(process.env.MONGO_TEST_URI);
    await mongoose.connect(process.env.MONGO_TEST_URI, { autoIndex: false });
    await Promise.all([User.createIndexes(), Appointment.createIndexes(), Availability.createIndexes()]);
  });
  beforeEach(async () => {
    for (const model of [User, Doctor, Appointment, Availability, MedicalRecord, Message, ContactMessage]) await model.deleteMany({});
    const create = (role, suffix = '') => User.create({ name: `QA ${role}${suffix}`, email: `${role}${suffix}@example.test`, password, role, isVerified: true });
    [patient, otherPatient, doctorUser, admin] = await Promise.all([create('patient'), create('patient', '2'), create('doctor'), create('admin')]);
    doctor = await Doctor.create({ user: doctorUser._id, specialty: 'General Practice', fee: 125 });
    sendMail.mockClear();
  });
  afterAll(async () => mongoose.disconnect());
  const book = () => request(app).post('/api/appointments').set(auth(patient)).send({ doctorId: String(doctor._id), date: futureMonday(), time: '10:00 AM' });

  test('registration, cookie login, profile, and logout invalidate copied sessions', async () => {
    const agent = request.agent(app);
    const registered = await agent.post('/api/auth/register').send({ name: 'New Patient', email: ' New@EXAMPLE.test ', password, role: 'patient', isVerified: true });
    expect(registered.status).toBe(201);
    expect(registered.body.token).toBeUndefined();
    const cookie = registered.headers['set-cookie'][0].split(';')[0];
    expect(registered.headers['set-cookie'][0]).toContain('HttpOnly');
    expect((await agent.get('/api/auth/me')).body.user.email).toBe('new@example.test');
    const updated = await agent.put('/api/auth/profile').set('X-MedNexus-Request', '1').send({ phone: '123', address: 'Test Address' });
    expect(updated.status).toBe(200);
    expect(updated.body.user.address).toBe('Test Address');
    expect((await agent.post('/api/auth/logout').set('X-MedNexus-Request', '1')).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });
  test('login rejects incorrect password and inactive accounts', async () => {
    expect((await request(app).post('/api/auth/login').send({ email: patient.email, password: 'incorrect-password' })).status).toBe(401);
    patient.isActive = false; await patient.save();
    expect((await request(app).post('/api/auth/login').send({ email: patient.email, password })).status).toBe(401);
  });
  test('password change rotates the current session and invalidates old tokens', async () => {
    const old = auth(patient);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: patient.email, password });
    const changed = await agent.put('/api/auth/password').set('X-MedNexus-Request', '1').send({ currentPassword: password, newPassword: 'changed-password-123456' });
    expect(changed.status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(old)).status).toBe(401);
  });
  test('password reset codes are single-use even during concurrent requests', async () => {
    const old = auth(patient);
    const code = patient.generateResetToken(); await patient.save();
    const payload = { email: patient.email, resetCode: code, newPassword: 'reset-password-123456' };
    const responses = await Promise.all([request(app).post('/api/auth/reset-password').send(payload), request(app).post('/api/auth/reset-password').send(payload)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
    expect((await request(app).get('/api/auth/me').set(old)).status).toBe(401);
    const stored = await User.findById(patient._id).select('+password +resetPasswordToken');
    expect(await stored.matchPassword(payload.newPassword)).toBe(true);
    expect(stored.resetPasswordToken).toBeNull();
  });
  test('forgot password sends a code without changing the password or exposing it', async () => {
    const result = await request(app).post('/api/auth/forgot-password').send({ email: patient.email });
    expect(result.status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(1);
    const code = sendMail.mock.calls[0][0].text.match(/reset code is: (\d{6})/)[1];
    expect(JSON.stringify(result.body)).not.toContain(code);
    expect((await User.findById(patient._id).select('+password')).matchPassword(password)).resolves.toBe(true);
    const stored = await User.findById(patient._id).select('+resetPasswordToken');
    expect(stored.resetPasswordToken).toBe(crypto.createHash('sha256').update(code).digest('hex'));
  });
  test('public doctor listing, filters, specialties, profile, and invalid filters', async () => {
    await Doctor.updateOne({ _id: doctor._id }, { location: 'Colombo' });
    expect((await request(app).get('/api/doctors?search=QA')).body.count).toBe(1);
    expect((await request(app).get('/api/doctors?search=Colombo')).body.count).toBe(1);
    expect((await request(app).get('/api/doctors?specialty=(a%2B)%2B')).body.count).toBe(0);
    expect((await request(app).get('/api/doctors?search=x&search=y')).status).toBe(400);
    expect((await request(app).get('/api/doctors/specialties/list')).body.specialties).toContain('General Practice');
    expect((await request(app).get(`/api/doctors/${doctor._id}`)).body.doctor.fee).toBe(125);
    const updated = await request(app).put('/api/doctors/profile').set(auth(doctorUser)).send({ fee: 0, bio: 'Updated', credentialsChanged: true });
    expect(updated.status).toBe(200);
    expect(updated.body.doctor.fee).toBe(0);
    expect(updated.body.doctor.credentialsChanged).toBe(false);
    expect((await request(app).put('/api/doctors/profile').set(auth(doctorUser)).send({ fee: -1 })).status).toBe(400);
  });
  test('availability accepts a complete schedule and supports half-hour starts', async () => {
    const schedule = defaultSchedule.map(s => ({ ...s, ...(s.day === 'Monday' ? { start: '09:30', end: '11:30' } : {}) }));
    expect((await request(app).put('/api/availability').set(auth(doctorUser)).send({ schedule })).status).toBe(200);
    const slots = await request(app).get(`/api/availability/slots/${doctor._id}/${futureMonday()}`);
    expect(slots.body.slots.morning).toContain('09:30 AM');
    expect((await request(app).post('/api/appointments').set(auth(patient)).send({ doctorId: String(doctor._id), date: futureMonday(), time: '9:30am' })).status).toBe(201);
    expect((await request(app).get(`/api/availability/${doctor._id}`)).body.schedule).toHaveLength(7);
  });
  test.each([
    [[]], defaultSchedule.map(s => ({ ...s, day: 'Monday' })), defaultSchedule.map(s => ({ ...s, start: '99:00' })),
    defaultSchedule.map(s => ({ ...s, end: '08:00' })),
    defaultSchedule.map(s => ({ ...s, start: '09:15' })),
  ])('invalid availability is rejected (%#)', async (schedule) => {
    expect((await request(app).put('/api/availability').set(auth(doctorUser)).send({ schedule })).status).toBe(400);
    expect(await Availability.countDocuments()).toBe(0);
  });
  test('normalized time variants cannot reserve a slot twice', async () => {
    const first = await book(); expect(first.status).toBe(201);
    const duplicate = await request(app).post('/api/appointments').set(auth(otherPatient)).send({ doctorId: String(doctor._id), date: futureMonday(), time: '10:00am' });
    expect([400, 409]).toContain(duplicate.status);
    expect((await request(app).get(`/api/availability/slots/${doctor._id}/${futureMonday()}`)).body.bookedSlots).toContain('10:00 AM');
  });
  test('rescheduling updates the existing booking and preserves it when a slot is occupied', async () => {
    const created = await book(); expect(created.status).toBe(201);
    const id = created.body.appointment._id;
    const endpoint = `/api/appointments/${id}/reschedule`;
    const payload = { date: futureMonday(), time: '11:00am' };
    expect((await request(app).put(endpoint).set(auth(otherPatient)).send(payload)).status).toBe(403);
    expect((await request(app).put(endpoint).set(auth(patient)).send(payload)).status).toBe(200);
    expect(await Appointment.countDocuments()).toBe(1);
    expect((await Appointment.findById(id)).time).toBe('11:00 AM');
    await Appointment.create({ patient: otherPatient._id, doctor: doctor._id, date: futureMonday(), time: '12:00 PM' });
    expect((await request(app).put(endpoint).set(auth(patient)).send({ ...payload, time: '12:00 PM' })).status).toBe(409);
    expect((await Appointment.findById(id)).time).toBe('11:00 AM');
    await Appointment.updateOne({ _id: id }, { status: 'completed' });
    expect((await request(app).put(endpoint).set(auth(patient)).send(payload)).status).toBe(409);
  });
  test('appointment transitions enforce ownership and terminal states on both endpoints', async () => {
    const created = await book(); const id = created.body.appointment._id;
    expect((await request(app).put(`/api/appointments/${id}/status`).set(auth(patient)).send({ status: 'confirmed' })).status).toBe(403);
    expect((await request(app).put(`/api/appointments/${id}/cancel`).set(auth(otherPatient))).status).toBe(403);
    expect((await request(app).put(`/api/appointments/${id}/status`).set(auth(doctorUser)).send({ status: 'confirmed' })).status).toBe(200);
    expect((await request(app).put(`/api/admin/appointments/${id}/status`).set(auth(admin)).send({ status: 'completed' })).status).toBe(200);
    expect((await request(app).put(`/api/admin/appointments/${id}/status`).set(auth(admin)).send({ status: 'confirmed' })).status).toBe(409);
    expect((await request(app).put(`/api/appointments/${id}/cancel`).set(auth(patient))).status).toBe(409);
    expect((await request(app).get('/api/appointments/my').set(auth(patient))).body.count).toBe(1);
    expect((await request(app).get('/api/appointments/my').set(auth(doctorUser))).body.count).toBe(1);
    expect((await request(app).get('/api/appointments/my').set(auth(admin))).status).toBe(403);
    expect((await request(app).get('/api/appointments/all').set(auth(admin))).body.count).toBe(1);
  });
  test('patient and doctor records, privacy, ownership, and retention', async () => {
    const appt = (await book()).body.appointment;
    await request(app).put(`/api/appointments/${appt._id}/status`).set(auth(doctorUser)).send({ status: 'confirmed' });
    const record = await request(app).post('/api/records').set(auth(patient)).send({ title: 'Patient record', isPrivate: true });
    expect(record.status).toBe(201);
    expect((await request(app).delete(`/api/records/${record.body.record._id}`).set(auth(otherPatient))).status).toBe(403);
    expect((await request(app).get(`/api/records/patient/${patient._id}`).set(auth(doctorUser))).body.count).toBe(0);
    const clinical = await request(app).post('/api/records/doctor-add').set(auth(doctorUser)).send({ patientId: String(patient._id), appointmentId: appt._id, title: 'Diagnosis', medications: [{ name: 'QA medication', dosage: 'Test' }] });
    expect(clinical.status).toBe(201);
    expect((await request(app).delete(`/api/records/${clinical.body.record._id}`).set(auth(patient))).status).toBe(403);
    expect((await request(app).delete(`/api/records/${record.body.record._id}`).set(auth(patient))).status).toBe(200);
    expect((await request(app).get('/api/records/my').set(auth(patient))).body.count).toBe(1);
    expect(await MedicalRecord.countDocuments()).toBe(2);
    expect((await request(app).post('/api/records').set(auth(patient)).send({ title: 'Unsafe', attachments: [{ name: 'Bad', url: 'javascript:alert(1)' }] })).status).toBe(400);
  });
  test('messages are readable only by their recipient', async () => {
    const message = await Message.create({ recipient: patient._id, senderName: 'Clinic', subject: 'Private', body: 'Private message' });
    expect((await request(app).get('/api/messages').set(auth(patient))).body.count).toBe(1);
    expect((await request(app).get('/api/messages').set(auth(otherPatient))).body.count).toBe(0);
    expect((await request(app).put(`/api/messages/${message._id}/read`).set(auth(otherPatient))).status).toBe(404);
    expect((await request(app).put(`/api/messages/${message._id}/read`).set(auth(patient))).body.message.read).toBe(true);
  });
  test('contact submission ignores forged status and admin can triage', async () => {
    expect((await request(app).post('/api/contact').send({ name: 'Visitor', email: 'visitor@example.test', subject: 'Help', message: 'Please assist with booking', status: 'resolved' })).status).toBe(201);
    const messages = await request(app).get('/api/admin/contact-messages').set(auth(admin));
    expect(messages.body.messages[0].status).toBe('new');
    expect((await request(app).put(`/api/admin/contact-messages/${messages.body.messages[0]._id}/status`).set(auth(admin)).send({ status: 'resolved' })).body.message.status).toBe('resolved');
  });
  test('admin endpoints, doctor creation and verification preserve private credentials', async () => {
    const created = await request(app).post('/api/admin/doctors').set(auth(admin)).send({ name: 'New doctor', email: 'added@example.test', specialty: 'Dermatology', fee: 0 });
    expect(created.status).toBe(201);
    const userId = created.body.user.id;
    const profile = await request(app).get(`/api/admin/doctors/${userId}`).set(auth(admin));
    expect(profile.body.doctor.fee).toBe(0);
    expect((await request(app).get('/api/admin/doctors-detail').set(auth(admin))).body.count).toBe(2);
    expect((await request(app).put(`/api/admin/verify-doctor/${userId}`).set(auth(admin))).status).toBe(200);
    for (const endpoint of ['stats', 'users', 'recent-activity', 'appointments', 'records']) {
      expect((await request(app).get(`/api/admin/${endpoint}`).set(auth(admin))).status).toBe(200);
      expect((await request(app).get(`/api/admin/${endpoint}`).set(auth(patient))).status).toBe(403);
    }
    expect((await request(app).get('/api/admin/users').set(auth(admin))).text).not.toMatch(/password|resetPasswordToken|resetPasswordExpire/);
    expect((await request(app).delete(`/api/admin/users/${admin._id}`).set(auth(admin))).status).toBe(403);
  });
});
