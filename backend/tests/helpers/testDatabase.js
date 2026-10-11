const assertTestDatabase = (uri) => {
  // These suites delete fixtures. Explicitly refuse application/remote databases.
  const parsed = new URL(uri);
  if (parsed.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
      !/^\/(mednexus_)?[a-z0-9_]*(test|ci|qa)$/.test(parsed.pathname)) {
    throw new Error('Tests require a localhost MongoDB database ending in _test, _ci, or _qa');
  }
};
module.exports = assertTestDatabase;
