// Render terminates public connections at its reverse proxy. Trust only the
// nearest hop; accepting an arbitrary forwarded chain lets clients spoof IPs.
const getTrustProxySetting = (env = process.env) => {
  const value = env.TRUST_PROXY?.trim();
  if (value === '1') return 1;
  if (value === '0' || value === 'false') return false;
  if (value === undefined || value === '') return env.RENDER === 'true' ? 1 : false;
  throw new Error('TRUST_PROXY must be 0 (direct connections) or 1 (one trusted reverse proxy)');
};

module.exports = { getTrustProxySetting };
