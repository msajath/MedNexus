// Parse Compose only; never start containers or contact a database. Supply
// ephemeral credentials and explicit example files so no real .env is loaded.
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const env = {
  ...process.env,
  MONGO_USERNAME: 'config_check_root', MONGO_PASSWORD: randomBytes(24).toString('hex'),
  MONGO_APP_USERNAME: 'config_check_app', MONGO_APP_PASSWORD: randomBytes(24).toString('hex'),
  JWT_SECRET: randomBytes(32).toString('hex'), HTTP_PORT: '18080', HTTP_BIND: '0.0.0.0',
  ALLOWED_ORIGINS: 'https://staging.example.test',
  ATLAS_MONGO_URI: `mongodb+srv://config_check:${randomBytes(24).toString('hex')}@cluster.example.test/mednexus_staging`,
};
const parse = (composeFile, template) => {
  const result = spawnSync('docker', ['compose', '--env-file', template, '-f', composeFile, 'config', '--format', 'json'], {
    cwd: root, env, encoding: 'utf8', timeout: 30000,
  });
  // Do not print raw Compose output/errors: interpolated values can be secrets.
  if (result.error || result.status !== 0) throw new Error(`Compose configuration parsing failed for ${composeFile}`);
  return JSON.parse(result.stdout);
};
const keys = value => Object.keys(value || {}).sort();

try {
  const development = parse('docker-compose.yml', '.env.example');
  const { mongodb, backend, frontend } = development.services;
  assert.equal(development.name, 'mednexus-dev', 'development project must be separate');
  assert.equal(backend.environment.NODE_ENV, 'development');
  assert.equal(backend.environment.DEV_COMPOSE_MONGO, '1');
  const uri = new URL(backend.environment.MONGO_URI);
  assert.equal(uri.hostname, 'mongodb');
  assert.equal(uri.port, '27017');
  assert.equal(uri.pathname, '/mednexus_development');
  assert.equal(uri.searchParams.get('authSource'), 'mednexus_development');
  assert.ok(uri.username && uri.password, 'development application credentials are required');
  assert.equal(development.networks.database.internal, true);
  assert.deepEqual(keys(mongodb.networks), ['database']);
  assert.deepEqual(keys(backend.networks), ['database', 'web']);
  assert.deepEqual(keys(frontend.networks), ['web']);
  assert.equal((mongodb.ports || []).length, 0, 'database must not publish a host port');
  assert.equal((backend.ports || []).length, 0, 'backend must not publish a host port');
  assert.ok(frontend.ports.length > 0 && frontend.ports.every(port => port.host_ip === '127.0.0.1'), 'development frontend must stay on loopback even if HTTP_BIND is overridden');
  assert.ok(mongodb.volumes.some(volume => volume.source === 'mongo_dev_data' && volume.target === '/data/db'));

  let created;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'infra/mongo/init-app-user.js'), 'utf8'), {
    process: { env },
    db: { getSiblingDB: name => {
      assert.equal(name, 'mednexus_development');
      return { getUser: () => null, createUser: account => { created = account; } };
    } },
  });
  assert.equal(created.user, env.MONGO_APP_USERNAME);
  assert.equal(created.roles.length, 1);
  assert.equal(created.roles[0].role, 'readWrite');
  assert.equal(created.roles[0].db, 'mednexus_development');

  const atlas = parse('docker-compose.atlas.yml', '.env.atlas.example');
  assert.equal(atlas.services.backend.environment.NODE_ENV, 'production');
  assert.equal(atlas.services.backend.environment.DEV_COMPOSE_MONGO, undefined);
  assert.equal(atlas.services.backend.environment.MONGO_URI, env.ATLAS_MONGO_URI);
  assert.equal(atlas.services.mongodb, undefined, 'Atlas stack must not start a local database');
  console.log(JSON.stringify({ status: 'PASS', developmentIsolation: true, productionSeparation: true, configurationOnly: true }));
} catch (error) {
  // Assertion text/actual values may contain generated credentials. Keep output
  // bounded; the failing assertion location is sufficient for local diagnosis.
  const location = error.stack?.split('\n').find(line => line.includes('checkComposeConfig.js:'))?.trim();
  console.error(JSON.stringify({ status: 'FAIL', check: 'Compose isolation contract', location }));
  process.exitCode = 1;
}
