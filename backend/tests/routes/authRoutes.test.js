const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/authRoutes');
const User = require('../../models/User');
const Doctor = require('../../models/Doctor');
const jwt = require('jsonwebtoken');

jest.mock('../../models/User');
jest.mock('../../models/Doctor');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

process.env.JWT_SECRET = 'testsecret';
process.env.JWT_EXPIRE = '30d';

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('uses a canonical email for duplicate checks and creation', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ _id: '123', name: 'Test', email: 'test@test.com', role: 'patient' });

      const res = await request(app).post('/api/auth/register').send({
        name: 'Test', email: ' Test@TEST.com ', password: 'password', role: 'patient'
      });

      expect(res.statusCode).toBe(201);
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@test.com' });
      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'test@test.com' }));
    });

    it('should return 400 if user exists', async () => {
      User.findOne.mockResolvedValue({ _id: '123', email: 'test@test.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'test@test.com',
          password: 'password',
          role: 'patient'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('User already exists with this email');
    });

    it('should register a new patient successfully', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        _id: '123',
        name: 'Test',
        email: 'test@test.com',
        role: 'patient',
        isVerified: true
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'test@test.com',
          password: 'password',
          role: 'patient'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('looks up a canonical email', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await request(app).post('/api/auth/login').send({ email: ' Test@TEST.com ', password: 'password' });

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@test.com' });
    });

    it('should return 400 for invalid credentials (user not found)', async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'notfound@test.com',
          password: 'password'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should login user successfully', async () => {
      const mockUser = {
        _id: '123',
        email: 'test@test.com',
        role: 'patient',
        isVerified: true,
        matchPassword: jest.fn().mockResolvedValue(true)
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@test.com',
          password: 'password'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('returns 503 without SMTP in production before looking up an account', async () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const res = await request(app).post('/api/auth/forgot-password').send({ email: 'unavailable@example.com' });
        expect(res.statusCode).toBe(503);
        expect(User.findOne).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = previous;
      }
    });

    it('should generate and save a password reset code for an existing user', async () => {
      const mockUser = {
        _id: '123',
        name: 'Test Patient',
        email: 'test@test.com',
        generateResetToken: jest.fn().mockReturnValue('123456'),
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@test.com' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('If an account exists for that email, a reset code has been sent');
      expect(mockUser.generateResetToken).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('canonicalizes email and marks doctor credentials as changed', async () => {
      const mockUser = {
        _id: 'doctor-1', role: 'doctor', password: 'old',
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);
      Doctor.findOneAndUpdate.mockResolvedValue({});

      const res = await request(app).post('/api/auth/reset-password').send({
        email: ' Doctor@EXAMPLE.com ', resetCode: '123456', newPassword: 'new-password'
      });

      expect(res.statusCode).toBe(200);
      expect(User.findOne).toHaveBeenCalledWith(expect.objectContaining({ email: 'doctor@example.com' }));
      expect(Doctor.findOneAndUpdate).toHaveBeenCalledWith(
        { user: 'doctor-1' }, { credentialsChanged: true }
      );
    });

    it('limits invalid reset attempts per email', async () => {
      User.findOne.mockResolvedValue(null);
      const email = 'rate-limit-test@example.com';
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const res = await request(app).post('/api/auth/reset-password').send({
          email, resetCode: '123456', newPassword: 'new-password'
        });
        expect(res.statusCode).toBe(400);
      }
      const blocked = await request(app).post('/api/auth/reset-password').send({
        email, resetCode: '123456', newPassword: 'new-password'
      });
      expect(blocked.statusCode).toBe(429);
      expect(User.findOne).toHaveBeenCalledTimes(5);
    });

    it('should accept a valid reset code and save the new password', async () => {
      const mockUser = {
        password: 'old-password',
        resetPasswordToken: 'stored-token',
        resetPasswordExpire: new Date(Date.now() + 60_000),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'test@test.com', resetCode: '123456', newPassword: 'new-password' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockUser.password).toBe('new-password');
      expect(mockUser.resetPasswordToken).toBeNull();
      expect(mockUser.resetPasswordExpire).toBeNull();
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('PUT /api/auth/profile', () => {
    const token = () => jwt.sign({ id: '123' }, process.env.JWT_SECRET);

    it('saves a unique normalized email for the current user', async () => {
      const current = { _id: '123', email: 'current@example.com', role: 'patient', save: jest.fn() };
      User.findById.mockResolvedValue(current);
      User.findOne.mockResolvedValue(null);

      const res = await request(app).put('/api/auth/profile')
        .set('Authorization', `Bearer ${token()}`)
        .send({ email: ' New@EXAMPLE.com ' });

      expect(res.statusCode).toBe(200);
      expect(User.findOne).toHaveBeenCalledWith({ email: 'new@example.com' });
      expect(current.email).toBe('new@example.com');
      expect(current.save).toHaveBeenCalled();
    });

    it('rejects an email owned by another user', async () => {
      const current = { _id: '123', email: 'current@example.com', role: 'patient', save: jest.fn() };
      User.findById.mockResolvedValue(current);
      User.findOne.mockResolvedValue({ _id: '456' });

      const res = await request(app).put('/api/auth/profile')
        .set('Authorization', `Bearer ${token()}`)
        .send({ email: ' Other@EXAMPLE.com ' });

      expect(res.statusCode).toBe(400);
      expect(User.findOne).toHaveBeenCalledWith({ email: 'other@example.com' });
      expect(current.save).not.toHaveBeenCalled();
    });
  });
});
