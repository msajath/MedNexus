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

withMongo('Doctors can read only their own recorded-payment totals', () => {
  jest.setTimeout(60000);
  let admin, patient, doctorUser, otherDoctorUser, doctor, otherDoctor;
  beforeAll(async () => {
    assertTestDatabase(process.env.MONGO_TEST_URI);
    await mongoose.connect(process.env.MONGO_TEST_URI, { autoIndex: false });
    await Promise.all([User.createIndexes(), Appointment.createIndexes(), Payment.createIndexes()]);
  });
  beforeEach(async () => {
    await Promise.all([Payment.deleteMany({}), Appointment.deleteMany({}), Doctor.deleteMany({}), User.deleteMany({})]);
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
    expect(own.body).toEqual({ success: true, earnings: {
      receivedAmount: 250.2, refundedAmount: 50.1, netReceived: 200.1, receivedPayments: 1, currency: 'USD', basis: 'recorded_payments',
    } });
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
});
