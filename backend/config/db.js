const mongoose = require('mongoose');

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

const tryConnect = async (uri) => {
  try {
    const conn = await mongoose.connect(uri, { autoIndex: false });
    console.log(`✅ MongoDB Connected: ${conn.connection.host || uri}`);
    return true;
  } catch (err) {
    console.error(`❌ MongoDB Connection Error for ${uri}: ${err.message}`);
    return false;
  }
};

const connectDB = async () => {
  const primary = process.env.MONGO_URI;
  const fallback = process.env.MONGO_URI_FALLBACK;

  if (!primary && !fallback) {
    console.error('❌ No MONGO_URI or MONGO_URI_FALLBACK set in environment');
    throw new Error('No MongoDB connection string provided');
  }

  while (true) {
    if (primary) {
      const ok = await tryConnect(primary);
      if (ok) return;
    }

    if (fallback && fallback !== primary) {
      const ok = await tryConnect(fallback);
      if (ok) return;
    }

    console.log('Retrying MongoDB connection in 5 seconds...');
    await wait(5000);
  }
};

module.exports = connectDB;