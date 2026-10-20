const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { inspectMongoUri } = require('../utils/databaseSecurity');
const { passwordIssue } = require('../utils/passwordPolicy');
const { defaultSchedule } = require('../utils/slots');

const DATABASE = 'mednexus_showcase';
const MANIFEST_ID = 'mednexus-showcase-v1';
const DEFAULT_CREDENTIALS_FILE = path.resolve(__dirname, '../../showcase-credentials.local');
const accountDetails = [
  { role: 'patient', id: 'patient', name: 'Showcase Patient (Fictitious)', email: 'showcase.patient@example.invalid' },
  { role: 'doctor', id: 'doctorUser', name: 'Dr. Showcase (Fictitious)', email: 'showcase.doctor@example.invalid' },
  { role: 'admin', id: 'admin', name: 'Showcase Administrator', email: 'showcase.admin@example.invalid' },
];
const fixtureNames = ['patient', 'doctorUser', 'admin', 'doctor', 'availability', 'pastAppointment',
  'futureAppointment', 'record', 'patientMessage', 'doctorMessage', 'adminMessage'];

class ShowcaseError extends Error {}
const fail = (message) => { throw new ShowcaseError(message); };
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Compare database destinations without retaining or displaying credentials.
const targetKey = (uri) => {
  const options = new mongoose.mongo.MongoClient(uri).options;
  return JSON.stringify([options.srvHost?.toLowerCase() || options.hosts.map(String).sort().join(','), options.dbName]);
};

const validateShowcaseUri = (uri, appUris = []) => {
  if (!uri) fail('Set DEMO_MONGO_URI explicitly; the application database is never used as a fallback.');
  const details = inspectMongoUri(uri);
  if (!details.valid || !details.explicitDatabase || details.database !== DATABASE) {
    fail(`DEMO_MONGO_URI must explicitly select the ${DATABASE} database.`);
  }
  if (!details.local && (!details.tlsEnabled || details.insecureOptions.length)) {
    fail('A remote showcase database requires TLS with certificate and hostname validation enabled.');
  }
  let key;
  try { key = targetKey(uri); } catch { fail('DEMO_MONGO_URI is invalid.'); }
  for (const appUri of appUris.filter(Boolean)) {
    let sameTarget = false;
    try { sameTarget = targetKey(appUri) === key; } catch { fail('An application database URI is invalid; isolation could not be verified.'); }
    // A standard URI can alias the same cluster as an SRV URI. Refuse an app
    // already using this reserved database name even when endpoints differ.
    if (sameTarget || inspectMongoUri(appUri).database === DATABASE) {
      fail('The showcase database must be separate from every configured application database.');
    }
  }
  return digest(key);
};

const makeCredentials = (targetFingerprint, now = new Date()) => ({
  version: 1,
  database: DATABASE,
  targetFingerprint,
  provisionId: crypto.randomUUID(),
  createdAt: now.toISOString(),
  fixtureIds: Object.fromEntries(fixtureNames.map((name) => [name, new mongoose.Types.ObjectId().toHexString()])),
  accounts: accountDetails.map(({ role, email }) => ({ role, email, password: crypto.randomBytes(24).toString('base64url') })),
});

const validateCredentials = (value, targetFingerprint) => {
  if (value?.version !== 1 || value.database !== DATABASE || value.targetFingerprint !== targetFingerprint ||
      typeof value.provisionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.provisionId) ||
      !value.createdAt || !Number.isFinite(Date.parse(value.createdAt)) ||
      fixtureNames.some((name) => !/^[0-9a-f]{24}$/.test(value.fixtureIds?.[name] || '')) ||
      new Set(Object.values(value.fixtureIds || {})).size !== fixtureNames.length ||
      !Array.isArray(value.accounts) || value.accounts.length !== 3 ||
      accountDetails.some(({ role, email }) => {
        const account = value.accounts.find((item) => item.role === role);
        return !account || account.email !== email || passwordIssue(account.password, { email });
      }) || new Set(value.accounts?.map((account) => account.password)).size !== 3) {
    fail('The local showcase credential file is invalid or belongs to another database. Keep the original file; no passwords were rotated.');
  }
  return value;
};

const weekdayDate = (createdAt, offset) => {
  const date = new Date(createdAt);
  date.setUTCDate(date.getUTCDate() + offset);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + (offset < 0 ? -1 : 1));
  return date.toISOString().slice(0, 10);
};

