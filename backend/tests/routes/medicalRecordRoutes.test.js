const request = require('supertest');
const express = require('express');

jest.mock('../../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = { _id: '507f1f77bcf86cd799439011', role: 'doctor', isVerified: req.headers['x-unverified'] !== 'true' };
    next();
  },
  authorize: (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.sendStatus(403),
}));
jest.mock('../../models/Doctor');
jest.mock('../../models/Appointment');
jest.mock('../../models/MedicalRecord');

const Doctor = require('../../models/Doctor');
const Appointment = require('../../models/Appointment');
const MedicalRecord = require('../../models/MedicalRecord');
const routes = require('../../routes/medicalRecordRoutes');
const app = express();
app.use(express.json());
app.use('/api/records', routes);

const patientId = '507f1f77bcf86cd799439012';
const doctorId = '507f1f77bcf86cd799439013';
const appointmentId = '507f1f77bcf86cd799439014';

beforeEach(() => {
  jest.clearAllMocks();
  Doctor.findOne.mockResolvedValue({ _id: doctorId });
});

test('denies a doctor with no confirmed treatment relationship', async () => {
  Appointment.find.mockReturnValue({
    select: jest.fn().mockResolvedValue([]),
  });

  const res = await request(app).get(`/api/records/patient/${patientId}`);

  expect(res.status).toBe(403);
  expect(MedicalRecord.find).not.toHaveBeenCalled();
});

test('denies an unapproved doctor before reading patient records', async () => {
  const res = await request(app).get(`/api/records/patient/${patientId}`).set('x-unverified', 'true');

  expect(res.status).toBe(403);
  expect(Appointment.find).not.toHaveBeenCalled();
});

test('filters private records when treatment relationship exists', async () => {
  const appointmentQuery = {
    select: jest.fn().mockResolvedValue([{ _id: appointmentId }]),
  };
  Appointment.find.mockReturnValue(appointmentQuery);
  const sort = jest.fn().mockResolvedValue([]);
  MedicalRecord.find.mockReturnValue({ sort });

  const res = await request(app).get(`/api/records/patient/${patientId}`);

  expect(res.status).toBe(200);
  expect(MedicalRecord.find).toHaveBeenCalledWith({
    patient: patientId,
    deletedAt: null,
    isPrivate: { $ne: true },
    $or: [
      { addedBy: 'patient' },
      { doctor: doctorId },
      { appointment: { $in: [appointmentId] } },
    ],
  });
});

test('requires an appointment belonging to the doctor and patient before adding a record', async () => {
  Appointment.findOne.mockResolvedValue(null);

  const res = await request(app).post('/api/records/doctor-add').send({
    patientId, appointmentId, title: 'Unauthorized record',
  });

  expect(res.status).toBe(403);
  expect(Appointment.findOne).toHaveBeenCalledWith(expect.objectContaining({
    _id: appointmentId, patient: patientId, doctor: doctorId,
  }));
  expect(MedicalRecord.create).not.toHaveBeenCalled();
});
