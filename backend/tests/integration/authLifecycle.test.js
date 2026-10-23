const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const assertTestDatabase = require('../helpers/testDatabase');
jest.mock('../../utils/mailer', () => ({ sendMail: jest.fn().mockResolvedValue({}) }));
const { sendMail } = require('../../utils/mailer');
const { app } = require('../../server');
const User = require('../../models/User');
const Doctor = require('../../models/Doctor');

const withMongo = process.env.MONGO_TEST_URI ? describe : describe.skip;
const password = 'QA-password-123456';
const auth = user => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, version: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1h' })}` });

withMongo('Authentication persistence, expiration, and reauthentication', () => {
  jest.setTimeout(30000);
  let patient;
  beforeAll(async () => {
    assertTestDatabase(process.env.MONGO_TEST_URI);
    await mongoose.connect(process.env.MONGO_TEST_URI, { autoIndex: false });
    await User.createIndexes();
  });
  beforeEach(async () => {
    await Doctor.deleteMany({});
    await User.deleteMany({});
    patient = await User.create({ name: 'Lifecycle Patient', email: 'lifecycle@qa.example', password, role: 'patient' });
    sendMail.mockClear();
  });
  afterAll(async () => mongoose.disconnect());

  test('doctor registration persists a bcrypt password and unverified profile, and rejects duplicate and admin roles', async () => {
    const payload = { name: 'Self Registered Doctor', email: 'self-doctor@qa.example', password, role: 'doctor', licenseNumber: 'QA-LICENSE', isVerified: true, isActive: true };
    const registered = await request(app).post('/api/auth/register').send(payload);
    expect(registered.status).toBe(201);
    const stored = await User.findOne({ email: payload.email }).select('+password');
    expect(stored.isVerified).toBe(false);
    expect(stored.role).toBe('doctor');
    expect(bcrypt.getRounds(stored.password)).toBe(12);
    expect(await stored.matchPassword(password)).toBe(true);
    expect((await Doctor.findOne({ user: stored._id })).licenseNumber).toBe('QA-LICENSE');
    expect((await request(app).post('/api/auth/register').send(payload)).status).toBe(400);
    expect(await User.countDocuments({ email: payload.email })).toBe(1);
    expect(await Doctor.countDocuments({ user: stored._id })).toBe(1);
    expect((await request(app).post('/api/auth/register').send({ ...payload, email: 'forged-admin@qa.example', role: 'admin' })).status).toBe(400);
    expect(await User.countDocuments({ role: 'admin' })).toBe(0);
  });

  test('expired JWTs and deactivated accounts reject a previously valid identity with an explicit session code', async () => {
    const valid = auth(patient);
    expect((await request(app).get('/api/auth/me').set(valid)).status).toBe(200);
    const expired = jwt.sign({ id: patient._id, version: 0 }, process.env.JWT_SECRET, { expiresIn: -1 });
    const expiry = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(expiry.status).toBe(401);
    expect(expiry.body).toEqual({ success: false, code: 'AUTH_SESSION_INVALID', message: 'Not authorized, token invalid' });
    await User.updateOne({ _id: patient._id }, { isActive: false });
    const deactivated = await request(app).get('/api/auth/me').set(valid);
    expect(deactivated.status).toBe(401);
    expect(deactivated.body.code).toBe('AUTH_SESSION_INVALID');
    const login = await request(app).post('/api/auth/login').send({ email: patient.email, password });
    expect(login.status).toBe(401);
    expect(login.body.message).toBe('Invalid email or password');
    expect(login.headers['set-cookie']).toBeUndefined();
  });

  test('an expired reset code cannot update the persisted password or revoke a valid session', async () => {
    const now = Date.now();
    const requested = await request(app).post('/api/auth/forgot-password').send({ email: patient.email });
    expect(requested.status).toBe(200);
    const code = sendMail.mock.calls[0][0].text.match(/reset code is: (\d{6})/)[1];
    const stored = await User.findById(patient._id).select('+password +resetPasswordToken +resetPasswordExpire');
    expect(stored.resetPasswordToken).toBe(crypto.createHash('sha256').update(code).digest('hex'));
    expect(stored.resetPasswordExpire.getTime()).toBeGreaterThanOrEqual(now + 5 * 60 * 1000);
    expect(stored.resetPasswordExpire.getTime()).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
    await User.updateOne({ _id: patient._id }, { resetPasswordExpire: new Date(Date.now() - 1) });
    const reset = await request(app).post('/api/auth/reset-password').send({ email: patient.email, resetCode: code, newPassword: 'Fresh-password-87654321' });
    expect(reset.status).toBe(400);
    expect(reset.body.message).toBe('Invalid or expired reset code');
    const unchanged = await User.findById(patient._id).select('+password');
    expect(unchanged.password).toBe(stored.password);
    expect(unchanged.tokenVersion).toBe(0);
    expect((await request(app).get('/api/auth/me').set(auth(patient))).status).toBe(200);
  });

  test('requesting a replacement code invalidates the prior code and only one successful reset rotates credentials', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: patient.email });
    const first = sendMail.mock.calls[0][0].text.match(/reset code is: (\d{6})/)[1];
    // Use an explicit old value so the test is deterministic even if random OTPs repeat.
    await User.updateOne({ _id: patient._id }, { resetPasswordToken: crypto.createHash('sha256').update('000000').digest('hex') });
    await request(app).post('/api/auth/forgot-password').send({ email: patient.email });
    const replacement = sendMail.mock.calls[1][0].text.match(/reset code is: (\d{6})/)[1];
    expect(first).toMatch(/^\d{6}$/);
    const newPassword = 'Fresh-password-87654321';
    expect((await request(app).post('/api/auth/reset-password').send({ email: patient.email, resetCode: '000000', newPassword })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ email: patient.email, resetCode: replacement, newPassword })).status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ email: patient.email, resetCode: replacement, newPassword })).status).toBe(400);
    const stored = await User.findById(patient._id).select('+password +resetPasswordToken +resetPasswordExpire');
    expect(stored.tokenVersion).toBe(1);
    expect(stored.resetPasswordToken).toBeNull();
    expect(stored.resetPasswordExpire).toBeNull();
    expect(await stored.matchPassword(newPassword)).toBe(true);
    expect(await stored.matchPassword(password)).toBe(false);
    expect((await request(app).get('/api/auth/me').set(auth(patient))).status).toBe(401);
  });

  test('unknown and inactive reset requests are indistinguishable and do not send email', async () => {
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@qa.example' });
    await User.updateOne({ _id: patient._id }, { isActive: false });
    const inactive = await request(app).post('/api/auth/forgot-password').send({ email: patient.email });
    expect(unknown.status).toBe(200);
    expect(inactive.status).toBe(200);
    expect(inactive.body).toEqual(unknown.body);
    expect(sendMail).not.toHaveBeenCalled();
    expect((await User.findById(patient._id).select('+resetPasswordToken')).resetPasswordToken).toBeNull();
  });
});
