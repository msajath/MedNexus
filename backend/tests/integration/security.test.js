const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { app } = require('../../server');
const User = require('../../models/User');
const Doctor = require('../../models/Doctor');
const Appointment = require('../../models/Appointment');
const MedicalRecord = require('../../models/MedicalRecord');

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
  jest.setTimeout(30000);

  beforeAll(async () => {
    process.env.JWT_SECRET = 'integration-only-secret';
    await mongoose.connect(process.env.MONGO_TEST_URI, { autoIndex: false, serverSelectionTimeoutMS: 30000 });
    await User.createIndexes();
    await Appointment.createIndexes();
  }, 30000);

  afterEach(async () => {
    await Promise.all([
      User.deleteMany({}), Doctor.deleteMany({}), Appointment.deleteMany({}), MedicalRecord.deleteMany({}),
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
});