const buildFixtures = (credentials) => {
  const ids = credentials.fixtureIds;
  const past = weekdayDate(credentials.createdAt, -7);
  const future = weekdayDate(credentials.createdAt, 7);
  return [
    ...accountDetails.map(({ id, ...details }) => ({ collection: 'users', model: 'User', data: {
      _id: ids[id], ...details, password: credentials.accounts.find((account) => account.role === details.role).password,
      isActive: true, isVerified: true,
    } })),
    { collection: 'doctors', model: 'Doctor', data: { _id: ids.doctor, user: ids.doctorUser,
      specialty: 'General Practice', fee: 50, available: true, credentialsChanged: true,
      location: 'Fictitious Showcase Clinic', bio: 'Fictitious demonstration profile. This is not a real clinician.' } },
    { collection: 'availabilities', model: 'Availability', data: { _id: ids.availability,
      doctor: ids.doctor, schedule: defaultSchedule.map((day) => ({ ...day })) } },
    { collection: 'appointments', model: 'Appointment', data: { _id: ids.pastAppointment,
      patient: ids.patient, doctor: ids.doctor, date: past, time: '10:00 AM', status: 'completed',
      type: 'Consultation', notes: 'Fictitious showcase appointment. No real medical consultation occurred.' } },
    { collection: 'appointments', model: 'Appointment', data: { _id: ids.futureAppointment,
      patient: ids.patient, doctor: ids.doctor, date: future, time: '10:00 AM', status: 'confirmed',
      type: 'Follow-up', notes: 'Fictitious showcase follow-up. This booking is demonstration data only.' } },
    { collection: 'medicalrecords', model: 'MedicalRecord', data: { _id: ids.record,
      patient: ids.patient, doctor: ids.doctor, appointment: ids.pastAppointment, date: past,
      title: 'Fictitious showcase record', type: 'Other', addedBy: 'doctor',
      description: 'Synthetic sample for demonstrating the portal. It contains no real patient information or medical advice.' } },
    ...accountDetails.map(({ role, id }) => ({ collection: 'messages', model: 'Message', data: {
      _id: ids[`${role}Message`], recipient: ids[id], senderName: 'MedNexus Showcase',
      subject: 'Welcome to the fictitious showcase',
      body: 'This separate demonstration database contains synthetic sample data only. Do not enter real patient information.',
    } })),
  ];
};

const readCredentials = async (file, fingerprint) => {
  let stat;
  try { stat = await fs.lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink()) fail('The credential path must be a regular local file, not a symbolic link.');
  let raw, value;
  try { raw = await fs.readFile(file, 'utf8'); value = JSON.parse(raw); } catch { fail('The existing credential file cannot be read. Preserve it and restore the original before retrying.'); }
  return { credentials: validateCredentials(value, fingerprint), hash: digest(raw) };
};

const writeCredentials = async (file, credentials) => {
  const raw = `${JSON.stringify(credentials, null, 2)}\n`;
  let handle;
  try {
    handle = await fs.open(file, 'wx', 0o600);
    await handle.writeFile(raw, 'utf8');
    await handle.sync();
  } catch (error) {
    if (error.code === 'EEXIST') fail('A credential file appeared during provisioning. Retry using that original file.');
    fail('Could not safely save the credential file. No showcase accounts were created.');
  } finally { if (handle) await handle.close(); }
  // Windows ACLs do not fully follow POSIX mode bits; the guide covers ACL checks.
  await fs.chmod(file, 0o600).catch(() => {});
  return { credentials, hash: digest(raw) };
};

const checkAllowedDocuments = async (db, fixtures, hasManifest) => {
  const allowed = new Map();
  for (const fixture of fixtures) {
    if (!allowed.has(fixture.collection)) allowed.set(fixture.collection, []);
    allowed.get(fixture.collection).push(new mongoose.Types.ObjectId(fixture.data._id));
  }
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;
    const query = hasManifest && name === 'showcase_manifests' ? { _id: { $ne: MANIFEST_ID } }
      : hasManifest && allowed.has(name) ? { _id: { $nin: allowed.get(name) } } : {};
    if (await db.collection(name).findOne(query)) {
      fail(hasManifest ? 'Unexpected data exists in this showcase database. No existing data was changed; automatic repair stopped.'
        : 'First-time showcase provisioning requires an empty database. Nothing was deleted or overwritten.');
    }
  }
};

const matchesExpected = (actual, expected) => {
  if (expected === null || typeof expected !== 'object') return String(actual) === String(expected);
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((item, i) => matchesExpected(actual[i], item));
  return actual && Object.entries(expected).every(([key, value]) => matchesExpected(actual[key], value));
};

