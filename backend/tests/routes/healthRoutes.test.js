const request = require('supertest');
const express = require('express');
const mockDoctorRoute = jest.fn((req, res) => res.json({ doctors: [] }));
jest.mock('../../routes/doctorRoutes', () => {
  const router = require('express').Router();
  router.get('/', mockDoctorRoute);
  return router;
});
jest.mock('mongoose', () => ({
  ...jest.requireActual('mongoose'),
  connection: { readyState: 0 },
}));
const mongoose = require('mongoose');
const { app } = require('../../server');
const { createAvailability } = require('../../middleware/availability');

describe('Operational health endpoints', () => {
  let ping;
  beforeEach(() => {
    mongoose.connection.readyState = 0;
    ping = jest.fn().mockResolvedValue({ ok: 1 });
    mongoose.connection.db = { admin: () => ({ ping }) };
  });

  test('liveness remains available without a database', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(ping).not.toHaveBeenCalled();
  });

  test.each([[0, 503], [1, 200], [2, 503], [3, 503]])(
    'database state %i produces readiness status %i',
    async (state, status) => {
      const previous = mongoose.connection.readyState;
      mongoose.connection.readyState = state;
      try {
        const response = await request(app).get('/api/ready');
        expect(response.status).toBe(status);
        expect(response.body.status).toBe(status === 200 ? 'ready' : 'unavailable');
        if (status === 503) expect(response.headers['retry-after']).toBe('5');
      } finally {
        mongoose.connection.readyState = previous;
      }
    }
  );

  test.each(['auth/me', 'doctors', 'appointments/my', 'availability', 'leaves/my', 'payments/my', 'admin/stats', 'records/my', 'contact', 'messages'])(
    'disconnected database returns a retryable response for /api/%s',
    async (path) => {
      const response = await request(app).get(`/api/${path}`);
      expect(response.status).toBe(503);
      expect(response.headers['retry-after']).toBe('5');
      expect(mockDoctorRoute).not.toHaveBeenCalled();
      expect(ping).not.toHaveBeenCalled();
    }
  );

  test('connected requests reach their router and unknown routes remain 404', async () => {
    mongoose.connection.readyState = 1;
    expect((await request(app).get('/api/doctors')).status).toBe(200);
    expect(mockDoctorRoute).toHaveBeenCalledTimes(1);
    mongoose.connection.readyState = 0;
    expect((await request(app).get('/api/missing')).status).toBe(404);
  });

  test('connected state with an unsuccessful ping is unavailable without exposing errors', async () => {
    mongoose.connection.readyState = 1;
    ping.mockRejectedValue(new Error('mongodb://private-user:private-password@private.example'));
    const response = await request(app).get('/api/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable' });
    expect(response.text).not.toContain('private');
    expect(ping).toHaveBeenCalledWith({ timeoutMS: 2000 });
  });

  test('readiness shares database probes during concurrent monitoring requests', async () => {
    mongoose.connection.readyState = 1;
    const responses = await Promise.all(Array.from({ length: 10 }, () => request(app).get('/api/ready')));
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(ping).toHaveBeenCalledTimes(1);
  });

  test('a stalled ping has a bounded response and leaves liveness available', async () => {
    mongoose.connection.readyState = 1;
    let rejectPing;
    ping.mockImplementation(() => new Promise((resolve, reject) => { rejectPing = reject; }));
    const monitored = express();
    monitored.get('/ready', createAvailability(mongoose.connection, { pingTimeoutMs: 30 }).readiness);
    const started = Date.now();
    const [ready, live] = await Promise.all([
      request(monitored).get('/ready'), request(app).get('/api/health'),
    ]);
    expect(ready.status).toBe(503);
    expect(live.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(1000);
    // Late driver failures after the HTTP deadline are still consumed.
    rejectPing(new Error('Connection closed after deadline'));
    await new Promise((resolve) => setImmediate(resolve));
  });
});
