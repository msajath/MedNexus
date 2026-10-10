const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

if (process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters in production');
}

const app = express();
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);

// ──────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/doctors', require('./routes/doctorRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/availability', require('./routes/availabilityRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/records', require('./routes/medicalRecordRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MEDNEXUS API is running', timestamp: new Date().toISOString() });
});

app.get('/api/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable' });
});

// ──────────────────────────────────────────────
// Error Handler (must be after routes)
// ──────────────────────────────────────────────
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