const existingFixture = async (db, fixture) => {
  const actual = await db.collection(fixture.collection).findOne({ _id: new mongoose.Types.ObjectId(fixture.data._id) });
  if (!actual) return false;
  const { password, ...expected } = fixture.data;
  if (!matchesExpected(actual, expected) || (password && !await bcrypt.compare(password, actual.password || ''))) {
    fail('A partially provisioned showcase document was changed. Automatic repair stopped without overwriting it.');
  }
  return true;
};

const createModels = (connection) => Object.fromEntries(['User', 'Doctor', 'Availability', 'Appointment', 'MedicalRecord', 'Message']
  .map((name) => [name, connection.model(name, require(`../models/${name}`).schema)]));

const provisionShowcase = async ({ uri, appUris = [], credentialsFile = DEFAULT_CREDENTIALS_FILE,
  now = new Date(), connect = (value) => mongoose.createConnection(value, { autoIndex: false, autoCreate: false,
    serverSelectionTimeoutMS: 15000 }).asPromise(), modelsFactory = createModels } = {}) => {
  const fingerprint = validateShowcaseUri(uri, appUris);
  const file = path.resolve(credentialsFile);
  if (!file.endsWith('.local')) fail('The credential file must end in .local so the repository ignore rule protects it.');
  let connection;
  try { connection = await connect(uri); } catch { fail('Cannot connect to the isolated showcase database. Check its credentials, network access, and TLS settings.'); }
  try {
    const db = connection.db;
    const manifests = db.collection('showcase_manifests');
    let manifest = await manifests.findOne({ _id: MANIFEST_ID });
    let saved = await readCredentials(file, fingerprint);
    if (manifest) {
      if (!saved) fail('This database already has a showcase manifest. Use the original credential file; passwords will not be regenerated.');
      if (manifest.version !== 1 || manifest.provisionId !== saved.credentials.provisionId ||
          manifest.credentialFileHash !== saved.hash || !matchesExpected(manifest.fixtureIds, saved.credentials.fixtureIds) ||
          !['provisioning', 'ready'].includes(manifest.state)) {
        fail('The database manifest does not match the original credential file. Nothing was overwritten.');
      }
      if (manifest.state === 'ready') return { created: false, resumed: false, credentialsFile: file };
    } else {
      await checkAllowedDocuments(db, [], false);
      if (!saved) saved = await writeCredentials(file, makeCredentials(fingerprint, now));
      manifest = { _id: MANIFEST_ID, version: 1, state: 'provisioning', provisionId: saved.credentials.provisionId,
        credentialFileHash: saved.hash, fixtureIds: saved.credentials.fixtureIds, createdAt: new Date(saved.credentials.createdAt) };
      await manifests.insertOne(manifest);
    }
    const fixtures = buildFixtures(saved.credentials);
    await checkAllowedDocuments(db, fixtures, true);
    // Preflight all existing fixtures before inserting anything during repair.
    const exists = [];
    for (const fixture of fixtures) exists.push(await existingFixture(db, fixture));
    const models = modelsFactory(connection);
    for (const name of ['User', 'Appointment', 'Availability']) await models[name].createIndexes();
    for (let i = 0; i < fixtures.length; i++) if (!exists[i]) await models[fixtures[i].model].create(fixtures[i].data);
    const completed = await manifests.updateOne({ _id: MANIFEST_ID, provisionId: manifest.provisionId, state: 'provisioning' },
      { $set: { state: 'ready', completedAt: new Date() } });
    if (completed.matchedCount !== 1) fail('The showcase manifest changed during provisioning. Keep the credential file and rerun safely.');
    return { created: true, resumed: exists.some(Boolean), credentialsFile: file };
  } finally { await connection.close(); }
};

if (require.main === module) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  provisionShowcase({ uri: process.env.DEMO_MONGO_URI,
    appUris: [process.env.MONGO_URI, process.env.MONGO_STANDARD_URI],
    credentialsFile: process.env.SHOWCASE_CREDENTIALS_FILE || DEFAULT_CREDENTIALS_FILE })
    .then((result) => {
      console.log(result.created ? 'Separate showcase accounts and fictitious sample data are ready.' : 'This showcase is already provisioned; no data or passwords were changed.');
      console.log(`Use the existing private credentials in: ${result.credentialsFile}`);
      console.log('Passwords are never printed. Keep this file private and check its local filesystem permissions.');
    })
    .catch((error) => {
      console.error(error instanceof ShowcaseError ? error.message
        : 'Showcase provisioning stopped. Preserve the .local credential file and rerun to repair missing fixtures; no existing documents are overwritten.');
      process.exitCode = 1;
    });
}

module.exports = { DATABASE, MANIFEST_ID, validateShowcaseUri, makeCredentials, validateCredentials,
  buildFixtures, provisionShowcase };
