const mongoose = require('mongoose');

const connectDB = async () => {
  const srvUri = process.env.MONGO_URI; // mongodb+srv://... (preferred)
  const standardUri = process.env.MONGO_STANDARD_URI; // mongodb://host1:27017,host2:27017/... (fallback)

  if (!srvUri && !standardUri) {
    console.error('❌ No MONGO_URI or MONGO_STANDARD_URI set in environment');
    throw new Error('No MongoDB connection string provided');
  }

  const tryConnect = async (uri, label) => {
    try {
      const conn = await mongoose.connect(uri, { autoIndex: false });
      console.log(`✅ MongoDB Connected (${label}): ${conn.connection.host || uri}`);
      return true;
    } catch (err) {
      console.error(`❌ MongoDB Connection Error (${label}):`, err.message || err);
      return false;
    }
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