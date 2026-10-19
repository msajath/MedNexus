const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores bytes after this limit.

const comparisonKey = (value) => value.normalize('NFKC').toLowerCase().replace(/[\s._-]+/g, '');
const commonPasswords = new Set([
  '1234567890', '123456789012', '0000000000', '1111111111',
  'password123', 'password1234', 'password12345', 'password123456',
  'passw0rd123', 'password!123', 'qwerty12345', 'qwerty123456',
  'abc1234567', 'letmein1234', 'letmein12345', 'welcome123',
  'welcome1234', 'admin123456', 'administrator', 'iloveyou123',
  'changeme123', 'secret12345', 'mednexus123', 'mednexus2026',
].map(comparisonKey));

const passwordIssue = (value, { email, name } = {}) => {
  if (typeof value !== 'string' || [...value].length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_PASSWORD_BYTES) {
    return `Password must be at most ${MAX_PASSWORD_BYTES} UTF-8 bytes`;
  }

  const key = comparisonKey(value);
  const emailValue = typeof email === 'string' ? email.trim() : '';
  const nameValue = typeof name === 'string' ? name.trim() : '';
  const emailKey = emailValue && comparisonKey(emailValue);
  const localPartKey = emailValue && comparisonKey(emailValue.split('@')[0]);
  const nameKey = nameValue && comparisonKey(nameValue);
  if (!key || commonPasswords.has(key) || key === emailKey || key === localPartKey || key === nameKey ||
      new Set([...value]).size === 1) {
    return 'Choose a less common password that is different from your name or email';
  }
  return null;
};

module.exports = { MIN_PASSWORD_LENGTH, MAX_PASSWORD_BYTES, passwordIssue };
