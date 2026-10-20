// Read-only audit. This script deliberately does not use config/db.js because
// normal application startup creates indexes and migrates legacy credentials.
const path = require('path');
const mongoose = require('mongoose');
const { inspectMongoUri, assessDatabaseRoles } = require('../utils/databaseSecurity');

async function auditDatabaseSecurity(uri, { configOnly = false } = {}) {
  const config = inspectMongoUri(uri);
  const checks = [];
  const add = (name, status, detail) => checks.push({ name, status, detail });
  if (!config.valid) {
    add('connection configuration', 'fail', 'Set a valid MONGO_URI; its value is never printed.');
    return { checks, dashboardChecksRequired: true };
  }
  add('explicit database', config.explicitDatabase ? 'pass' : 'review',
    config.explicitDatabase ? 'The URI names a database.' : 'The URI has no database path; MongoDB defaults to test. Confirm the intended database before changing it.');
  add('database authentication', config.credentialsPresent ? 'pass' : config.local ? 'review' : 'fail',
    config.credentialsPresent ? 'Database credentials are configured.' : 'No username is configured in the URI.');
  add('encrypted transport', config.tlsEnabled ? 'pass' : config.local ? 'review' : 'fail',
    config.tlsEnabled ? 'The driver enables TLS.' : 'TLS is not enabled by this connection string.');
  add('certificate verification', config.insecureOptions.length ? 'fail' : 'pass',
    config.insecureOptions.length ? 'An option bypasses TLS certificate verification.' : 'No TLS verification bypass is configured.');
  if (configOnly) return { checks, dashboardChecksRequired: true };

  let connection;
  try {
    connection = await mongoose.createConnection(uri, {
      autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000,
    }).asPromise();
    add('database connection', 'pass', 'The configured database accepted an authenticated connection.');
    try {
      const result = await connection.db.command({ connectionStatus: 1, showPrivileges: true });
      const assessment = assessDatabaseRoles(result.authInfo?.authenticatedUserRoles || [], connection.name);
      add('database account permissions', assessment.status, assessment.status === 'pass'
        ? 'The account is limited to built-in read/readWrite roles on this database.'
        : assessment.status === 'fail' ? 'The account has broader permissions than the application needs. Use readWrite on its database only.'
          : 'Custom or unavailable roles require review in Atlas Database Access.');
      // Safe role names and relative scope only; never print the authenticated principal.
      checks[checks.length - 1].roles = assessment.roles;
    } catch {
      add('database account permissions', 'review', 'The server did not expose effective roles. Check Atlas Database Access.');
    }

    const expected = [
      ['users', 'unique account email', (index) => index.unique === true && JSON.stringify(index.key) === '{"email":1}'],
      ['appointments', 'unique active booking slot', (index) => index.name === 'active_doctor_slot' && index.unique === true &&
        JSON.stringify(index.key) === '{"doctor":1,"date":1,"time":1}' &&
        JSON.stringify(index.partialFilterExpression) === '{"status":{"$in":["pending","confirmed"]}}'],
      ['availabilities', 'unique doctor schedule', (index) => index.unique === true && JSON.stringify(index.key) === '{"doctor":1}'],
    ];
    for (const [collection, name, matches] of expected) {
      try {
        const indexes = await connection.db.collection(collection).indexes();
        const present = indexes.some(matches);
        add(name, present ? 'pass' : 'fail', present ? 'Required uniqueness index exists.' : 'Required uniqueness index is missing or differs.');
      } catch {
        add(name, 'review', 'Collection or index metadata is unavailable.');
      }
    }
    try {
      const users = connection.db.collection('users');
      const invalid = await users.countDocuments({ password: { $not: /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/ } });
      const weakCost = await users.countDocuments({ password: /^\$2[aby]\$(?:0\d|1[01])\$/ });
      add('stored password format', invalid ? 'fail' : 'pass', `${invalid} account(s) do not use the expected bcrypt hash format. No password values were read.`);
      add('password hashing cost', weakCost ? 'fail' : 'pass', `${weakCost} account(s) use bcrypt cost below 12.`);
      const legacy = await connection.db.collection('doctors').countDocuments({ tempPassword: { $exists: true } });
      add('legacy plaintext doctor passwords', legacy ? 'fail' : 'pass', `${legacy} doctor document(s) contain a legacy temporary-password field.`);
    } catch {
      add('stored credential checks', 'review', 'The account could not run credential-format count queries.');
    }
  } catch (error) {
    add('database connection', 'review', `Connection unavailable (${error.name || 'Error'}). Check network access, DNS, and credentials; no URI was printed.`);
  } finally {
    if (connection) await connection.close();
  }
  return { checks, dashboardChecksRequired: true };
}

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  const result = await auditDatabaseSecurity(process.env.MONGO_URI || process.env.MONGO_STANDARD_URI,
    { configOnly: process.argv.includes('--config-only') });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.checks.some(({ status }) => status === 'fail') ? 1 :
    result.checks.some(({ status }) => status === 'review') ? 2 : 0;
}

if (require.main === module) main().catch(() => { console.error('Database audit could not finish; connection details hidden.'); process.exitCode = 2; });
module.exports = { auditDatabaseSecurity };
