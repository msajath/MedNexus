// Disposable browser-test server; never reads the application's database URI.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'qa-only-secret-at-least-32-characters';
process.env.JWT_EXPIRE = '7d';
process.env.ALLOWED_ORIGINS = 'http://127.0.0.1:5174';
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const express = require('express');
const { createSmtpInbox } = require('../tests/helpers/smtpInbox');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Availability = require('../models/Availability');
const Message = require('../models/Message');
const ContactMessage = require('../models/ContactMessage');
const DoctorLeave = require('../models/DoctorLeave');
const Payment = require('../models/Payment');
const assertTestDatabase = require('../tests/helpers/testDatabase');

async function main() {
  const mongo = process.env.QA_MONGO_URI ? null : await MongoMemoryServer.create({ binary: { version: '7.0.14' }, instance: { dbName: 'mednexus_browser_qa' } });
  const uri = process.env.QA_MONGO_URI || mongo.getUri('mednexus_browser_qa');
  assertTestDatabase(uri);
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  await mongoose.connection.dropDatabase();
  await Promise.all([User.createIndexes(), Appointment.createIndexes(), Availability.createIndexes(), DoctorLeave.createIndexes(), Payment.createIndexes()]);
  const password = 'QA-password-123456';
  for (const role of ['patient', 'doctor', 'admin']) {
    const user = await User.create({ name: `QA ${role}`, email: `${role}@qa.example`, password, role, isVerified: true });
    if (role === 'doctor') await Doctor.create({ user: user._id, specialty: 'General Practice', fee: 125, bio: 'QA doctor profile' });
    await Message.create({ recipient: user._id, senderName: 'QA Clinic', subject: 'QA welcome', body: 'Welcome to the test clinic' });
  }
  await User.create({ name: 'QA inactive patient', email: 'inactive@qa.example', password, role: 'patient', isVerified: true, isActive: false });
  const operationsDoctor = await User.create({ name: 'QA operations doctor', email: 'operations-doctor@qa.example', password, role: 'doctor', isVerified: true });
  await Doctor.create({ user: operationsDoctor._id, specialty: 'General Practice', fee: 125, bio: 'Isolated operations QA doctor' });
  await ContactMessage.create({ name: 'QA Visitor', email: 'visitor@qa.example', subject: 'QA contact', message: 'Test support request' });
  const inbox = await createSmtpInbox();
  Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(inbox.port), SMTP_SECURE: 'false',
    SMTP_USER: 'qa-inbox', SMTP_PASS: 'qa-only-smtp-password', SMTP_FROM: 'qa-clinic@example.test' });
  const { app } = require('../server');
  const qaApp = express();
  // Mounted only by this loopback QA entry point, never in production server.js.
  qaApp.get('/__qa/mail', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const email = typeof req.query.email === 'string' ? req.query.email.toLowerCase() : '';
    res.json({ messages: inbox.messages.filter(message => message.to.includes(email)) });
  });
  qaApp.use(app);
  const server = qaApp.listen(5001, '127.0.0.1');
  const shutdown = async () => { server.close(); await inbox.close(); await mongoose.disconnect(); if (mongo) await mongo.stop(); process.exit(0); };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
}
main().catch((error) => { console.error(error); process.exit(1); });
