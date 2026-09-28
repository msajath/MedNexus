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

  it('cascades dependent data when deleting a doctor user', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const doctorId = '507f191e810c19729de860ea';
    User.findById.mockResolvedValue({ _id: userId, name: 'QA Doctor', role: 'doctor' });
    Doctor.findOne.mockResolvedValue({ _id: doctorId });
    Availability.deleteMany.mockResolvedValue({ deletedCount: 1 });
    Appointment.deleteMany.mockResolvedValue({ deletedCount: 2 });
    MedicalRecord.deleteMany.mockResolvedValue({ deletedCount: 1 });
    Message.deleteMany.mockResolvedValue({ deletedCount: 1 });
    Doctor.deleteOne.mockResolvedValue({ deletedCount: 1 });
    User.findByIdAndDelete.mockResolvedValue({ _id: userId });

    const res = await request(app).delete(`/api/admin/users/${userId}`);

    expect(res.statusCode).toBe(200);
    expect(Availability.deleteMany).toHaveBeenCalledWith({ doctor: doctorId });
    expect(Appointment.deleteMany).toHaveBeenCalledWith({
      $or: [{ patient: userId }, { doctor: doctorId }],
    });
    expect(MedicalRecord.deleteMany).toHaveBeenCalledWith({
      $or: [{ patient: userId }, { doctor: doctorId }],
    });
    expect(Message.deleteMany).toHaveBeenCalledWith({ recipient: userId });
    expect(Doctor.deleteOne).toHaveBeenCalledWith({ _id: doctorId });
    expect(User.findByIdAndDelete).toHaveBeenCalledWith(userId);
  });
});
