const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/authRoutes');
const User = require('../../models/User');
const Doctor = require('../../models/Doctor');

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
});
