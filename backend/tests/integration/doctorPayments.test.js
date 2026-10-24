const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../../server');
const User = require('../../models/User');
const Doctor = require('../../models/Doctor');
const Appointment = require('../../models/Appointment');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const assertTestDatabase = require('../helpers/testDatabase');

const withMongo = process.env.MONGO_TEST_URI ? describe : describe.skip;
const auth = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, version: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })}` });

withMongo('Doctors can read only their own recorded-payment totals', () => {
  jest.setTimeout(60000);
  let admin, patient, doctorUser, otherDoctorUser, doctor, otherDoctor;
  beforeAll(async () => {
    assertTestDatabase(process.env.MONGO_TEST_URI);
    await mongoose.connect(process.env.MONGO_TEST_URI, { autoIndex: false });
    await Promise.all([User.createIndexes(), Appointment.createIndexes(), Payment.createIndexes(), Payout.createIndexes()]);
  });
  beforeEach(async () => {
    await Promise.all([Payment.deleteMany({}), Payout.deleteMany({}), Appointment.deleteMany({}), Doctor.deleteMany({}), User.deleteMany({})]);
    const create = (role, suffix = '') => User.create({ name: `QA ${role}${suffix}`, email: `doctor-pay-${role}${suffix}@example.test`, password: 'QA-password-12345', role, isVerified: true });
    [admin, patient, doctorUser, otherDoctorUser] = await Promise.all([create('admin'), create('patient'), create('doctor'), create('doctor', '2')]);
    [doctor, otherDoctor] = await Promise.all([
      Doctor.create({ user: doctorUser._id, specialty: 'General Practice', fee: 500 }),
      Doctor.create({ user: otherDoctorUser._id, specialty: 'Dermatology', fee: 900 }),
    ]);
  });
  afterAll(async () => mongoose.disconnect());
  const receipt = (owner, amountMinor, status = 'received') => Payment.create({
    appointment: new mongoose.Types.ObjectId(), doctor: owner._id, patient: patient._id,
    amountMinor, currency: 'USD', method: 'bank_transfer', reference: 'SECRET_BANK_REFERENCE',
    status, receivedAt: new Date(), recordedAt: new Date(), recordedBy: admin._id,
    ...(status === 'refunded' ? { refundedAt: new Date(), refundedBy: admin._id, refundReason: 'SECRET_REFUND_REASON' } : {}),
  });

  test('own summary includes received money and refunds while excluding other doctors and all receipt details', async () => {
    await Promise.all([receipt(doctor, 20010), receipt(doctor, 5010, 'refunded'), receipt(otherDoctor, 999999)]);
    const own = await request(app).get(`/api/payments/my?doctorId=${otherDoctor._id}`).set(auth(doctorUser));
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({ success: true, earnings: {
      receivedAmount: 250.2, refundedAmount: 50.1, netReceived: 200.1, receivedPayments: 1, currency: 'USD', basis: 'recorded_payments',
    }, grossEarned: 200.1, totalPaidOut: 0, pendingBalance: 200.1 });
    expect(own.text).not.toMatch(/SECRET_|appointmentId|patientId|doctorId|recordedBy|reference|refundReason/);
    const other = await request(app).get('/api/payments/my').set(auth(otherDoctorUser));
    expect(other.status).toBe(200);
    expect(other.body.earnings).toMatchObject({ receivedAmount: 9999.99, refundedAmount: 0, netReceived: 9999.99, receivedPayments: 1 });
  });

  test('an unpaid completed booking never counts as received money', async () => {
    await Appointment.create({ patient: patient._id, doctor: doctor._id, date: '2030-01-07', time: '10:00 AM', status: 'completed', feeAtBooking: 500 });
    await receipt(otherDoctor, 90000);
    const result = await request(app).get('/api/payments/my').set(auth(doctorUser));
    expect(result.status).toBe(200);
    expect(result.body.earnings).toEqual({ receivedAmount: 0, refundedAmount: 0, netReceived: 0, receivedPayments: 0, currency: 'USD', basis: 'recorded_payments' });
  });

  test('anonymous, patient and admin callers cannot use a doctor-only payment summary', async () => {
    await receipt(doctor, 10000);
    expect((await request(app).get('/api/payments/my')).status).toBe(401);
    for (const user of [patient, admin]) expect((await request(app).get('/api/payments/my').set(auth(user))).status).toBe(403);
  });

  test('a missing doctor profile returns a safe 404 without leaking retained receipts', async () => {
    await receipt(doctor, 10000);
    await Doctor.deleteOne({ _id: doctor._id });
    const result = await request(app).get('/api/payments/my').set(auth(doctorUser));
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ success: false, message: 'Doctor profile not found' });
    expect(result.text).not.toMatch(/SECRET_|amountMinor|stack|Mongo/);
    expect(await Payment.countDocuments({ doctor: doctor._id })).toBe(1);
  });

  test('only admin can fix doctor consultation fee and doctors cannot alter their own fee', async () => {
    const doctorAttempt = await request(app).put('/api/doctors/profile').set(auth(doctorUser)).send({ fee: 999 });
    expect(doctorAttempt.status).toBe(200);
    const unchanged = await Doctor.findById(doctor._id);
    expect(unchanged.fee).toBe(500);

    const adminUpdate = await request(app).put(`/api/admin/doctors/${doctor._id}/fee`).set(auth(admin)).send({ fee: 175 });
    expect(adminUpdate.status).toBe(200);
    expect(adminUpdate.body.doctor.fee).toBe(175);
    const updated = await Doctor.findById(doctor._id);
    expect(updated.fee).toBe(175);

    const forbidden = await request(app).put(`/api/admin/doctors/${doctor._id}/fee`).set(auth(doctorUser)).send({ fee: 200 });
    expect(forbidden.status).toBe(403);
  });

  test('admin can disburse salary to doctor bank and doctor sees updated paid out balance', async () => {
    await receipt(doctor, 20000); // $200.00
    const payoutRes = await request(app).post('/api/admin/payouts').set(auth(admin)).send({
      doctorId: doctor._id,
      amount: 150,
      bankDetails: { bankName: 'Apex Bank', accountNumber: '987654321', accountHolderName: 'Dr. QA' },
      reference: 'SAL-2026-11',
      notes: 'Monthly salary disbursement',
    });
    expect(payoutRes.status).toBe(201);
    expect(payoutRes.body.payout.amount).toBe(150);

    const myEarnings = await request(app).get('/api/payments/my').set(auth(doctorUser));
    expect(myEarnings.status).toBe(200);
    expect(myEarnings.body.grossEarned).toBe(200);
    expect(myEarnings.body.totalPaidOut).toBe(0);
    expect(myEarnings.body.payouts[0].status).toBe('pending');
    expect(myEarnings.body.reservedPayouts).toBe(150);
    expect(myEarnings.body.pendingBalance).toBe(50);
    expect(myEarnings.body.payouts).toHaveLength(1);
    expect(myEarnings.body.payouts[0].reference).toBe('SAL-2026-11');

    const adminHistory = await request(app).get('/api/admin/payouts').set(auth(admin));
    expect(adminHistory.status).toBe(200);
    expect(adminHistory.body.payouts).toHaveLength(1);

    const patientForbidden = await request(app).post('/api/admin/payouts').set(auth(patient)).send({ doctorId: doctor._id, amount: 50 });
    expect(patientForbidden.status).toBe(403);
  });

  test('competing payout requests reserve earnings once, cancellation releases them without claiming a transfer', async () => {
    await receipt(doctor, 20000);
    const payload = { doctorId: doctor._id, amount: 150, bankDetails: { bankName: 'Sample Bank', accountNumber: '0000012345', accountHolderName: 'Sample Doctor' } };
    const results = await Promise.all([1, 2].map(() => request(app).post('/api/admin/payouts').set(auth(admin)).send(payload)));
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await Payout.countDocuments({ doctor: doctor._id, status: 'pending' })).toBe(1);
    const payout = results.find(r => r.status === 201).body.payout;
    expect(payout.bankDetails.accountNumber).toBe('****2345');
    const held = (await request(app).get('/api/payments/my').set(auth(doctorUser))).body;
    expect(held).toMatchObject({ totalPaidOut: 0, reservedPayouts: 150, pendingBalance: 50 });
    expect((await request(app).post(`/api/admin/payouts/${payout._id}/cancel`).set(auth(admin))).status).toBe(200);
    const released = (await request(app).get('/api/payments/my').set(auth(doctorUser))).body;
    expect(released).toMatchObject({ totalPaidOut: 0, reservedPayouts: 0, pendingBalance: 200 });
  });
});
