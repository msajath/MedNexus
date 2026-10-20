const { inspectMongoUri, assessDatabaseRoles, assertLocalSeedUris } = require('../utils/databaseSecurity');
const { auditDatabaseSecurity } = require('../scripts/auditDatabaseSecurity');

describe('read-only database security audit', () => {
  test('SRV enables TLS and audit metadata does not reveal credentials or hosts', () => {
    const result = inspectMongoUri('mongodb+srv://private-user:private-password@private-cluster.example.test/medibook');
    expect(result).toMatchObject({ valid: true, explicitDatabase: true, database: 'medibook', tlsEnabled: true, credentialsPresent: true });
    expect(JSON.stringify(result)).not.toMatch(/private-user|private-password|private-cluster/);
  });
  test.each(['tlsInsecure', 'tlsAllowInvalidCertificates', 'tlsAllowInvalidHostnames'])('detects %s certificate bypass', (option) => {
    expect(inspectMongoUri(`mongodb://user:password@db.example.test/medibook?tls=true&${option}=true`).insecureOptions).toContain(option);
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
