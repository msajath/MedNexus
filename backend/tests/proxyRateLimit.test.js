const express = require('express');
const request = require('supertest');
const { limiter, accountLimiter } = require('../middleware/security');
const { getTrustProxySetting } = require('../config/proxy');

const limitedApp = (trustProxy, rateLimiter = limiter(1)) => {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.use(express.json());
  app.all('/', rateLimiter, (req, res) => res.json({ ip: req.ip }));
  return app;
};

describe('proxy trust configuration', () => {
  test('direct deployments do not trust forwarded headers by default', () => {
    expect(getTrustProxySetting({})).toBe(false);
    expect(getTrustProxySetting({ RENDER: 'false' })).toBe(false);
  });

  test('Render uses exactly one trusted proxy hop', () => {
    expect(getTrustProxySetting({ RENDER: 'true' })).toBe(1);
  });

  test.each(['0', 'false'])('explicit %s disables proxy trust even on Render', (value) => {
    expect(getTrustProxySetting({ RENDER: 'true', TRUST_PROXY: value })).toBe(false);
  });

  test('explicit 1 enables exactly one trusted hop elsewhere', () => {
    expect(getTrustProxySetting({ TRUST_PROXY: '1' })).toBe(1);
  });

  test.each(['true', '2', '-1', 'anything'])('unsafe or unsupported setting %s fails clearly', (value) => {
    expect(() => getTrustProxySetting({ TRUST_PROXY: value })).toThrow(/TRUST_PROXY/);
  });
});

describe('rate limiting through a trusted proxy', () => {
  let consoleError;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  test('different proxied clients have separate buckets without either reported validation warning', async () => {
    const app = limitedApp(1);
    const fromClient = (ip) => request(app).get('/')
      .set('X-Forwarded-For', ip)
      .set('Forwarded', `for=${ip};proto=https`);

    const first = await fromClient('198.51.100.10');
    expect(first.status).toBe(200);
    expect(first.body.ip).toBe('198.51.100.10');
    expect((await fromClient('198.51.100.10')).status).toBe(429);
    expect((await fromClient('198.51.100.11')).status).toBe(200);
    expect(consoleError).not.toHaveBeenCalled();
  });

  test('changing an untrusted X-Forwarded-For prefix cannot bypass the client limit', async () => {
    const app = limitedApp(1);
    const first = await request(app).get('/')
      .set('X-Forwarded-For', '203.0.113.1, 198.51.100.10');
    expect(first.status).toBe(200);
    expect(first.body.ip).toBe('198.51.100.10');
    const second = await request(app).get('/')
      .set('X-Forwarded-For', '203.0.113.2, 198.51.100.10');
    expect(second.status).toBe(429);
    expect(consoleError).not.toHaveBeenCalled();
  });

  test('a conflicting Forwarded header cannot override the trusted client address', async () => {
    const app = limitedApp(1);
    const first = await request(app).get('/')
      .set('X-Forwarded-For', '198.51.100.10')
      .set('Forwarded', 'for=203.0.113.1');
    expect(first.status).toBe(200);
    expect(first.body.ip).toBe('198.51.100.10');
    const second = await request(app).get('/')
      .set('X-Forwarded-For', '198.51.100.10')
      .set('Forwarded', 'for=203.0.113.2');
    expect(second.status).toBe(429);
    expect(consoleError).not.toHaveBeenCalled();
  });

  test('an untrusted deployment ignores client-supplied forwarding headers', async () => {
    const app = limitedApp(false);
    const first = await request(app).get('/')
      .set('X-Forwarded-For', '198.51.100.10')
      .set('Forwarded', 'for=198.51.100.10');
    expect(first.status).toBe(200);
    expect(first.body.ip).not.toBe('198.51.100.10');
    const second = await request(app).get('/')
      .set('X-Forwarded-For', '198.51.100.11')
      .set('Forwarded', 'for=198.51.100.11');
    expect(second.status).toBe(429);
    expect(consoleError.mock.calls.map(([error]) => error.code)).toEqual(expect.arrayContaining([
      'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR',
      'ERR_ERL_FORWARDED_HEADER',
    ]));
  });

  test('IPv6 clients retain subnet-based protection against address rotation', async () => {
    const app = limitedApp(1);
    const fromClient = (ip) => request(app).get('/').set('X-Forwarded-For', ip);
    expect((await fromClient('2001:db8:1234:5600::1')).status).toBe(200);
    expect((await fromClient('2001:db8:1234:56ff::beef')).status).toBe(429);
    expect((await fromClient('2001:db8:1234:5700::1')).status).toBe(200);
    expect(consoleError).not.toHaveBeenCalled();
  });

  test('account limits follow the normalized account across different client IPs', async () => {
    const app = limitedApp(1, accountLimiter(1));
    const first = await request(app).post('/')
      .set('X-Forwarded-For', '198.51.100.10')
      .send({ email: ' User@Example.test ' });
    expect(first.status).toBe(200);
    const second = await request(app).post('/')
      .set('X-Forwarded-For', '198.51.100.11')
      .send({ email: 'user@example.test' });
    expect(second.status).toBe(429);
    const differentAccount = await request(app).post('/')
      .set('X-Forwarded-For', '198.51.100.11')
      .send({ email: 'other@example.test' });
    expect(differentAccount.status).toBe(200);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
