// Never expose database errors, stack traces, input values, or credentials.
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid resource or input format' });
  if (err.code === 11000) return res.status(409).json({ success: false, message: 'Resource already exists' });
  if (err.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Invalid input' });
  if (['JsonWebTokenError', 'TokenExpiredError'].includes(err.name)) return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  const status = err.statusCode || err.status || 500;
  const messages = { 400: 'Invalid request', 403: 'Untrusted request origin', 413: 'Request body too large', 415: 'Use application/json' };
  if (status >= 500) console.error('Request failed:', err.name || 'Error');
  return res.status(status).json({ success: false, message: messages[status] || 'Internal Server Error' });
};
module.exports = errorHandler;
