const request = require('supertest');
const express = require('express');

jest.mock('../../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = { _id: '507f1f77bcf86cd799439099', role: 'admin' };
    next();
  },
  authorize: () => (req, res, next) => next(),
}));
jest.mock('../../models/User');
jest.mock('../../models/Doctor');
jest.mock('../../models/Appointment');
jest.mock('../../models/Availability');
jest.mock('../../models/MedicalRecord');
jest.mock('../../models/Message');
jest.mock('../../models/ContactMessage');

const User = require('../../models/User');
const Doctor = require('../../models/Doctor');
const Appointment = require('../../models/Appointment');
const Availability = require('../../models/Availability');
const MedicalRecord = require('../../models/MedicalRecord');
const Message = require('../../models/Message');
const adminRoutes = require('../../routes/adminRoutes');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

describe('Admin Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deactivates a doctor without deleting appointments or medical records', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const doctorId = '507f191e810c19729de860ea';
    const user = { _id: userId, name: 'QA Doctor', role: 'doctor', save: jest.fn() };
    const doctor = { _id: doctorId, available: true, save: jest.fn() };
    User.findById.mockResolvedValue(user);
    Doctor.findOne.mockResolvedValue(doctor);

    const res = await request(app).delete(`/api/admin/users/${userId}`);

    expect(res.statusCode).toBe(200);
    expect(user.isActive).toBe(false);
    expect(user.save).toHaveBeenCalled();
    expect(doctor.available).toBe(false);
    expect(doctor.save).toHaveBeenCalled();
    expect(Appointment.deleteMany).not.toHaveBeenCalled();
    expect(MedicalRecord.deleteMany).not.toHaveBeenCalled();
    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('creates a doctor without returning or storing a plaintext password', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: '507f1f77bcf86cd799439022', name: 'Dr QA', email: 'qa@example.com', role: 'doctor' });
    Doctor.create.mockResolvedValue({ _id: '507f1f77bcf86cd799439023', specialty: 'General', fee: 100 });
    Availability.create.mockResolvedValue({});

    const res = await request(app).post('/api/admin/doctors').send({
      name: 'Dr QA', email: 'QA@EXAMPLE.COM', password: 'plaintext-from-client', specialty: 'General', fee: 100,
    });

    expect(res.status).toBe(201);
    expect(User.create.mock.calls[0][0].password).not.toBe('plaintext-from-client');
    expect(Doctor.create.mock.calls[0][0]).not.toHaveProperty('tempPassword');
    expect(JSON.stringify(res.body)).not.toContain('plaintext-from-client');
    expect(res.body.user).not.toHaveProperty('password');
  });
});
