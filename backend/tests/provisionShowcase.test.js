const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');
const { validateShowcaseUri, makeCredentials, buildFixtures, provisionShowcase, MANIFEST_ID } = require('../scripts/provisionShowcase');

const uri = 'mongodb://127.0.0.1:27017/mednexus_showcase';
const clone = (value) => JSON.parse(JSON.stringify(value));
const id = (value) => String(value);
const matches = (document, query) => Object.entries(query).every(([key, expected]) => {
  if (expected && typeof expected === 'object' && '$nin' in expected) return !expected.$nin.some((item) => id(item) === id(document[key]));
  if (expected && typeof expected === 'object' && '$ne' in expected) return id(document[key]) !== id(expected.$ne);
  return id(document[key]) === id(expected);
});

const memoryDatabase = () => {
  const data = new Map();
  const mutations = [];
  const collection = (name) => ({
    async findOne(query) { return (data.get(name) || []).find((item) => matches(item, query)) || null; },
    async insertOne(document) {
      if (!data.has(name)) data.set(name, []);
      if (data.get(name).some((item) => id(item._id) === id(document._id))) throw new Error('duplicate id');
      data.get(name).push(clone(document)); mutations.push({ operation: 'insert', name, id: id(document._id) });
      return { insertedId: document._id };
    },
    async updateOne(query, update) {
      const document = (data.get(name) || []).find((item) => matches(item, query));
      if (!document) return { matchedCount: 0 };
      Object.assign(document, clone(update.$set)); mutations.push({ operation: 'update', name });
      return { matchedCount: 1 };
    },
  });
  const db = { collection, listCollections: () => ({ toArray: async () => [...data.keys()].map((name) => ({ name })) }) };
  let failCollection;
  const names = { User: 'users', Doctor: 'doctors', Availability: 'availabilities', Appointment: 'appointments', MedicalRecord: 'medicalrecords', Message: 'messages' };
  const modelsFactory = () => Object.fromEntries(Object.entries(names).map(([model, name]) => [model, {
    createIndexes: jest.fn().mockResolvedValue(undefined),
    async create(document) {
      if (failCollection === name) throw new Error('simulated interruption');
      const stored = clone(document);
      if (model === 'User') stored.password = await bcrypt.hash(stored.password, 4);
      return collection(name).insertOne(stored);
    },
  }]));
  return { data, mutations, db, modelsFactory, failAt: (name) => { failCollection = name; },
    connect: jest.fn(async () => ({ db, close: jest.fn().mockResolvedValue(undefined) })) };
};

