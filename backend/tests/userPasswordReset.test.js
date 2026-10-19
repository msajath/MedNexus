const crypto = require('crypto');
const User = require('../models/User');

describe('password reset code', () => {
  test.each(['password123', 'aaaaaaaaaa', 'patient@example.test'])('rejects a weak password on direct model creation (%s)', async (password) => {
    const user = new User({ name: 'Test Patient', email: 'patient@example.test', password });
    await expect(user.validate()).rejects.toThrow();
  });

  test('accepts a ten-character passphrase on direct model creation', async () => {
    const user = new User({ name: 'Test Patient', email: 'patient@example.test', password: 'abcdefghij' });
    await expect(user.validate()).resolves.toBeUndefined();
  });

  test('is six digits, stored only as a hash, and expires after five minutes', () => {
    const user = new User({
      name: 'Test Patient',
      email: 'patient@example.test',
      password: 'T!ny7Grape',
    });
    const before = Date.now();
    const code = user.generateResetToken();
    const after = Date.now();

    expect(code).toMatch(/^\d{6}$/);
    expect(user.resetPasswordToken).toBe(
      crypto.createHash('sha256').update(code).digest('hex')
    );
    expect(user.resetPasswordExpire.getTime()).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
    expect(user.resetPasswordExpire.getTime()).toBeLessThanOrEqual(after + 5 * 60 * 1000);
  });
});
