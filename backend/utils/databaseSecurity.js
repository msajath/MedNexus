const { MongoClient } = require('mongoose').mongo;

// Parse locally through the same driver used by the application. Never return a URI,
// host, username, password, or certificate path in an audit result.
const SECURITY_OPTIONS = ['tls', 'ssl', 'tlsInsecure', 'tlsAllowInvalidCertificates', 'tlsAllowInvalidHostnames'];
const truthy = (value) => /^(true|1|yes)$/i.test(value);
const falsy = (value) => /^(false|0|no)$/i.test(value);

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
    const valuesByOption = new Map();
    for (const [key, value] of query) {
      const normalizedKey = key.toLowerCase();
      if (!SECURITY_OPTIONS.some((option) => option.toLowerCase() === normalizedKey)) continue;
      const values = valuesByOption.get(normalizedKey) || [];
      values.push(value);
      valuesByOption.set(normalizedKey, values);
    }
    const duplicateOptions = [...valuesByOption.entries()]
      .filter(([, values]) => values.length > 1)
      .map(([key]) => key);
    const conflictingOptions = [...valuesByOption.entries()]
      .filter(([, values]) => new Set(values.map((value) => {
        if (truthy(value)) return 'true';
        if (falsy(value)) return 'false';
        return value.toLowerCase();
      })).size > 1)
      .map(([key]) => key);
    const insecureOptions = ['tls', 'ssl', 'tlsInsecure', 'tlsAllowInvalidCertificates', 'tlsAllowInvalidHostnames']
      .filter((key) => [...valuesByOption.entries()]
        .some(([option, values]) => option === key.toLowerCase() && values.some(truthy))
        || options[key] === true)
      .filter((key) => key === 'tls' || key === 'ssl' ? options.tls === false : true);
    const tlsExplicitlyDisabled = [...valuesByOption.entries()]
      .some(([key, values]) => ['tls', 'ssl'].includes(key) && values.some(falsy)) || options.tls === false;
    const tlsExplicitlyEnabled = [...valuesByOption.entries()]
      .some(([key, values]) => ['tls', 'ssl'].includes(key) && values.some(truthy)) || options.tls === true;
    return {
      valid: true,
      scheme: uri.startsWith('mongodb+srv:') ? 'mongodb+srv' : 'mongodb',
      database: options.dbName || 'test',
      explicitDatabase,
      local,
      // The only non-loopback plaintext exception is the opt-in development
      // Compose target, with its own database and authenticated private service.
      devComposeTarget: !options.srvHost && hosts.length === 1 &&
        hosts[0].host === 'mongodb' && hosts[0].port === 27017 &&
        options.dbName === 'mednexus_development' &&
        options.credentials?.source === 'mednexus_development' &&
        Boolean(options.credentials?.username && options.credentials?.password),
      credentialsPresent: Boolean(options.credentials?.username),
      tlsRequired: options.tls === true,
      tlsEnabled: options.tls === true,
      insecureOptions,
      tlsExplicitlyDisabled,
      tlsExplicitlyEnabled,
      duplicateOptions,
      conflictingOptions,
    };
  } catch {
    return { valid: false };
  }
};

const validateMongoUriSecurity = (uri, environment = process.env.NODE_ENV,
  { devComposeMongo = process.env.DEV_COMPOSE_MONGO } = {}) => {
  const details = inspectMongoUri(uri);
  if (!details.valid) throw new Error('Invalid MongoDB connection string');
  if (details.duplicateOptions.length || details.conflictingOptions.length) {
    throw new Error('MongoDB TLS options are duplicated or conflicting');
  }
  if (details.insecureOptions.length) {
    throw new Error('MongoDB TLS verification cannot be disabled');
  }
  if (environment === 'production' && !details.explicitDatabase) {
    throw new Error('Production MongoDB connections require an explicit database name');
  }
  if (environment !== 'production' && details.local) return details;
  if (environment === 'development' && devComposeMongo === '1' && details.devComposeTarget) return details;
  if (details.scheme === 'mongodb+srv') {
    if (!details.tlsEnabled || details.tlsExplicitlyDisabled) {
      throw new Error('MongoDB TLS is required for SRV connections');
    }
    return details;
  }
  if (!details.tlsExplicitlyEnabled || !details.tlsEnabled || details.tlsExplicitlyDisabled) {
    throw new Error('MongoDB TLS: remote and production standard connections require explicit TLS');
  }
  return details;
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

module.exports = { inspectMongoUri, validateMongoUriSecurity, assessDatabaseRoles, assertLocalSeedUris };
