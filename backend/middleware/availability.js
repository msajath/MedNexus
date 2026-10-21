const PING_TIMEOUT_MS = 2000;
const RETRY_AFTER_SECONDS = 5;

// Share probes across health requests so monitoring cannot exhaust the DB pool.
const createAvailability = (connection, { pingTimeoutMs = PING_TIMEOUT_MS, cacheMs = 1000 } = {}) => {
  let pending;
  let cached;

  const requireDatabase = (req, res, next) => {
    if (connection.readyState === 1) return next();
    return res.status(503).set('Retry-After', String(RETRY_AFTER_SECONDS)).json({
      success: false,
      message: 'Service is temporarily unavailable. Please try again shortly.',
    });
  };

  const checkDatabase = async () => {
    if (connection.readyState !== 1 || !connection.db) {
      cached = undefined;
      return false;
    }
    const db = connection.db;
    if (cached?.db === db && Date.now() - cached.checkedAt < cacheMs) return cached.ready;
    if (pending?.db === db) return pending.promise;

    const probe = (async () => {
      let deadline;
      try {
        const result = await Promise.race([
          // Driver timeout covers server selection, pool checkout and the command.
          Promise.resolve().then(() => db.admin().ping({ timeoutMS: pingTimeoutMs })),
          new Promise((resolve) => {
            deadline = setTimeout(() => resolve(null), pingTimeoutMs);
            deadline.unref?.();
          }),
        ]);
        return result?.ok === 1 && connection.readyState === 1 && connection.db === db;
      } catch {
        return false;
      } finally {
        clearTimeout(deadline);
      }
    })();
    pending = { db, promise: probe };
    try {
      const ready = await probe;
      cached = { db, ready, checkedAt: Date.now() };
      return ready;
    } finally {
      if (pending?.promise === probe) pending = undefined;
    }
  };

  const readiness = async (req, res) => {
    const ready = await checkDatabase();
    if (!ready) res.set('Retry-After', String(RETRY_AFTER_SECONDS));
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable' });
  };

  return { requireDatabase, readiness };
};

module.exports = { createAvailability };
