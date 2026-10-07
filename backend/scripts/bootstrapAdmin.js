require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

async function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Set ADMIN_EMAIL to the administrator email address');
  }
  if (process.env.NODE_ENV === 'production' &&
      !(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)) {
    throw new Error('Configure SMTP before bootstrapping a production admin');
  }

  await connectDB();
  const existingAdmin = await User.exists({ role: 'admin', isActive: { $ne: false } });
  if (existingAdmin) throw new Error('An active administrator already exists');
  if (await User.exists({ email })) throw new Error('Email is already registered');

  await User.create({
    name: process.env.ADMIN_NAME || 'Administrator',
    email,
    password: crypto.randomBytes(32).toString('hex'),
    role: 'admin',
    isVerified: true,
  });
  console.log(`Administrator created for ${email}. Use Forgot Password to set a private password.`);
}

bootstrapAdmin()
  .catch((error) => {
    console.error('Admin bootstrap failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
