const { MongoClient } = require('mongoose').mongo;

// Parse locally through the same driver used by the application. Never return a URI,
// host, username, password, or certificate path in an audit result.
const inspectMongoUri = (uri) => {
  if (typeof uri !== 'string' || !uri) return { valid: false };
  try {
    const client = new MongoClient(uri);
    const options = client.options;
    const hosts = options.hosts || [];
    const local = !options.srvHost && hosts.length > 0 &&
      hosts.every(({ host }) => ['localhost', '127.0.0.1', '::1'].includes(host));
    const explicitDatabase = /^mongodb(?:\+srv)?:\/\/[^/]+\/[^?]+(?:\?|$)/i.test(uri);
    // The driver normalizes some URI flags into rejectUnauthorized and
    // checkServerIdentity, so inspect decoded query keys after validating the URI.
    const query = new URLSearchParams(uri.includes('?') ? uri.slice(uri.indexOf('?') + 1) : '');
    const enabledFlags = new Set([...query].filter(([, value]) => /^(true|1|yes)$/i.test(value))
      .map(([key]) => key.toLowerCase()));
    const insecureOptions = ['tlsInsecure', 'tlsAllowInvalidCertificates', 'tlsAllowInvalidHostnames']
      .filter((key) => enabledFlags.has(key.toLowerCase()) || options[key] === true);
    return {
      valid: true,
      scheme: uri.startsWith('mongodb+srv:') ? 'mongodb+srv' : 'mongodb',
      database: options.dbName || 'test',
      explicitDatabase,
      local,
      credentialsPresent: Boolean(options.credentials?.username),
      tlsRequired: options.tls === true,
      tlsEnabled: options.tls === true,
      insecureOptions,
    };
  } catch {
    return { valid: false };
  }
};

const assessDatabaseRoles = (roles, database) => {
  const broadRoles = new Set(['root', 'atlasAdmin', 'readWriteAnyDatabase', 'readAnyDatabase',
    'dbAdminAnyDatabase', 'userAdminAnyDatabase', 'userAdmin', 'dbOwner', 'dbAdmin',
    'clusterAdmin', 'clusterManager', 'hostManager', 'backup', 'restore']);
  const unsafe = roles.some(({ role, db }) => broadRoles.has(role) || db !== database);
  const scoped = roles.length > 0 && roles.every(({ role, db }) =>
    ['readWrite', 'read'].includes(role) && db === database);
  return { status: unsafe ? 'fail' : scoped ? 'pass' : 'review', roles: roles.map(({ role, db }) => ({
    role, scope: db === database ? 'application database' : 'other database',
  })) };
};

const assertLocalSeedUris = (uris, environment) => {
  const configured = uris.filter(Boolean);
  if (environment === 'production' || !configured.length || configured.some((uri) => {
    const details = inspectMongoUri(uri);
    return !details.valid || !details.local || !details.explicitDatabase ||
      ['admin', 'config', 'local'].includes(details.database);
  })) {
    throw new Error('Destructive development seeding requires an explicit localhost database and is disabled in production. Use provision-showcase for isolated showcase data.');
  }
};

module.exports = { inspectMongoUri, assessDatabaseRoles, assertLocalSeedUris };
