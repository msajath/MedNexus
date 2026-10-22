const { inspectMongoUri, validateMongoUriSecurity, assessDatabaseRoles, assertLocalSeedUris } = require('../utils/databaseSecurity');
const { auditDatabaseSecurity } = require('../scripts/auditDatabaseSecurity');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

describe('read-only database security audit', () => {
  test('SRV enables TLS and audit metadata does not reveal credentials or hosts', () => {
    const result = inspectMongoUri('mongodb+srv://private-user:private-password@private-cluster.example.test/medibook');
    expect(result).toMatchObject({ valid: true, explicitDatabase: true, database: 'medibook', tlsEnabled: true, credentialsPresent: true });
    expect(JSON.stringify(result)).not.toMatch(/private-user|private-password|private-cluster/);
  });
  test.each(['tlsInsecure', 'tlsAllowInvalidCertificates', 'tlsAllowInvalidHostnames'])('detects %s certificate bypass', (option) => {
    expect(inspectMongoUri(`mongodb://user:password@db.example.test/medibook?tls=true&${option}=true`).insecureOptions).toContain(option);
  });
  test('accepts a secure SRV URI in production', () => {
    expect(validateMongoUriSecurity('mongodb+srv://user:password@cluster.example.test/medibook', 'production').tlsEnabled).toBe(true);
  });
  test.each(['mongodb+srv://user:password@cluster.example.test/', 'mongodb://127.0.0.1/'])(
    'rejects implicit database selection in production: %s', (uri) => {
      expect(() => validateMongoUriSecurity(uri, 'production')).toThrow(/explicit database name/);
    }
  );
  test('rejects a fallback to a different production database before connecting', async () => {
    const previous = { NODE_ENV: process.env.NODE_ENV, MONGO_URI: process.env.MONGO_URI, MONGO_STANDARD_URI: process.env.MONGO_STANDARD_URI };
    const connect = jest.spyOn(mongoose, 'connect');
    Object.assign(process.env, { NODE_ENV: 'production', MONGO_URI: 'mongodb+srv://user:password@cluster.example.test/medibook', MONGO_STANDARD_URI: 'mongodb://user:password@db.example.test/other?tls=true' });
    try {
      await expect(connectDB()).rejects.toThrow(/same database name/);
      expect(connect).not.toHaveBeenCalled();
    } finally {
      connect.mockRestore();
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
  test.each(['tls=false', 'ssl=false', 'tlsInsecure=true', 'tlsAllowInvalidCertificates=true', 'tlsAllowInvalidHostnames=true'])(
    'rejects insecure SRV option %s in production', (option) => {
      expect(() => validateMongoUriSecurity(`mongodb+srv://user:password@cluster.example.test/medibook?${option}`, 'production')).toThrow();
    }
  );
  test('requires explicit TLS for a remote standard URI in production', () => {
    expect(() => validateMongoUriSecurity('mongodb://user:password@db.example.test/medibook', 'production')).toThrow(/explicit TLS/);
    expect(validateMongoUriSecurity('mongodb://user:password@db.example.test/medibook?tls=true', 'production').tlsEnabled).toBe(true);
  });
  test('allows isolated localhost development and test URIs without TLS', () => {
    expect(validateMongoUriSecurity('mongodb://127.0.0.1:27017/medibook', 'development').local).toBe(true);
    expect(validateMongoUriSecurity('mongodb://127.0.0.1:27017/medibook', 'test').local).toBe(true);
  });
  test.each(['tls=true&tls=false', 'TLS=true&tls=false', 'tls=true&tls=true'])(
    'rejects duplicate or conflicting TLS options: %s', (options) => {
      expect(() => validateMongoUriSecurity(`mongodb://user:password@db.example.test/medibook?${options}`, 'production'))
        .toThrow(/duplicated or conflicting|Invalid MongoDB connection string/);
    }
  );
  test('malformed URI fails without revealing credentials', () => {
    expect(() => validateMongoUriSecurity('mongodb://user:secret@bad uri/medibook', 'production'))
      .toThrow();
  });
  test('connection errors do not log credentials', async () => {
    const previousEnvironment = process.env.NODE_ENV;
    const previousStandardUri = process.env.MONGO_STANDARD_URI;
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const connect = jest.spyOn(mongoose, 'connect').mockRejectedValue(new Error('mongodb://user:secret@db.example.test/medibook'));
    process.env.NODE_ENV = 'production';
    process.env.MONGO_STANDARD_URI = 'mongodb://user:secret@db.example.test/medibook?tls=true';
    try {
      await expect(connectDB()).rejects.toThrow('All MongoDB connection attempts failed');
      expect(log.mock.calls.flat().join(' ')).not.toContain('secret');
      expect(log.mock.calls.flat().join(' ')).toContain('could not be established');
    } finally {
      connect.mockRestore();
      log.mockRestore();
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
      if (previousStandardUri === undefined) delete process.env.MONGO_STANDARD_URI;
      else process.env.MONGO_STANDARD_URI = previousStandardUri;
    }
  });
  test('does not treat a lookalike localhost host as local', () => {
    expect(inspectMongoUri('mongodb://localhost.evil.example/medibook').local).toBe(false);
    expect(inspectMongoUri('mongodb://127.0.0.1/medibook').local).toBe(true);
  });
  test('reports implicit test database and disabled TLS without connecting', async () => {
    const result = await auditDatabaseSecurity('mongodb+srv://user:password@db.example.test/?tls=false', { configOnly: true });
    expect(result.checks.find(({ name }) => name === 'explicit database').status).toBe('review');
    expect(result.checks.find(({ name }) => name === 'encrypted transport').status).toBe('fail');
    expect(result.checks).toHaveLength(4);
  });
  test('invalid URIs produce a safe error without the raw value', async () => {
    const result = await auditDatabaseSecurity('not-a-uri-with-private-data', { configOnly: true });
    expect(result.checks[0].status).toBe('fail');
    expect(JSON.stringify(result)).not.toContain('private-data');
  });
  test('requires scoped database roles and flags cluster administration', () => {
    expect(assessDatabaseRoles([{ role: 'readWrite', db: 'medibook' }], 'medibook').status).toBe('pass');
    expect(assessDatabaseRoles([{ role: 'readWrite', db: 'other' }], 'medibook').status).toBe('fail');
    expect(assessDatabaseRoles([{ role: 'atlasAdmin', db: 'admin' }], 'medibook').status).toBe('fail');
    expect(assessDatabaseRoles([{ role: 'custom', db: 'medibook' }], 'medibook').status).toBe('review');
  });
  test('destructive development seeding cannot reach Atlas or a remote fallback', () => {
    const local = 'mongodb://127.0.0.1/medibook';
    const remote = 'mongodb+srv://user:password@cluster.example.test/test';
    expect(() => assertLocalSeedUris([local], 'development')).not.toThrow();
    expect(() => assertLocalSeedUris([remote], 'development')).toThrow(/localhost/);
    expect(() => assertLocalSeedUris([local, remote], 'development')).toThrow(/localhost/);
    expect(() => assertLocalSeedUris([local], 'production')).toThrow(/production/);
    expect(() => assertLocalSeedUris(['mongodb://127.0.0.1/admin'], 'development')).toThrow();
  });
});
