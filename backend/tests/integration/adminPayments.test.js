const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../../server');
const User = require('../../models/User');
const Doctor = require('../../models/Doctor');
const Appointment = require('../../models/Appointment');
const Payment = require('../../models/Payment');
const assertTestDatabase = require('../helpers/testDatabase');

const withMongo = process.env.MONGO_TEST_URI ? describe : describe.skip;
const auth = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, version: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })}` });

withMongo('Audited manual payment receipts', () => {
  jest.setTimeout(30000);
  let admin, patient, doctorUser, doctor, booking;
  const payload = { amount: 80.29, currency: 'USD', method: 'bank_transfer', reference: 'BANK-RECEIPT-123' };
  beforeAll(async () => {
    assertTestDatabase(process.env.MONGO_TEST_URI);
    await mongoose.connect(process.env.MONGO_TEST_URI, { autoIndex: false });
    await Promise.all([User.createIndexes(), Appointment.createIndexes(), Payment.createIndexes()]);
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Doctor.deleteMany({}), Appointment.deleteMany({}), Payment.deleteMany({})]);
    const create = (role) => User.create({ name: `QA ${role}`, email: `pay-${role}@example.test`, password: 'QA-password-12345', role, isVerified: true });
    [admin, patient, doctorUser] = await Promise.all(['admin', 'patient', 'doctor'].map(create));
    doctor = await Doctor.create({ user: doctorUser._id, specialty: 'General Practice', fee: 500 });
    booking = await Appointment.create({ patient: patient._id, doctor: doctor._id, date: '2030-01-07', time: '10:00 AM', status: 'confirmed', feeAtBooking: 500, notes: 'SECRET_CLINICAL', symptoms: 'SECRET_CLINICAL' });
  });
  afterAll(async () => mongoose.disconnect());
  const receive = (body = payload) => request(app).post(`/api/admin/appointments/${booking._id}/payment`).set(auth(admin)).send(body);

  test('records only the actual received amount, snapshots server-side attribution and returns safe audit fields', async () => {
    const result = await receive({ ...payload, doctor: new mongoose.Types.ObjectId(), patient: new mongoose.Types.ObjectId(), recordedBy: patient._id, status: 'refunded', amountMinor: 1, cardNumber: 'SECRET_CARD', notes: 'SECRET_NOTE' });
    expect(result.status).toBe(201);
    expect(result.body.payment).toMatchObject({ amount: 80.29, currency: 'USD', status: 'received', doctorId: String(doctor._id), patientId: String(patient._id), recordedBy: String(admin._id), method: 'bank_transfer' });
    expect(result.text).not.toMatch(/SECRET_/);
    const saved = await Payment.findById(result.body.payment.id);
    expect(saved.amountMinor).toBe(8029);
    expect(saved.toObject()).not.toHaveProperty('cardNumber');
    expect(saved.refundedBy).toBeUndefined();
    const stats = await request(app).get('/api/admin/stats').set(auth(admin));
    expect(stats.body.earnings.netReceived).toBe(80.29);
    expect(stats.body.stats.revenue).toBe('$80.29');
    for (const endpoint of ['/api/admin/appointments', '/api/appointments/all']) {
      const listing = await request(app).get(endpoint).set(auth(admin));
      expect(listing.body.appointments[0]).toMatchObject({ paymentStatus: 'received', payment: { id: result.body.payment.id, amount: 80.29 } });
      expect(listing.text).not.toContain('SECRET_CLINICAL');
    }
  });

  test('concurrent receipt recording creates exactly one received receipt', async () => {
    const results = await Promise.all([receive(), receive()]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await Payment.countDocuments()).toBe(1);
    expect((await request(app).get('/api/admin/earnings').set(auth(admin))).body.earnings.netReceived).toBe(80.29);
  });

  test('refund is audited once, retained in history, and a later receipt is independent', async () => {
    const receipt = (await receive()).body.payment;
    const refund = () => request(app).post(`/api/admin/payments/${receipt.id}/refund`).set(auth(admin)).send({ reason: 'Verified refund already issued' });
    const results = await Promise.all([refund(), refund()]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const refunded = results.find((result) => result.status === 200).body.payment;
    expect(refunded).toMatchObject({ status: 'refunded', refundedBy: String(admin._id), refundReason: 'Verified refund already issued' });
    expect(refunded.refundedAt).toBeTruthy();
    let summary = (await request(app).get('/api/admin/earnings').set(auth(admin))).body.earnings;
    expect(summary).toMatchObject({ receivedAmount: 80.29, refundedAmount: 80.29, netReceived: 0, receivedPayments: 0 });
    const next = await receive({ ...payload, amount: 70 });
    expect(next.status).toBe(201);
    expect(next.body.payment.id).not.toBe(receipt.id);
    const history = await request(app).get(`/api/admin/payments?appointmentId=${booking._id}`).set(auth(admin));
    expect(history.body.count).toBe(2);
    expect(history.body.payments.map((payment) => payment.status).sort()).toEqual(['received', 'refunded']);
    summary = history.body.earnings;
    expect(summary).toMatchObject({ receivedAmount: 150.29, refundedAmount: 80.29, netReceived: 70, receivedPayments: 1 });
    const listing = await request(app).get('/api/admin/appointments').set(auth(admin));
    expect(listing.body.appointments[0]).toMatchObject({ paymentStatus: 'received', payment: { id: next.body.payment.id, amount: 70 } });
    expect((await request(app).post(`/api/admin/payments/${receipt.id}/refund`).set(auth(admin)).send({ reason: 'Repeat' })).status).toBe(409);
  });

  test('booking completion or fee snapshots never fabricate a received payment', async () => {
    await Appointment.updateOne({ _id: booking._id }, { status: 'completed', feeAtBooking: 500 });
    const stats = await request(app).get('/api/admin/stats').set(auth(admin));
    expect(stats.body.earnings).toEqual({ receivedAmount: 0, refundedAmount: 0, netReceived: 0, receivedPayments: 0, currency: 'USD', basis: 'recorded_payments' });
    const listing = await request(app).get('/api/admin/appointments').set(auth(admin));
    expect(listing.body.appointments[0]).toMatchObject({ paymentStatus: 'unpaid', payment: null });
    expect((await receive()).status).toBe(201);
  });

  test('cancellation does not invent a refund and a cancelled booking cannot receive a new payment', async () => {
    const receipt = (await receive()).body.payment;
    expect((await request(app).put(`/api/admin/appointments/${booking._id}/status`).set(auth(admin)).send({ status: 'cancelled' })).status).toBe(200);
    expect((await request(app).get('/api/admin/earnings').set(auth(admin))).body.earnings.netReceived).toBe(80.29);
    expect((await receive()).status).toBe(409);
    expect((await request(app).post(`/api/admin/payments/${receipt.id}/refund`).set(auth(admin)).send({ reason: 'Refund returned after cancellation' })).status).toBe(200);
    expect((await request(app).get('/api/admin/earnings').set(auth(admin))).body.earnings.netReceived).toBe(0);
    expect((await receive()).status).toBe(409);
    expect(await Payment.countDocuments()).toBe(1);
  });

  test('retains receipt attribution and totals when the doctor or appointment is removed', async () => {
    const receipt = (await receive()).body.payment;
    await Promise.all([Appointment.deleteOne({ _id: booking._id }), Doctor.deleteOne({ _id: doctor._id })]);
    const earnings = await request(app).get('/api/admin/earnings').set(auth(admin));
    expect(earnings.body.doctors[0]).toMatchObject({ doctorId: String(doctor._id), name: 'Removed doctor', netReceived: 80.29, receivedPayments: 1 });
    const history = await request(app).get(`/api/admin/payments?doctorId=${doctor._id}`).set(auth(admin));
    expect(history.body.payments[0]).toMatchObject({ id: receipt.id, doctorId: String(doctor._id), patientId: String(patient._id) });
    expect((await request(app).post(`/api/admin/payments/${receipt.id}/refund`).set(auth(admin)).send({ reason: 'Verified refund after account removal' })).status).toBe(200);
  });

  test('refuses held bookings, unknown appointments and invalid or excessive receipt amounts', async () => {
    const bodies = [0, -1, 1.001, 1000000.01, '80.29', null].map((amount) => ({ ...payload, amount }));
    bodies.push({ ...payload, currency: 'LKR' }, { ...payload, currency: ['USD'] }, { ...payload, method: 'crypto' }, { ...payload, receivedAt: 'not-a-date' }, { ...payload, receivedAt: '2099-01-01T00:00:00Z' }, { ...payload, receivedAt: '2026-01-01' });
    for (const body of bodies) expect((await receive(body)).status).toBe(400);
    expect(await Payment.countDocuments()).toBe(0);
    await Appointment.updateOne({ _id: booking._id }, { bookingHold: { token: 'hidden', expiresAt: new Date(Date.now() + 60000) } });
    expect((await receive()).status).toBe(404);
    expect((await request(app).post(`/api/admin/appointments/${new mongoose.Types.ObjectId()}/payment`).set(auth(admin)).send(payload)).status).toBe(404);
    expect((await request(app).post(`/api/admin/payments/${new mongoose.Types.ObjectId()}/refund`).set(auth(admin)).send({ reason: 'Unknown' })).status).toBe(404);
  });

  test('receipt and refund APIs are administrator-only and refund requires an explicit reason', async () => {
    const receipt = (await receive()).body.payment;
    for (const user of [patient, doctorUser]) {
      expect((await request(app).get('/api/admin/payments').set(auth(user))).status).toBe(403);
      expect((await request(app).post(`/api/admin/appointments/${booking._id}/payment`).set(auth(user)).send(payload)).status).toBe(403);
      expect((await request(app).post(`/api/admin/payments/${receipt.id}/refund`).set(auth(user)).send({ reason: 'Not allowed' })).status).toBe(403);
    }
    expect((await request(app).get('/api/admin/payments')).status).toBe(401);
    expect((await request(app).post(`/api/admin/payments/${receipt.id}/refund`).set(auth(admin)).send({ reason: ' ' })).status).toBe(400);
    expect((await Payment.findById(receipt.id)).status).toBe('received');
    for (const query of ['status=bad', 'status=received&status=refunded', 'doctorId=bad', 'appointmentId=bad']) {
      expect((await request(app).get(`/api/admin/payments?${query}`).set(auth(admin))).status).toBe(400);
    }
  });
});
