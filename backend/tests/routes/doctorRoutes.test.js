const request = require('supertest');
const express = require('express');
const Doctor = require('../../models/Doctor');
const User = require('../../models/User');

jest.mock('../../models/Doctor');
jest.mock('../../models/User');
const app = express();
app.use('/api/doctors', require('../../routes/doctorRoutes'));

const approvedId = '507f1f77bcf86cd799439011';
const doctorId = '507f1f77bcf86cd799439012';
const doctor = {
  _id: doctorId, user: { _id: approvedId, name: 'QA Doctor', email: 'doctor@example.test', isVerified: true },
  specialty: 'General Practice', location: 'Colombo', fee: 125, available: true, languages: ['English'],
};

describe('public doctor discovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: approvedId }]) });
    Doctor.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([doctor, { ...doctor, _id: 'unavailable', user: null }]) });
    Doctor.distinct.mockResolvedValue(['General Practice']);
  });

  test('searches location and does not expose an orphaned/unapproved doctor', async () => {
    const result = await request(app).get('/api/doctors?search=Colombo');
    expect(result.status).toBe(200);
    expect(result.body.doctors).toHaveLength(1);
    expect(result.body.doctors[0].name).toBe('QA Doctor');
    expect(Doctor.find).toHaveBeenCalledWith({ user: { $in: [approvedId] } });
  });

  test('limits specialties to active, approved doctors', async () => {
    const result = await request(app).get('/api/doctors/specialties/list');
    expect(result.body.specialties).toEqual(['All Specialties', 'General Practice']);
    expect(Doctor.distinct).toHaveBeenCalledWith('specialty', { user: { $in: [approvedId] } });
  });

  test('rejects repeated search parameters', async () => {
    const result = await request(app).get('/api/doctors?search=QA&search=Colombo');
    expect(result.status).toBe(400);
    expect(Doctor.find).not.toHaveBeenCalled();
  });
});
