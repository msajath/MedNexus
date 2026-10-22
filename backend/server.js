const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { helmet, limiter, validateRequest } = require('./middleware/security');
const { createAvailability } = require('./middleware/availability');
const { getTrustProxySetting } = require('./config/proxy');

// Load environment variables
dotenv.config();

if (process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters in production');
}

const app = express();
app.disable('x-powered-by');
app.set('query parser', 'simple');
app.set('trust proxy', getTrustProxySetting());
app.use(helmet({ strictTransportSecurity: process.env.NODE_ENV === 'production' ? undefined : false }));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api', limiter(300, 60 * 1000, { skip: (req) => ['/health', '/ready'].includes(req.path) }));

// ──────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(Object.assign(new Error('Untrusted request origin'), { status: 403 }));
  },
  credentials: true,
}));
app.use(express.json({ limit: '4mb' }));
app.use(validateRequest);

app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.headers.origin) return next();
  if (!allowedOrigins.includes(req.headers.origin)) {
    return res.status(403).json({ success: false, message: 'Untrusted request origin' });
  }
  next();
});

// ──────────────────────────────────────────────
// API Routes
// ──────────────────────────────────────────────
// Operational endpoints remain responsive when a database connection is lost.
const { requireDatabase, readiness } = createAvailability(mongoose.connection);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MEDNEXUS API is running', timestamp: new Date().toISOString() });
});
app.get('/api/ready', readiness);

// Reject disconnected requests before Mongoose can buffer database operations.
app.use('/api/auth', requireDatabase, require('./routes/authRoutes'));
app.use('/api/doctors', requireDatabase, require('./routes/doctorRoutes'));
app.use('/api/appointments', requireDatabase, require('./routes/appointmentRoutes'));
app.use('/api/availability', requireDatabase, require('./routes/availabilityRoutes'));
app.use('/api/leaves', requireDatabase, require('./routes/leaveRoutes'));
app.use('/api/payments', requireDatabase, require('./routes/paymentRoutes'));
app.use('/api/admin', requireDatabase, require('./routes/adminRoutes'));
app.use('/api/records', requireDatabase, require('./routes/medicalRecordRoutes'));
app.use('/api/contact', requireDatabase, require('./routes/contactRoutes'));
app.use('/api/messages', requireDatabase, require('./routes/messageRoutes'));

// ──────────────────────────────────────────────
// Error Handler (must be after routes)
// ──────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

// ──────────────────────────────────────────────
// Start Server
// ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`
  ╔══════════════════════════════════════════╗
  ║   🏥  MEDNEXUS API Server               ║
  ║   🚀  Running on port ${PORT}              ║
  ║   📡  http://localhost:${PORT}/api/health  ║
  ╚══════════════════════════════════════════╝
  `);
    });
    const shutdown = () => {
      const deadline = setTimeout(() => process.exit(1), 25000);
      deadline.unref();
      server.close(async () => {
        try {
          await mongoose.disconnect();
          clearTimeout(deadline);
          process.exit(0);
        } catch (error) {
          console.error('Shutdown failed:', error.message);
          process.exit(1);
        }
      });
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
    return server;
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  startServer();
}

module.exports = { app, startServer };
