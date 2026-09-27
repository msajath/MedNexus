const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

const app = express();

// ──────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
  ╔══════════════════════════════════════════╗
  ║   🏥  MEDNEXUS API Server               ║
  ║   🚀  Running on port ${PORT}              ║
  ║   📡  http://localhost:${PORT}/api/health  ║
  ╚══════════════════════════════════════════╝
  `);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
