const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

jest.mock('../models/User');

const runMiddleware = async (middleware, req = {}) => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();
  await middleware({ headers: {}, ...req }, res, next);
  return { res, next };
};

describe('authentication middleware', () => {
  const secret = 'middleware-test-secret';

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
  });

  test('rejects requests without a bearer token or session cookie', async () => {
    const { res, next } = await runMiddleware(protect);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_SESSION_INVALID', message: expect.stringContaining('no token') }));
    expect(next).not.toHaveBeenCalled();
  });

  test.each([
    ['tampered token', `${jwt.sign({ id: 'user-1' }, secret)}x`],
    ['expired token', jwt.sign({ id: 'user-1' }, secret, { expiresIn: -1 })],
  ])('rejects %s without revealing token details', async (_description, token) => {
    const { res, next } = await runMiddleware(protect, { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, code: 'AUTH_SESSION_INVALID', message: 'Not authorized, token invalid' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects inactive or revoked accounts', async () => {
    User.findById.mockResolvedValue({ _id: 'user-1', isActive: false, tokenVersion: 0 });
    const token = jwt.sign({ id: 'user-1' }, secret);
    const inactive = await runMiddleware(protect, { headers: { authorization: `Bearer ${token}` } });
    expect(inactive.res.status).toHaveBeenCalledWith(401);
    expect(inactive.res.json).toHaveBeenCalledWith({ success: false, code: 'AUTH_SESSION_INVALID', message: 'Account is unavailable' });

    User.findById.mockResolvedValue({ _id: 'user-1', isActive: true, tokenVersion: 2 });
    const revokedToken = jwt.sign({ id: 'user-1', version: 1 }, secret);
    const revoked = await runMiddleware(protect, { headers: { authorization: `Bearer ${revokedToken}` } });
    expect(revoked.res.status).toHaveBeenCalledWith(401);
    expect(revoked.next).not.toHaveBeenCalled();
  });

  test('accepts a valid cookie session and authorizes the user', async () => {
    const user = { _id: 'user-1', role: 'doctor', isActive: true, tokenVersion: 0 };
    User.findById.mockResolvedValue(user);
    const token = jwt.sign({ id: user._id }, secret);
    const result = await runMiddleware(protect, { headers: { cookie: `mednexus_session=${encodeURIComponent(token)}` } });
    expect(result.next).toHaveBeenCalled();

    const authorized = await runMiddleware(authorize('doctor'), { user });
    expect(authorized.next).toHaveBeenCalled();
  });

  test('rejects a valid user with the wrong role', async () => {
    const result = await runMiddleware(authorize('admin'), { user: { role: 'patient' } });
    expect(result.res.status).toHaveBeenCalledWith(403);
    expect(result.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(result.next).not.toHaveBeenCalled();
  });
});
