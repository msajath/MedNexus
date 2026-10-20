const { validateArguments, validateResetEnvironment, resetDevelopmentPassword } = require('../scripts/resetDevPassword');

describe('development password reset safety', () => {
  const local = 'mongodb://127.0.0.1:27017/medibook_dev';
  const remote = 'mongodb+srv://user:placeholder@cluster.example.test/medibook';

  test('rejects bulk defaults and positional passwords', () => {
    expect(() => validateArguments(['--defaults'])).toThrow(/not supported/);
    expect(() => validateArguments(['user@example.test', 'not-a-real-password'])).toThrow(/privately/);
    expect(validateArguments(['User@EXAMPLE.test'])).toBe('user@example.test');
  });
  test('requires explicit local development configuration, including fallback URIs', () => {
    expect(() => validateResetEnvironment('development', [local])).not.toThrow();
    for (const [environment, uris] of [['production', [local]], [undefined, [local]],
      ['development', [remote]], ['development', [local, remote]],
      ['development', ['mongodb://localhost']], ['development', ['mongodb://localhost/admin']]]) {
      expect(() => validateResetEnvironment(environment, uris)).toThrow(/localhost/);
    }
  });
  test('rejects unsafe targets and weak passwords before connecting', async () => {
    const connect = jest.fn();
    await expect(resetDevelopmentPassword({ email: 'user@example.test', password: 'long-local-password',
      environment: 'development', uris: [remote], connect })).rejects.toThrow(/localhost/);
    await expect(resetDevelopmentPassword({ email: 'user@example.test', password: 'short',
      environment: 'development', uris: [local], connect })).rejects.toThrow(/10 characters/);
    expect(connect).not.toHaveBeenCalled();
  });
  test('rotates sessions and clears outstanding reset codes through the normal model save', async () => {
    const user = { name: 'Local User', role: 'patient', tokenVersion: 3,
      resetPasswordToken: 'old-hash', resetPasswordExpire: new Date(), save: jest.fn().mockResolvedValue() };
    const userModel = { findOne: jest.fn().mockResolvedValue(user) };
    const connect = jest.fn().mockResolvedValue();
    const disconnect = jest.fn().mockResolvedValue();
    const result = await resetDevelopmentPassword({ email: 'User@EXAMPLE.test', password: 'long-local-password',
      environment: 'development', uris: [local], userModel, connect, disconnect });
    expect(result).toEqual({ email: 'user@example.test', role: 'patient' });
    expect(result).not.toHaveProperty('password');
    expect(userModel.findOne).toHaveBeenCalledWith({ email: 'user@example.test', isActive: { $ne: false } });
    expect(user.tokenVersion).toBe(4);
    expect(user.resetPasswordToken).toBeNull();
    expect(user.resetPasswordExpire).toBeNull();
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
  test('disconnects after a failed save without returning credentials', async () => {
    const disconnect = jest.fn().mockResolvedValue();
    await expect(resetDevelopmentPassword({ email: 'user@example.test', password: 'long-local-password',
      environment: 'development', uris: [local], connect: jest.fn().mockResolvedValue(), disconnect,
      userModel: { findOne: jest.fn().mockResolvedValue({ name: 'Local User', save: jest.fn().mockRejectedValue(new Error('save failed')) }) },
    })).rejects.toThrow('save failed');
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
