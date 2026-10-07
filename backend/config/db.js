const mongoose = require('mongoose');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');

const ensureStorageReady = async () => {
  // autoIndex is disabled for normal queries; explicitly require these safety indexes.
  await User.createIndexes();
  await Appointment.createIndexes();
  // Remove legacy plaintext doctor credentials before accepting requests.
  await Doctor.collection.updateMany(
    { tempPassword: { $exists: true } },
    { $unset: { tempPassword: '' } }
  );
};

const connectDB = async () => {
  const srvUri = process.env.MONGO_URI; // mongodb+srv://... (preferred)
  const standardUri = process.env.MONGO_STANDARD_URI; // mongodb://host1:27017,host2:27017/... (fallback)

  if (!srvUri && !standardUri) {
    console.error('❌ No MONGO_URI or MONGO_STANDARD_URI set in environment');
    throw new Error('No MongoDB connection string provided');
  }

  const tryConnect = async (uri, label) => {
    let conn;
    try {
      conn = await mongoose.connect(uri, { autoIndex: false });
    } catch (err) {
      console.error(`❌ MongoDB Connection Error (${label}):`, err.message || err);
      return false;
    }
    // Index or migration failure is a data-integrity problem, not a reason to
    // silently switch to another database URI.
    await ensureStorageReady();
    console.log(`✅ MongoDB Connected (${label}): ${conn.connection.host}`);
    return true;
  };

  // Try SRV first (usual Atlas URI). If it fails due to DNS, try the standard URI.
  if (srvUri) {
    const ok = await tryConnect(srvUri, 'SRV');
    if (ok) return;
  }

  if (standardUri) {
    const ok = await tryConnect(standardUri, 'STANDARD');
    if (ok) return;
  }

  throw new Error('All MongoDB connection attempts failed');
};

module.exports = connectDB;
