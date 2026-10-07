const request = require('supertest');
const express = require('express');
const appointmentRoutes = require('../../routes/appointmentRoutes');
const Appointment = require('../../models/Appointment');
const Doctor = require('../../models/Doctor');
const Availability = require('../../models/Availability');
const { protect, authorize } = require('../../middleware/auth');

jest.mock('../../models/Appointment');
jest.mock('../../models/Doctor');
jest.mock('../../models/Availability');
jest.mock('../../middleware/auth', () => ({
  protect: jest.fn((req, res, next) => {
    req.user = { _id: '507f1f77bcf86cd799439011', role: 'patient', name: 'John Doe' };
    next();
  }),
  authorize: jest.fn((...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  }),
}));

const app = express();
app.use(express.json());
app.use('/api/appointments', appointmentRoutes);

describe('Appointment Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock auth middleware to pass through with a mock patient
    protect.mockImplementation((req, res, next) => {
      req.user = { _id: '507f1f77bcf86cd799439011', role: 'patient', name: 'John Doe' };
      next();
    });

    authorize.mockImplementation((...roles) => (req, res, next) => {
      if (roles.includes(req.user.role)) {
        return next();
      }
      return res.status(403).json({ success: false, message: 'Forbidden' });
    });
  });

  describe('POST /api/appointments', () => {
    const validDoctorId = '507f1f77bcf86cd799439012';

    it('should return 404 if doctor does not exist', async () => {
      Doctor.findById.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/appointments')
        .send({
          doctorId: validDoctorId,
          date: '2026-10-12', // Monday
          time: '10:00 AM',
          type: 'Consultation',
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('Doctor not found');
    });

    it('should return 400 if appointment time is outside doctor schedule', async () => {
      Doctor.findById.mockResolvedValue({ _id: validDoctorId });
      Availability.findOne.mockResolvedValue({
        doctor: validDoctorId,
        schedule: [
          { day: 'Monday', enabled: true, start: '09:00', end: '11:00' },
        ],
      });

      const res = await request(app)
        .post('/api/appointments')
        .send({
          doctorId: validDoctorId,
          date: '2026-10-12', // Monday
          time: '04:00 PM', // outside schedule
          type: 'Consultation',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('outside the doctor\'s availability');
    });

    it('should return 400 if slot is already booked', async () => {
      Doctor.findById.mockResolvedValue({ _id: validDoctorId });
      Availability.findOne.mockResolvedValue(null); // falls back to default schedule
      Appointment.findOne.mockResolvedValue({ _id: 'existing-appt-id' });

      const res = await request(app)
        .post('/api/appointments')
        .send({
          doctorId: validDoctorId,
          date: '2026-10-12', // Monday
          time: '10:00 AM',
          type: 'Consultation',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('This time slot is already booked');
    });

    it('should book an appointment successfully', async () => {
      Doctor.findById.mockResolvedValue({ _id: validDoctorId });
      Availability.findOne.mockResolvedValue(null);
      Appointment.findOne.mockResolvedValue(null);

      const mockCreated = {
        _id: '507f1f77bcf86cd799439099',
        patient: '507f1f77bcf86cd799439011',
        doctor: validDoctorId,
        date: '2026-10-12',
        time: '10:00 AM',
        status: 'pending',
      };
      Appointment.create.mockResolvedValue(mockCreated);

      const populatedData = {
        ...mockCreated,
        doctor: { _id: validDoctorId, user: { name: 'Dr. House', email: 'house@mednexus.com' } },
        patient: { name: 'John Doe', email: 'john@mednexus.com' },
      };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        then: (resolve) => resolve(populatedData),
      };
      Appointment.findById.mockReturnValue(mockQuery);

      const res = await request(app)
        .post('/api/appointments')
        .send({
          doctorId: validDoctorId,
          date: '2026-10-12',
          time: '10:00 AM',
          type: 'Consultation',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.appointment).toBeDefined();
    });
  });

  describe('GET /api/appointments/my', () => {
    it('should return appointments for patient', async () => {
      const mockAppts = [
        {
          _id: 'appt1',
          date: '2026-10-12',
          time: '10:00 AM',
          status: 'confirmed',
          type: 'Checkup',
          doctor: { _id: 'doc1', user: { name: 'Dr. Strange' }, specialty: 'Surgery' },
        },
      ];

      const queryMock = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockAppts),
      };
      Appointment.find.mockReturnValue(queryMock);

      const res = await request(app).get('/api/appointments/my');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.appointments[0].doctor.name).toBe('Dr. Strange');
    });
  });

  describe('PUT /api/appointments/:id/cancel', () => {
    const validApptId = '507f1f77bcf86cd799439055';

    it('should allow patient to cancel their own appointment', async () => {
      const mockAppt = {
        _id: validApptId,
        patient: '507f1f77bcf86cd799439011',
        status: 'pending',
        save: jest.fn().mockResolvedValue(true),
      };
      Appointment.findById.mockResolvedValue(mockAppt);

      const res = await request(app).put(`/api/appointments/${validApptId}/cancel`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockAppt.status).toBe('cancelled');
      expect(mockAppt.save).toHaveBeenCalled();
    });

    it('should reject cancellation if user is not the owner', async () => {
      const mockAppt = {
        _id: validApptId,
        patient: 'different-patient-id',
        status: 'pending',
        save: jest.fn(),
      };
      Appointment.findById.mockResolvedValue(mockAppt);

      const res = await request(app).put(`/api/appointments/${validApptId}/cancel`);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe('Not authorized');
      expect(mockAppt.save).not.toHaveBeenCalled();
    });
  });
});
