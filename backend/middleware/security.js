const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const crypto = require('crypto');

const limiter = (limit, windowMs = 15 * 60 * 1000, extra = {}) => rateLimit({
  windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Try again later.' },
  ...extra,
});

const accountLimiter = (limit, extra = {}) => limiter(limit, 60 * 60 * 1000, {
  keyGenerator: (req) => crypto.createHash('sha256')
    .update(typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'invalid').digest('hex'),
  ...extra,
});

// Mongo operators and prototype keys are never legitimate input to these APIs.
const containsUnsafeKeys = (value, depth = 0) => {
  if (depth > 20) return true;
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) =>
    key.startsWith('$') || key.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(key) ||
    containsUnsafeKeys(child, depth + 1));
};

const validateRequest = (req, res, next) => {
  if (containsUnsafeKeys(req.body) || containsUnsafeKeys(req.query)) {
    return res.status(400).json({ success: false, message: 'Invalid request input' });
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.body && (Array.isArray(req.body) || typeof req.body !== 'object')) {
      return res.status(400).json({ success: false, message: 'A JSON object is required' });
    }
    if (req.headers['content-length'] > 0 && !req.is('application/json')) {
      return res.status(415).json({ success: false, message: 'Use application/json' });
    }
    // A custom header forces preflight for cross-origin cookie requests.
    if (req.headers.cookie?.includes('mednexus_session=') && req.headers['x-mednexus-request'] !== '1') {
      return res.status(403).json({ success: false, message: 'Missing request protection header' });
    }
  }
  next();
};

module.exports = { helmet, limiter, accountLimiter, validateRequest };
