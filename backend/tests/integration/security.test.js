const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { app } = require('../../server');
const User = require('../../models/User');
const Doctor = require('../../models/Doctor');
const Appointment = require('../../models/Appointment');
const Availability = require('../../models/Availability');
const MedicalRecord = require('../../models/MedicalRecord');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const assertTestDatabase = require('../helpers/testDatabase');

const dns = require('dns');
if (process.env.MONGO_TEST_URI && process.env.MONGO_TEST_URI.startsWith('mongodb+srv://')) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (_) {}
}

const describeWithMongo = process.env.MONGO_TEST_URI ? describe : describe.skip;
const tokenFor = (user) => jwt.sign({ id: user._id, version: user.tokenVersion || 0 }, process.env.JWT_SECRET);
const auth = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });
const nextMonday = () => {
  const date = new Date();
  date.setDate(date.getDate() + 14 + ((8 - date.getDay()) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

describeWithMongo('MongoDB security and booking integration', () => {
  jest.setTimeout(60000);

  beforeAll(async () => {
    assertTestDatabase(process.env.MONGO_TEST_URI);
    process.env.JWT_SECRET = 'integration-only-secret';
    await mongoose.connect(process.env.MONGO_TEST_URI, { autoIndex: false, serverSelectionTimeoutMS: 30000 });
    await User.createIndexes();
    await Appointment.createIndexes();
    await Availability.createIndexes();
    await Payment.createIndexes();
    await Payout.createIndexes();
  }, 60000);

  afterEach(async () => {
    await Promise.all([
      User.deleteMany({}), Doctor.deleteMany({}), Appointment.deleteMany({}), MedicalRecord.deleteMany({}), Payment.deleteMany({}), Payout.deleteMany({}),
    ]);
  });

  afterAll(async () => mongoose.disconnect());

  const createUser = (suffix, role = 'patient') => User.create({
    name: `QA ${suffix}`,
    email: `${suffix}@example.test`,
    password: 'test-password-123',
    role,
    isVerified: true,
  });

  test('only a treating doctor reads records and private records remain hidden', async () => {
    const patient = await createUser('record-patient');
    const doctorAUser = await createUser('record-doctor-a', 'doctor');
    const doctorBUser = await createUser('record-doctor-b', 'doctor');
    const doctorA = await Doctor.create({ user: doctorAUser._id, specialty: 'General', fee: 100 });
    await Doctor.create({ user: doctorBUser._id, specialty: 'General', fee: 100 });
    const appointment = await Appointment.create({ patient: patient._id, doctor: doctorA._id, date: nextMonday(), time: '10:00 AM', status: 'confirmed' });
    await MedicalRecord.create({ patient: patient._id, title: 'Visible', date: nextMonday(), isPrivate: false, addedBy: 'patient' });
    await MedicalRecord.create({ patient: patient._id, title: 'Private', date: nextMonday(), isPrivate: true, addedBy: 'patient' });

    const allowed = await request(app).get(`/api/records/patient/${patient._id}`).set(auth(doctorAUser));
    expect(allowed.status).toBe(200);
    expect(allowed.body.records.map((record) => record.title)).toEqual(['Visible']);

    const denied = await request(app).get(`/api/records/patient/${patient._id}`).set(auth(doctorBUser));
    expect(denied.status).toBe(403);

    const forged = await request(app).post('/api/records/doctor-add').set(auth(doctorBUser)).send({
      patientId: String(patient._id), appointmentId: String(appointment._id), title: 'Forged',
    });
    expect(forged.status).toBe(403);
    expect(await MedicalRecord.countDocuments({ title: 'Forged' })).toBe(0);
  });

  test('simultaneous booking requests reserve a slot only once', async () => {
    const patientA = await createUser('booking-patient-a');
    const patientB = await createUser('booking-patient-b');
    const doctorUser = await createUser('booking-doctor', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, specialty: 'General', fee: 100 });
    const payload = { doctorId: String(doctor._id), date: nextMonday(), time: '10:00 AM' };

    const responses = await Promise.all([
      request(app).post('/api/appointments').set(auth(patientA)).send(payload),
      request(app).post('/api/appointments').set(auth(patientB)).send(payload),
    ]);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect([400, 409]).toContain(responses.find((response) => response.status !== 201).status);
    expect(await Appointment.countDocuments({ doctor: doctor._id, date: payload.date, time: payload.time })).toBe(1);
  });

  test('deactivating a doctor preserves patient records and invalidates their token', async () => {
    const admin = await createUser('admin', 'admin');
    const patient = await createUser('deactivation-patient');
    const doctorUser = await createUser('deactivation-doctor', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, specialty: 'General', fee: 100 });
    await Appointment.create({ patient: patient._id, doctor: doctor._id, date: nextMonday(), time: '11:00 AM', status: 'confirmed' });
    await MedicalRecord.create({ patient: patient._id, doctor: doctor._id, title: 'Retain', date: nextMonday() });

    const result = await request(app).delete(`/api/admin/users/${doctorUser._id}`).set(auth(admin));
    expect(result.status).toBe(200);
    expect(await Appointment.countDocuments({ doctor: doctor._id })).toBe(1);
    expect(await MedicalRecord.countDocuments({ doctor: doctor._id })).toBe(1);
    expect((await User.findById(doctorUser._id)).isActive).toBe(false);
    const blocked = await request(app).get('/api/auth/me').set(auth(doctorUser));
    expect(blocked.status).toBe(401);
  });

  test('email uniqueness is enforced by MongoDB', async () => {
    await createUser('unique-email');
    await expect(createUser('unique-email')).rejects.toMatchObject({ code: 11000 });
  });

  test('attachment removal requires an exact index and persists only the selected deletion', async () => {
    const patient = await createUser('attachment-index-patient');
    const attachment = name => ({ name, type: 'application/pdf',
      url: `data:application/pdf;base64,${Buffer.from('%PDF-1.4\nSynthetic report').toString('base64')}` });
    const record = await MedicalRecord.create({ patient: patient._id, title: 'Index safety report', date: nextMonday(),
      addedBy: 'patient', attachments: [attachment('first.pdf'), attachment('second.pdf')] });
    const rejected = await request(app).delete(`/api/records/${record._id}/attachments/0junk`).set(auth(patient));
    expect(rejected.status).toBe(400);
    expect((await MedicalRecord.findById(record._id)).attachments.map(item => item.name)).toEqual(['first.pdf', 'second.pdf']);
    const removed = await request(app).delete(`/api/records/${record._id}/attachments/0`).set(auth(patient));
    expect(removed.status).toBe(200);
    expect((await MedicalRecord.findById(record._id)).attachments.map(item => item.name)).toEqual(['second.pdf']);
  });

  test('appointment completion auto-credits payment into doctor earnings and hospital revenue, invisible to patient', async () => {
    const admin = await createUser('earn-admin', 'admin');
    const patient = await createUser('earn-patient', 'patient');
    const doctorUser = await createUser('earn-doctor', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, specialty: 'Cardiology', fee: 120 });
    const appointment = await Appointment.create({
      patient: patient._id, doctor: doctor._id, date: nextMonday(), time: '02:00 PM', status: 'confirmed', feeAtBooking: 120,
    });

    // Doctor marks appointment completed
    const completeRes = await request(app).put(`/api/appointments/${appointment._id}/status`).set(auth(doctorUser)).send({ status: 'completed' });
    expect(completeRes.status).toBe(200);

    // Verify Payment document was automatically created with method auto_credit
    const payment = await Payment.findOne({ appointment: appointment._id });
    expect(payment).not.toBeNull();
    expect(payment.amountMinor).toBe(12000);
    expect(payment.method).toBe('auto_credit');
    expect(payment.status).toBe('received');

    // Doctor can see their earnings
    const docEarnings = await request(app).get('/api/payments/my').set(auth(doctorUser));
    expect(docEarnings.status).toBe(200);
    expect(docEarnings.body.earnings.netReceived).toBe(120);

    // Admin can see the hospital earnings
    const adminEarnings = await request(app).get('/api/admin/earnings').set(auth(admin));
    expect(adminEarnings.status).toBe(200);
    expect(adminEarnings.body.earnings.netReceived).toBe(120);

    // Patient is strictly forbidden from accessing doctor earnings or hospital revenue
    expect((await request(app).get('/api/payments/my').set(auth(patient))).status).toBe(403);
    expect((await request(app).get('/api/admin/earnings').set(auth(patient))).status).toBe(403);
  });

  test('only admin can fix doctor consultation fee and doctors cannot alter their own fee', async () => {
    const admin = await createUser('fee-admin', 'admin');
    const patient = await createUser('fee-patient', 'patient');
    const doctorUser = await createUser('fee-doctor', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, specialty: 'Neurology', fee: 150 });

    // Doctor attempts to alter fee
    const doctorEdit = await request(app).put('/api/doctors/profile').set(auth(doctorUser)).send({ fee: 999 });
    expect(doctorEdit.status).toBe(200);
    expect((await Doctor.findById(doctor._id)).fee).toBe(150);

    // Patient attempts to alter doctor fee
    const patientEdit = await request(app).put(`/api/admin/doctors/${doctor._id}/fee`).set(auth(patient)).send({ fee: 50 });
    expect(patientEdit.status).toBe(403);

    // Admin fixes doctor fee
    const adminEdit = await request(app).put(`/api/admin/doctors/${doctor._id}/fee`).set(auth(admin)).send({ fee: 220 });
    expect(adminEdit.status).toBe(200);
    expect(adminEdit.body.doctor.fee).toBe(220);
    expect((await Doctor.findById(doctor._id)).fee).toBe(220);
  });

  test('admin disburses salary to doctor bank via payout portal, updating pending balance', async () => {
    const admin = await createUser('payout-admin', 'admin');
    const patient = await createUser('payout-patient', 'patient');
    const doctorUser = await createUser('payout-doctor', 'doctor');
    const doctor = await Doctor.create({
      user: doctorUser._id,
      specialty: 'Orthopedics',
      fee: 200,
      bankDetails: { bankName: 'National Bank', accountNumber: '1122334455', accountHolderName: 'Sample Doctor' },
    });

    // Create completed appointment with auto payment
    const appt = await Appointment.create({
      patient: patient._id, doctor: doctor._id, date: nextMonday(), time: '04:00 PM', status: 'completed', feeAtBooking: 200,
    });
    await Payment.create({
      appointment: appt._id, doctor: doctor._id, patient: patient._id, amountMinor: 20000, currency: 'USD',
      method: 'auto_credit', status: 'received', receivedAt: new Date(), recordedAt: new Date(), recordedBy: admin._id,
    });

    // Admin disburses salary
    const payoutRes = await request(app).post('/api/admin/payouts').set(auth(admin)).send({
      doctorId: doctor._id,
      amount: 150,
      bankDetails: { bankName: 'National Bank', accountNumber: '1122334455', accountHolderName: 'Sample Doctor' },
      reference: 'SAL-001',
    });
    expect(payoutRes.status).toBe(201);

    // Doctor checks payouts and balance
    const doctorPay = await request(app).get('/api/payments/my').set(auth(doctorUser));
    expect(doctorPay.status).toBe(200);
    expect(doctorPay.body.grossEarned).toBe(200);
    expect(doctorPay.body.totalPaidOut).toBe(0);
    expect(doctorPay.body.payouts[0].status).toBe('pending');
    expect(doctorPay.body.reservedPayouts).toBe(150);
    expect(doctorPay.body.pendingBalance).toBe(50);
    expect(doctorPay.body.payouts).toHaveLength(1);

    // Non-admin cannot disburse payout
    expect((await request(app).post('/api/admin/payouts').set(auth(patient)).send({ doctorId: doctor._id, amount: 50 })).status).toBe(403);
    expect((await request(app).post('/api/admin/payouts').set(auth(doctorUser)).send({ doctorId: doctor._id, amount: 50 })).status).toBe(403);
  });

  test('patient and admin profiles initialize with empty avatar and permit identical photo management', async () => {
    const patient = await createUser('avatar-patient', 'patient');
    const admin = await createUser('avatar-admin', 'admin');

    // Both profiles start with no avatar (empty)
    expect(patient.avatar).toBeFalsy();
    expect(admin.avatar).toBeFalsy();

    // Patient uploads profile photo
    const samplePhoto = `data:image/png;base64,${Buffer.from('fake-png-content').toString('base64')}`;
    const patUpload = await request(app).put('/api/auth/profile').set(auth(patient)).send({ avatar: samplePhoto });
    expect(patUpload.status).toBe(200);
    expect(patUpload.body.user.avatar).toBe(samplePhoto);

    // Admin uploads profile photo
    const admUpload = await request(app).put('/api/auth/profile').set(auth(admin)).send({ avatar: samplePhoto });
    expect(admUpload.status).toBe(200);
    expect(admUpload.body.user.avatar).toBe(samplePhoto);

    // Patient removes photo
    const patRemove = await request(app).put('/api/auth/profile').set(auth(patient)).send({ avatar: null });
    expect(patRemove.status).toBe(200);
    expect(patRemove.body.user.avatar).toBeNull();

    // Admin removes photo
    const admRemove = await request(app).put('/api/auth/profile').set(auth(admin)).send({ avatar: null });
    expect(admRemove.status).toBe(200);
    expect(admRemove.body.user.avatar).toBeNull();
  });
});
