const request = require('supertest');
const express = require('express');
const { app } = require('../server');
const { limiter } = require('../middleware/security');
const errorHandler = require('../middleware/errorHandler');

describe('HTTP security controls', () => {
  test('security headers protect responses and prevent private API caching', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
  test('untrusted origins are denied before authentication', async () => {
    const res = await request(app).post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: 'test@example.test', password: 'password' });
    expect(res.status).toBe(403);
  });
  test('trusted preflight allows the request protection header', async () => {
    const res = await request(app).options('/api/auth/profile').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'PUT').set('Access-Control-Request-Headers', 'x-mednexus-request,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-headers']).toContain('x-mednexus-request');
  });
  test('cookie mutations require the custom request header', async () => {
    expect((await request(app).post('/api/auth/logout').set('Cookie', 'mednexus_session=invalid')).status).toBe(403);
    expect((await request(app).post('/api/auth/logout').set('Cookie', 'mednexus_session=invalid').set('Authorization', 'invalid')).status).toBe(403);
  });
  test('malformed cookie encodings return 401 without crashing', async () => {
    expect((await request(app).get('/api/auth/me').set('Cookie', 'mednexus_session=%E0%A4%A')).status).toBe(401);
  });
  test.each([
    { email: { $ne: null }, password: 'password' },
    { name: { constructor: {} }, email: 'test@example.test' },
    { name: 'Test', nested: { 'profile.name': 'Test' } },
  ])('operator/prototype injection rejected (%#)', async (payload) => {
    expect((await request(app).post('/api/auth/register').send(payload)).status).toBe(400);
  });
  test('malformed JSON and oversized requests return safe client errors', async () => {
    expect((await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{broken')).status).toBe(400);
    expect((await request(app).post('/api/auth/login').send({ large: 'x'.repeat(4 * 1024 * 1024) })).status).toBe(413);
  });
  test('form submissions and unknown routes do not reach the database', async () => {
    expect((await request(app).post('/api/auth/login').type('form').send({ email: 'a@example.test', password: 'password' })).status).toBe(415);
    expect((await request(app).get('/api/missing')).status).toBe(404);
  });
  test('weak, overlong and multibyte passwords are rejected without echoing them', async () => {
    for (const password of ['short', 'x'.repeat(73), '😀'.repeat(20)]) {
      const res = await request(app).post('/api/auth/register').send({ name: 'Test', email: 'test@example.test', password });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).not.toContain(password);
    }
  });
  test('rate limiting returns 429 and recovery headers', async () => {
    const limited = express(); limited.get('/', limiter(2), (req, res) => res.send('ok'));
    expect((await request(limited).get('/')).status).toBe(200);
    expect((await request(limited).get('/')).status).toBe(200);
    const rejected = await request(limited).get('/');
    expect(rejected.status).toBe(429);
    expect(rejected.headers['retry-after']).toBeDefined();
  });
  test('internal failures never expose database connection details', async () => {
    const failing = express();
    failing.get('/', (req, res, next) => next(new Error('mongodb://secret-password@private.example')));
    failing.use(errorHandler);
    const res = await request(failing).get('/');
    expect(res.status).toBe(500); expect(res.text).not.toContain('secret-password');
  });
});
