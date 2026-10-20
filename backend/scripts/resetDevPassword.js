const path = require('path');
const mongoose = require('mongoose');
const { createInterface } = require('readline/promises');
const { Writable } = require('stream');
const User = require('../models/User');
const { inspectMongoUri } = require('../utils/databaseSecurity');
const { passwordIssue } = require('../utils/passwordPolicy');

class ResetPasswordError extends Error {}

const validateArguments = (args) => {
  if (args.length !== 1 || typeof args[0] !== 'string' || args[0].startsWith('--') || args[0].length > 254 || !/^\S+@\S+\.\S+$/.test(args[0])) {
    throw new ResetPasswordError('Usage: npm run reset-password -- user@example.test. Passwords are entered privately; positional passwords and --defaults are not supported.');
  }
  return args[0].trim().toLowerCase();
};

const validateResetEnvironment = (environment, uris) => {
  const configured = uris.filter(Boolean);
  if (!['development', 'test'].includes(environment) || !configured.length || configured.some((uri) => {
    const details = inspectMongoUri(uri);
    return !details.valid || !details.local || !details.explicitDatabase ||
      ['admin', 'config', 'local'].includes(details.database);
  })) {
    throw new ResetPasswordError('This tool requires NODE_ENV=development (or test) and an explicit localhost database. Use the normal Forgot Password flow for deployed accounts.');
  }
};

const readHiddenPassword = async (prompt) => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new ResetPasswordError('Use an interactive terminal for private password entry.');
  }
  // Readline owns terminal echo; discard its output rather than echoing secrets.
  const sink = new Writable({ write(_chunk, _encoding, next) { next(); } });
  const reader = createInterface({ input: process.stdin, output: sink, terminal: true });
  const abort = new AbortController();
  reader.once('SIGINT', () => abort.abort());
  process.stdout.write(prompt);
  try { return await reader.question('', { signal: abort.signal }); }
  finally { reader.close(); process.stdout.write('\n'); }
};

const resetDevelopmentPassword = async ({ email, password, environment, uris,
  userModel = User,
  connect = (uri) => mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 }),
  disconnect = () => mongoose.disconnect(),
}) => {
  validateResetEnvironment(environment, uris);
  const canonicalEmail = validateArguments([email]);
  const issue = passwordIssue(password, { email: canonicalEmail });
  if (issue) throw new ResetPasswordError(issue);
  try {
    await connect(uris.find(Boolean));
    const user = await userModel.findOne({ email: canonicalEmail, isActive: { $ne: false } });
    if (!user) throw new ResetPasswordError('No active local account exists for that email.');
    const accountIssue = passwordIssue(password, { email: canonicalEmail, name: user.name });
    if (accountIssue) throw new ResetPasswordError(accountIssue);
    user.password = password; // User.save applies the normal bcrypt hook.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();
    return { email: canonicalEmail, role: user.role };
  } finally { await disconnect(); }
};

async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: npm run reset-password -- user@example.test\nDevelopment localhost databases only. New passwords are prompted privately.');
    return;
  }
  const email = validateArguments(args);
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  const uris = [process.env.MONGO_URI, process.env.MONGO_STANDARD_URI];
  validateResetEnvironment(process.env.NODE_ENV, uris);
  const password = await readHiddenPassword('New password (hidden): ');
  const confirmation = await readHiddenPassword('Confirm password (hidden): ');
  if (password !== confirmation) throw new ResetPasswordError('Passwords do not match. No account was changed.');
  await resetDevelopmentPassword({ email, password, environment: process.env.NODE_ENV, uris });
  console.log('Local account password updated. Existing sessions and reset codes were invalidated.');
}

if (require.main === module) main().catch((error) => {
  console.error(error instanceof ResetPasswordError ? error.message : 'Password reset could not finish. Connection details and passwords are hidden.');
  process.exitCode = 1;
});

module.exports = { validateArguments, validateResetEnvironment, resetDevelopmentPassword };
