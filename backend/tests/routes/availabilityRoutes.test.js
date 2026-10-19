const request = require('supertest');
const express = require('express');
const Availability = require('../../models/Availability');
const Appointment = require('../../models/Appointment');
const Doctor = require('../../models/Doctor');
const User = require('../../models/User');
const { defaultSchedule } = require('../../utils/slots');

jest.mock('../../models/Availability');
jest.mock('../../models/Appointment');
jest.mock('../../models/Doctor');
jest.mock('../../models/User');
jest.mock('../../middleware/auth', () => ({
  protect: (req, res, next) => { req.user = { _id: '507f1f77bcf86cd799439011', role: 'doctor' }; next(); },
  authorize: (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.sendStatus(403),
}));

const app = express();
app.use(express.json());
app.use('/api/availability', require('../../routes/availabilityRoutes'));
const doctorId = '507f1f77bcf86cd799439012';
const nextMonday = () => {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 14 + (8 - day.getUTCDay()) % 7);
  return day.toISOString().slice(0, 10);
};

describe('doctor availability API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Doctor.findOne.mockResolvedValue({ _id: doctorId });
    Doctor.findById.mockResolvedValue({ _id: doctorId, user: '507f1f77bcf86cd799439013', available: true });
    User.findById.mockResolvedValue({ isVerified: true, isActive: true });
    Appointment.find.mockResolvedValue([]);
    Availability.findOne.mockResolvedValue(null);
  });

  test('saves a valid seven-day schedule with one atomic upsert', async () => {
    const schedule = defaultSchedule.map((item) => ({ ...item }));
    Availability.findOneAndUpdate.mockResolvedValue({ schedule });
    const result = await request(app).put('/api/availability').send({ schedule });
    expect(result.status).toBe(200);
    expect(result.body.schedule).toHaveLength(7);
    expect(Availability.findOneAndUpdate).toHaveBeenCalledWith(
      { doctor: doctorId }, { $set: { schedule } }, { upsert: true, new: true, runValidators: true }
    );
  });

  test('rejects overlapping/off-grid input before database writes', async () => {
    const schedule = defaultSchedule.map((item) => ({ ...item, start: '09:15' }));
    const result = await request(app).put('/api/availability').send({ schedule });
    expect(result.status).toBe(400);
    expect(Availability.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('rejects weekend availability even if a doctor enables it', async () => {
    const schedule = defaultSchedule.map((item) => ({ ...item, enabled: item.day === 'Saturday' ? true : item.enabled,
      start: item.day === 'Saturday' ? '09:00' : item.start, end: item.day === 'Saturday' ? '12:00' : item.end }));
    const result = await request(app).put('/api/availability').send({ schedule });
    expect(result.status).toBe(400);
    expect(Availability.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('returns no weekend slots even for a previously enabled schedule', async () => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 14 + (6 - date.getUTCDay() + 7) % 7);
    Availability.findOne.mockResolvedValue({ schedule: defaultSchedule.map(item => item.day === 'Saturday'
      ? { ...item, enabled: true, start: '09:00', end: '12:00' } : item) });
    const result = await request(app).get(`/api/availability/slots/${doctorId}/${date.toISOString().slice(0, 10)}`);
    expect(result.status).toBe(200);
    expect(result.body.slots.morning).toEqual([]);
    expect(result.body.unavailableSlots.morning).toEqual([]);
    expect(Appointment.find).not.toHaveBeenCalled();
  });

  test('returns future half-hour slots and excludes an occupied slot', async () => {
    Appointment.find.mockResolvedValue([{ time: '10:00 AM' }]);
    const result = await request(app).get(`/api/availability/slots/${doctorId}/${nextMonday()}`);
    expect(result.status).toBe(200);
    expect(result.body.slots.morning).toContain('09:00 AM');
    expect(result.body.bookedSlots).toEqual(['10:00 AM']);
  });

  test('rejects nonexistent calendar dates', async () => {
    const result = await request(app).get(`/api/availability/slots/${doctorId}/2026-02-30`);
    expect(result.status).toBe(400);
    expect(Appointment.find).not.toHaveBeenCalled();
  });
});