describe('isolated showcase provisioning', () => {
  let directory, file, memory;
  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mednexus-showcase-test-'));
    file = path.join(directory, 'credentials.local');
    memory = memoryDatabase();
  });
  afterEach(async () => {
    const target = path.resolve(directory);
    if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('mednexus-showcase-test-')) {
      throw new Error('Refusing cleanup outside the temporary showcase test directory');
    }
    await fs.rm(target, { recursive: true, force: true });
  });
  const provision = (overrides = {}) => provisionShowcase({ uri, credentialsFile: file,
    now: new Date('2026-10-20T06:00:00Z'), connect: memory.connect, modelsFactory: memory.modelsFactory, ...overrides });

  test('requires explicit isolation and verified TLS for remote databases', () => {
    expect(() => validateShowcaseUri()).toThrow('DEMO_MONGO_URI');
    for (const value of ['mongodb://localhost', 'mongodb://localhost/production', 'mongodb://remote.example/mednexus_showcase',
      'mongodb+srv://user:password@cluster.example/mednexus_showcase?tls=false',
      'mongodb+srv://user:password@cluster.example/mednexus_showcase?tlsAllowInvalidCertificates=true',
      'mongodb+srv://user:password@cluster.example/mednexus_showcase?tlsAllowInvalidHostnames=true']) {
      expect(() => validateShowcaseUri(value)).toThrow();
    }
    expect(validateShowcaseUri('mongodb+srv://user:password@cluster.example/mednexus_showcase')).toMatch(/^[a-f0-9]{64}$/);
    expect(() => validateShowcaseUri(uri, ['mongodb://other:secret@127.0.0.1:27017/mednexus_showcase?authSource=admin']))
      .toThrow('separate');
    expect(() => validateShowcaseUri(uri, ['mongodb+srv://user:password@alias.example/mednexus_showcase']))
      .toThrow('separate');
    expect(validateShowcaseUri(uri, ['mongodb://127.0.0.1:27017/production'])).toMatch(/^[a-f0-9]{64}$/);
  });

  test('refuses an occupied database before saving credentials or inserting a marker', async () => {
    memory.data.set('users', [{ _id: 'existing', name: 'Existing patient' }]);
    await expect(provision()).rejects.toThrow('empty database');
    expect(memory.mutations).toEqual([]);
    await expect(fs.stat(file)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('provisions distinct hashed credentials and related fictitious weekday fixtures', async () => {
    expect(await provision()).toMatchObject({ created: true, resumed: false, credentialsFile: file });
    const credentials = JSON.parse(await fs.readFile(file, 'utf8'));
    expect(new Set(credentials.accounts.map((account) => account.password)).size).toBe(3);
    const users = memory.data.get('users');
    expect(users.map((user) => user.role).sort()).toEqual(['admin', 'doctor', 'patient']);
    for (const user of users) {
      const account = credentials.accounts.find((item) => item.email === user.email);
      expect(account.password.length).toBeGreaterThanOrEqual(24);
      expect(user.password).not.toBe(account.password);
      expect(await bcrypt.compare(account.password, user.password)).toBe(true);
      expect(user.isActive).toBe(true);
      expect(user.isVerified).toBe(true);
    }
    const fixtures = buildFixtures(credentials);
    // Validate real application schemas without connecting to any database.
    for (const fixture of fixtures) await expect(new (require(`../models/${fixture.model}`))(fixture.data).validate()).resolves.toBeUndefined();
    for (const appointment of memory.data.get('appointments')) {
      expect([0, 6]).not.toContain(new Date(`${appointment.date}T00:00:00Z`).getUTCDay());
      expect(appointment.patient).toBe(credentials.fixtureIds.patient);
      expect(appointment.doctor).toBe(credentials.fixtureIds.doctor);
      expect(appointment.notes).toMatch(/Fictitious/);
    }
    expect(memory.data.get('availabilities')[0].schedule.filter((day) => ['Saturday', 'Sunday'].includes(day.day)))
      .toEqual(expect.arrayContaining([expect.objectContaining({ day: 'Saturday', enabled: false }), expect.objectContaining({ day: 'Sunday', enabled: false })]));
    const manifest = memory.data.get('showcase_manifests')[0];
    expect(manifest).toMatchObject({ _id: MANIFEST_ID, state: 'ready' });
    for (const account of credentials.accounts) expect(JSON.stringify(manifest)).not.toContain(account.password);
    if (process.platform !== 'win32') expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
  });

  test('completed reruns do not change passwords, sample data, or the credential file', async () => {
    await provision();
    const originalFile = await fs.readFile(file, 'utf8');
    const originalData = clone([...memory.data]);
    memory.mutations.length = 0;
    expect(await provision()).toMatchObject({ created: false });
    expect(memory.mutations).toEqual([]);
    expect(clone([...memory.data])).toEqual(originalData);
    expect(await fs.readFile(file, 'utf8')).toBe(originalFile);
  });

  test('a partial failure can be repaired using the original passwords without overwriting users', async () => {
    memory.failAt('appointments');
    await expect(provision()).rejects.toThrow('simulated interruption');
    const originalFile = await fs.readFile(file, 'utf8');
    const originalUsers = clone(memory.data.get('users'));
    expect(memory.data.get('showcase_manifests')[0].state).toBe('provisioning');
    memory.failAt(undefined); memory.mutations.length = 0;
    expect(await provision()).toMatchObject({ created: true, resumed: true });
    expect(memory.data.get('users')).toEqual(originalUsers);
    expect(memory.mutations.some((mutation) => mutation.name === 'users')).toBe(false);
    expect(await fs.readFile(file, 'utf8')).toBe(originalFile);
    expect(memory.data.get('appointments')).toHaveLength(2);
  });

  test('partial repairs stop before any insertion when existing data has changed', async () => {
    memory.failAt('appointments'); await expect(provision()).rejects.toThrow();
    memory.data.get('users')[0].role = 'admin';
    memory.failAt(undefined); memory.mutations.length = 0;
    await expect(provision()).rejects.toThrow('was changed');
    expect(memory.mutations).toEqual([]);
  });

  test('missing or altered original credential files never rotate existing passwords', async () => {
    await provision();
    const original = await fs.readFile(file, 'utf8');
    await fs.unlink(file); memory.mutations.length = 0;
    await expect(provision()).rejects.toThrow('original credential file');
    await fs.writeFile(file, `${original} `); // Harmless JSON whitespace still changes its integrity hash.
    await expect(provision()).rejects.toThrow('does not match');
    expect(memory.mutations).toEqual([]);
  });

  test('a saved file from a stop before marker insertion is reused, and secret output paths must be ignored', async () => {
    const credentials = makeCredentials(validateShowcaseUri(uri), new Date('2026-10-20T06:00:00Z'));
    const original = `${JSON.stringify(credentials, null, 2)}\n`;
    await fs.writeFile(file, original, { mode: 0o600 });
    await provision();
    expect(await fs.readFile(file, 'utf8')).toBe(original);
    expect(memory.data.get('users')[0]._id).toBe(credentials.fixtureIds.patient);
    await expect(provision({ credentialsFile: path.join(directory, 'unsafe.json') })).rejects.toThrow('.local');
  });
});
