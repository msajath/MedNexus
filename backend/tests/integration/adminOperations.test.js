const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../../server');
const User = require('../../models/User');
const Doctor = require('../../models/Doctor');
const Appointment = require('../../models/Appointment');
const MedicalRecord = require('../../models/MedicalRecord');
const Payment = require('../../models/Payment');
const assertTestDatabase = require('../helpers/testDatabase');

const withMongo = process.env.MONGO_TEST_URI ? describe : describe.skip;
const auth = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, version: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })}` });

withMongo('Administrative privacy and operational reporting', () => {
  jest.setTimeout(60000);
  let admin, patient, doctorUser, doctor;
  beforeAll(async () => {
    assertTestDatabase(process.env.MONGO_TEST_URI);
    await mongoose.connect(process.env.MONGO_TEST_URI, { autoIndex: false });
    await Promise.all([User.createIndexes(), Appointment.createIndexes(), Payment.createIndexes()]);
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Doctor.deleteMany({}), Appointment.deleteMany({}), MedicalRecord.deleteMany({}), Payment.deleteMany({})]);
    const create = (role) => User.create({ name: `QA ${role}`, email: `ops-${role}@example.test`, password: 'QA-password-12345', role, isVerified: true });
    [admin, patient, doctorUser] = await Promise.all(['admin', 'patient', 'doctor'].map(create));
    doctor = await Doctor.create({ user: doctorUser._id, specialty: 'General Practice', fee: 500 });
  });
  afterAll(async () => mongoose.disconnect());
  const appointment = (status, overrides = {}) => Appointment.create({
    patient: patient._id, doctor: doctor._id, date: '2030-01-07', time: '10:00 AM', status,
    notes: 'SECRET_CLINICAL_NOTES', symptoms: 'SECRET_CLINICAL_SYMPTOMS', ...overrides,
  });
  const history = () => [{ fromDate: '2030-01-07', fromTime: '09:00 AM', toDate: '2030-01-07', toTime: '10:00 AM', changedAt: new Date(), changedBy: patient._id }];

  test('admins cannot list, create, delete or access clinical records through direct URLs', async () => {
    const record = await MedicalRecord.create({ patient: patient._id, doctor: doctor._id, title: 'SECRET_RECORD', description: 'SECRET_DESCRIPTION', date: '2030-01-07' });
    const endpoints = [
      ['get', '/api/admin/records'], ['get', '/api/records/my'], ['get', `/api/records/patient/${patient._id}`],
      ['get', `/api/records/${record._id}`], ['get', `/api/records/${record._id}/attachments/0`],
      ['delete', `/api/records/${record._id}`], ['delete', `/api/records/${record._id}/attachments/0`],
      ['post', '/api/records'], ['post', '/api/records/doctor-add'],
    ];
    for (const [method, path] of endpoints) {
      const result = await request(app)[method](path).set(auth(admin)).send({ title: 'Admin attempt' });
      expect(result.status).toBe(403);
      expect(result.text).not.toMatch(/SECRET_/);
    }
    expect(await MedicalRecord.countDocuments()).toBe(1);
  });

  test('appointment list, doctor detail, and status mutation cannot disclose clinical information', async () => {
    const created = await appointment('confirmed', { feeAtBooking: 125, rescheduleHistory: history() });
    for (const endpoint of ['/api/admin/appointments', '/api/appointments/all', `/api/admin/doctors/${doctorUser._id}`]) {
      const result = await request(app).get(endpoint).set(auth(admin));
      expect(result.status).toBe(200);
      expect(result.text).not.toMatch(/SECRET_|"notes"|"symptoms"|"changedBy"/);
      const appointments = result.body.appointments || result.body.doctor.appointments;
      expect(appointments[0].rescheduled).toBe(true);
      expect(appointments[0].rescheduleHistory).toHaveLength(1);
    }
    const changed = await request(app).put(`/api/admin/appointments/${created._id}/status`).set(auth(admin)).send({ status: 'completed' });
    expect(changed.status).toBe(200);
    expect(changed.text).not.toMatch(/SECRET_|"notes"|"symptoms"/);
    expect((await Appointment.findById(created._id)).notes).toBe('SECRET_CLINICAL_NOTES');
    for (const route of ['status', 'cancel']) {
      const extra = await appointment('confirmed', { time: route === 'status' ? '12:00 PM' : '01:00 PM' });
      const result = await request(app).put(`/api/appointments/${extra._id}/${route}`).set(auth(admin)).send({ status: 'cancelled' });
      expect(result.status).toBe(200);
      expect(result.text).not.toMatch(/SECRET_|"notes"|"symptoms"/);
    }
    await User.updateOne({ _id: patient._id }, { bloodType: 'AB+', dob: '1990-01-01' });
    const users = await request(app).get('/api/admin/users').set(auth(admin));
    expect(users.status).toBe(200);
    expect(users.text).not.toMatch(/"bloodType"|"dob"|"tokenVersion"/);
  });

  test('summary includes every status, overlapping reschedules and zero-appointment doctors, while hiding provisional bookings', async () => {
    await appointment('pending', { time: '09:00 AM' });
    await appointment('confirmed', { feeAtBooking: 900 });
    await appointment('completed', { feeAtBooking: 125, rescheduleHistory: history() });
    await appointment('completed');
    await appointment('completed', { feeAtBooking: 0 });
    await appointment('cancelled', { rescheduleHistory: history(), feeAtBooking: 600 });
    const hidden = await appointment('pending', { time: '11:00 AM', feeAtBooking: 1000, bookingHold: { token: 'SECRET_HOLD', expiresAt: new Date(Date.now() + 60000) } });
    const secondUser = await User.create({ name: 'Second doctor', email: 'ops-second@example.test', password: 'QA-password-12345', role: 'doctor', isVerified: true });
    await Doctor.create({ user: secondUser._id, specialty: 'Dermatology', fee: 200 });
    const expected = { total: 6, pending: 1, confirmed: 1, completed: 3, cancelled: 1, rescheduled: 2 };
    const stats = await request(app).get('/api/admin/stats').set(auth(admin));
    expect(stats.status).toBe(200);
    expect(stats.body.appointmentSummary).toEqual(expected);
    expect(stats.body.earnings).toEqual({ receivedAmount: 0, refundedAmount: 0, netReceived: 0, receivedPayments: 0, currency: 'USD', basis: 'recorded_payments' });
    const listing = await request(app).get('/api/admin/appointments').set(auth(admin));
    expect(listing.body.appointmentSummary).toEqual(expected);
    expect(listing.text).not.toContain(String(hidden._id));
    expect((await request(app).get('/api/appointments/all').set(auth(admin))).body.count).toBe(6);
    const recent = await request(app).get('/api/admin/recent-activity').set(auth(admin));
    expect(recent.text).not.toContain(String(hidden._id));
    const earnings = await request(app).get('/api/admin/earnings').set(auth(admin));
    expect(earnings.body.doctors).toHaveLength(2);
    expect(earnings.body.doctors.find(row => row.name === 'Second doctor')).toMatchObject({ completedAppointments: 0, netReceived: 0 });
    expect((await request(app).put(`/api/admin/appointments/${hidden._id}/status`).set(auth(admin)).send({ status: 'confirmed' })).status).toBe(404);
  });

  test('earnings use received payments regardless of fee changes and retain deactivated or removed doctor attribution', async () => {
    const paid = await appointment('completed', { feeAtBooking: 125 });
    await appointment('completed');
    const receipt = await request(app).post(`/api/admin/appointments/${paid._id}/payment`).set(auth(admin)).send({ amount: 90.25, currency: 'USD', method: 'cash' });
    expect(receipt.status).toBe(201);
    await Doctor.updateOne({ _id: doctor._id }, { fee: 999 });
    await User.updateOne({ _id: doctorUser._id }, { isActive: false });
    const earnings = await request(app).get('/api/admin/earnings').set(auth(admin));
    expect(earnings.body.doctors[0]).toMatchObject({ netReceived: 90.25, receivedPayments: 1, isActive: false });
    const detail = await request(app).get(`/api/admin/doctors/${doctorUser._id}`).set(auth(admin));
    expect(detail.body.doctor.earnings).toBe(90.25);
    expect(detail.body.doctor.appointments).toHaveLength(2);
    await Doctor.deleteOne({ _id: doctor._id });
    const removed = await request(app).get('/api/admin/earnings').set(auth(admin));
    expect(removed.body.doctors[0]).toMatchObject({ doctorId: String(doctor._id), name: 'Removed doctor', netReceived: 90.25, receivedPayments: 1 });
    const listing = await request(app).get('/api/admin/appointments').set(auth(admin));
    expect(listing.body.count).toBe(2);
    expect(listing.body.appointments[0].doctor._id).toBe(String(doctor._id));
  });

  test('operational filtering is validated and keeps history separate from current status', async () => {
    await appointment('confirmed', { rescheduleHistory: history() });
    await appointment('cancelled');
    expect((await request(app).get('/api/admin/appointments?status=rescheduled').set(auth(admin))).body.count).toBe(1);
    expect((await request(app).get('/api/admin/appointments?status=cancelled').set(auth(admin))).body.count).toBe(1);
    expect((await request(app).get(`/api/admin/appointments?doctorId=${doctor._id}&dateFrom=2030-01-01&dateTo=2030-01-08`).set(auth(admin))).body.count).toBe(2);
    for (const query of ['status=bad', 'status=confirmed&status=cancelled', 'doctorId=bad', 'dateFrom=bad', 'dateFrom=2030-02-01&dateTo=2030-01-01']) {
      expect((await request(app).get(`/api/admin/appointments?${query}`).set(auth(admin))).status).toBe(400);
    }
  });

  test('only administrators can access operational summaries and per-doctor earnings', async () => {
    for (const endpoint of ['/api/admin/stats', '/api/admin/earnings', '/api/admin/appointments']) {
      expect((await request(app).get(endpoint)).status).toBe(401);
      for (const user of [patient, doctorUser]) expect((await request(app).get(endpoint).set(auth(user))).status).toBe(403);
    }
    const result = await request(app).get('/api/admin/stats').set(auth(admin));
    expect(result.body.appointmentSummary).toEqual({ total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, rescheduled: 0 });
  });
});
