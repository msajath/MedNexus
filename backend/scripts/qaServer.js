// Disposable browser-test server; never reads the application's database URI.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'qa-only-secret-at-least-32-characters';
process.env.JWT_EXPIRE = '7d';
process.env.ALLOWED_ORIGINS = 'http://127.0.0.1:5174';
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { app } = require('../server');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Availability = require('../models/Availability');
const Message = require('../models/Message');
const ContactMessage = require('../models/ContactMessage');
const assertTestDatabase = require('../tests/helpers/testDatabase');

async function main() {
  const mongo = process.env.QA_MONGO_URI ? null : await MongoMemoryServer.create({ binary: { version: '7.0.14' }, instance: { dbName: 'mednexus_browser_qa' } });
  const uri = process.env.QA_MONGO_URI || mongo.getUri();
  assertTestDatabase(uri);
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await Promise.all([User.createIndexes(), Appointment.createIndexes(), Availability.createIndexes()]);
  const password = 'QA-password-123456';
  for (const role of ['patient', 'doctor', 'admin']) {
    const user = await User.create({ name: `QA ${role}`, email: `${role}@qa.example`, password, role, isVerified: true });
    if (role === 'doctor') await Doctor.create({ user: user._id, specialty: 'General Practice', fee: 125, bio: 'QA doctor profile' });
    await Message.create({ recipient: user._id, senderName: 'QA Clinic', subject: 'QA welcome', body: 'Welcome to the test clinic' });
  }
  await ContactMessage.create({ name: 'QA Visitor', email: 'visitor@qa.example', subject: 'QA contact', message: 'Test support request' });
  const server = app.listen(5001, '127.0.0.1');
  const shutdown = async () => { server.close(); await mongoose.disconnect(); if (mongo) await mongo.stop(); process.exit(0); };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
}
main().catch((error) => { console.error(error); process.exit(1); });
