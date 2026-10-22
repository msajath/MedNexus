const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Doctor = require('../../models/Doctor');
const DoctorLeave = require('../../models/DoctorLeave');
const Appointment = require('../../models/Appointment');
const Availability = require('../../models/Availability');
const { cleanExpiredBookingWork } = require('../../utils/bookingCoordination');
const assertTestDatabase = require('../helpers/testDatabase');

const app = express();
app.use(express.json());
app.use('/api/leaves', require('../../routes/leaveRoutes'));
app.use('/api/appointments', require('../../routes/appointmentRoutes'));
app.use('/api/availability', require('../../routes/availabilityRoutes'));
const withMongo = process.env.MONGO_TEST_URI ? describe : describe.skip;
const auth = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, version: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })}` });
const monday = (extraWeeks = 0) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 14 + (8 - date.getUTCDay()) % 7 + extraWeeks * 7);
  return date.toISOString().slice(0, 10);
};
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

withMongo('Doctor leave, booking coordination and audit history', () => {
  jest.setTimeout(30000);
  let patient, doctorUser, otherDoctorUser, admin, doctor;
  beforeAll(async () => {
    assertTestDatabase(process.env.MONGO_TEST_URI);
    await mongoose.connect(process.env.MONGO_TEST_URI, { autoIndex: false });
    await Promise.all([User.createIndexes(), Appointment.createIndexes(), Availability.createIndexes(), DoctorLeave.createIndexes()]);
  });
  beforeEach(async () => {
    for (const model of [Appointment, DoctorLeave, Availability, Doctor, User]) await model.deleteMany({});
    const create = (role, suffix = '') => User.create({ name: `QA ${role}${suffix}`, email: `leave-${role}${suffix}@example.test`, password: 'QA-password-123456', role, isVerified: true });
    [patient, doctorUser, otherDoctorUser, admin] = await Promise.all([create('patient'), create('doctor'), create('doctor', '2'), create('admin')]);
    doctor = await Doctor.create({ user: doctorUser._id, specialty: 'General Practice', fee: 125 });
    await Doctor.create({ user: otherDoctorUser._id, specialty: 'General Practice', fee: 50 });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => mongoose.disconnect());
  const apply = (date = monday()) => request(app).post('/api/leaves').set(auth(doctorUser)).send({ startDate: date, endDate: date, reason: 'Personal leave' });
  const review = (id, status = 'approved') => request(app).put(`/api/leaves/${id}/review`).set(auth(admin)).send({ status, adminNote: 'Reviewed by clinic' });
  const book = (date = monday(), time = '10:00 AM') => request(app).post('/api/appointments').set(auth(patient)).send({ doctorId: String(doctor._id), date, time, notes: 'Private consultation', symptoms: 'Private symptom' });

  test('only verified doctors apply, own pending requests can be cancelled, and reasons remain private', async () => {
    expect((await request(app).post('/api/leaves').set(auth(patient)).send({ startDate: monday(), endDate: monday(), reason: 'Test' })).status).toBe(403);
    doctorUser.isVerified = false; await doctorUser.save();
    expect((await apply()).status).toBe(403);
    doctorUser.isVerified = true; await doctorUser.save();
    const leave = await apply(); expect(leave.status).toBe(201);
    const id = leave.body.leave._id;
    expect((await request(app).get('/api/leaves/my').set(auth(doctorUser))).body.leaves).toHaveLength(1);
    expect((await request(app).get('/api/leaves/my').set(auth(otherDoctorUser))).body.leaves).toHaveLength(0);
    expect((await request(app).get('/api/leaves').set(auth(patient))).status).toBe(403);
    expect((await request(app).put(`/api/leaves/${id}/cancel`).set(auth(otherDoctorUser))).status).toBe(409);
    expect((await request(app).put(`/api/leaves/${id}/review`).set(auth(doctorUser)).send({ status: 'approved' })).status).toBe(403);
    expect((await request(app).put(`/api/leaves/${id}/cancel`).set(auth(doctorUser))).body.leave.status).toBe('cancelled');
    expect((await review(id)).status).toBe(409);
  });

  test('validates dates, reason length and overlapping requests before writes', async () => {
    for (const payload of [
      { startDate: '2020-01-01', endDate: '2020-01-01', reason: 'Test' },
      { startDate: monday(1), endDate: monday(), reason: 'Test' },
      { startDate: monday(), endDate: monday(60), reason: 'Test' },
      { startDate: monday(), endDate: monday(), reason: ' ' },
      { startDate: monday(), endDate: monday(), reason: 'a'.repeat(1001) },
      { startDate: '2030-02-30', endDate: '2030-03-01', reason: 'Test' },
    ]) expect((await request(app).post('/api/leaves').set(auth(doctorUser)).send(payload)).status).toBe(400);
    expect(await DoctorLeave.countDocuments()).toBe(0);
    expect((await apply()).status).toBe(201);
    expect((await apply()).status).toBe(409);
  });

  test('approval blocks slots, booking and rescheduling, while rejection releases the date', async () => {
    const original = await book(monday(1)); expect(original.status).toBe(201);
    const leave = (await apply()).body.leave;
    const approved = await review(leave._id); expect(approved.status).toBe(200);
    expect(approved.body.leave.reviewedBy).toBe(String(admin._id));
    expect(approved.body.leave.reviewToken).toBeUndefined();
    expect((await request(app).get(`/api/availability/slots/${doctor._id}/${monday()}`)).body).toMatchObject({ onLeave: true, slots: { morning: [], afternoon: [], evening: [] } });
    expect((await book()).status).toBe(409);
    expect((await request(app).put(`/api/appointments/${original.body.appointment._id}/reschedule`).set(auth(patient)).send({ date: monday(), time: '11:00 AM' })).status).toBe(409);
    expect((await Appointment.findById(original.body.appointment._id)).date).toBe(monday(1));
    expect((await request(app).get('/api/appointments/my').set(auth(patient))).body.count).toBe(1);
    expect((await request(app).get('/api/appointments/all').set(auth(admin))).body.count).toBe(1);
    const second = (await apply(monday(2))).body.leave;
    expect((await review(second._id, 'rejected')).status).toBe(200);
    expect((await book(monday(2))).status).toBe(201);
  });

  test('active bookings prevent approval without changing the appointment, then cancellation permits approval', async () => {
    const booking = await book(); expect(booking.status).toBe(201);
    const id = (await apply()).body.leave._id;
    const conflict = await review(id); expect(conflict.status).toBe(409);
    expect(conflict.body.conflicts).toEqual([{ id: booking.body.appointment._id, date: monday(), time: '10:00 AM' }]);
    expect(JSON.stringify(conflict.body)).not.toMatch(/Private consultation|Private symptom/);
    expect((await DoctorLeave.findById(id)).status).toBe('pending');
    expect((await Appointment.findById(booking.body.appointment._id)).status).toBe('pending');
    expect((await request(app).put(`/api/appointments/${booking.body.appointment._id}/cancel`).set(auth(patient))).status).toBe(200);
    expect((await review(id)).status).toBe(200);
  });

  test('admin conflict preview exposes scheduling details without clinical data or provisional identifiers and performs no writes', async () => {
    const booking = await book(); expect(booking.status).toBe(201);
    const held = await Appointment.create({ patient: patient._id, doctor: doctor._id, date: monday(), time: '11:00 AM', bookingHold: { token: 'secret-preview-token', expiresAt: new Date(Date.now() + 60000) } });
    const moving = await Appointment.create({ patient: patient._id, doctor: doctor._id, date: monday(1), time: '12:00 PM', rescheduleIntent: { token: 'secret-moving-token', date: monday(), time: '12:00 PM', expiresAt: new Date(Date.now() + 60000) } });
    const leave = (await apply()).body.leave;
    const endpoint = `/api/leaves/${leave._id}/conflicts`;
    expect((await request(app).get(endpoint).set(auth(patient))).status).toBe(403);
    expect((await request(app).get(endpoint).set(auth(doctorUser))).status).toBe(403);
    const preview = await request(app).get(endpoint).set(auth(admin));
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ conflictCount: 3, processingCount: 1, overlapLeaveCount: 0, doctor: { active: true, verified: true } });
    expect(preview.body.conflicts).toHaveLength(2);
    expect(preview.body.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: booking.body.appointment._id, date: monday(), time: '10:00 AM', status: 'pending', patientName: patient.name }),
      expect.objectContaining({ id: String(moving._id), date: monday(), time: '12:00 PM' }),
    ]));
    expect(JSON.stringify(preview.body)).not.toMatch(/Private consultation|Private symptom|secret-preview-token|secret-moving-token/);
    expect(JSON.stringify(preview.body)).not.toContain(String(held._id));
    expect((await Appointment.findById(held._id)).status).toBe('pending');
    expect((await DoctorLeave.findById(leave._id)).status).toBe('pending');
    expect((await Appointment.findById(moving._id)).date).toBe(monday(1));
  });

  test.each(['inactive', 'unverified', 'missing-profile'])('approval rechecks %s doctor eligibility while rejection remains available', async (condition) => {
    const leave = (await apply()).body.leave;
    if (condition === 'missing-profile') await Doctor.deleteOne({ _id: doctor._id });
    else await User.updateOne({ _id: doctorUser._id }, { [condition === 'inactive' ? 'isActive' : 'isVerified']: false });
    const preview = await request(app).get(`/api/leaves/${leave._id}/conflicts`).set(auth(admin));
    expect(preview.status).toBe(200);
    expect(preview.body.doctor).toMatchObject(condition === 'unverified' ? { active: true, verified: false } : { active: false });
    const denied = await review(leave._id);
    expect(denied.status).toBe(409);
    expect(denied.body.message).toMatch(/active, verified/);
    expect((await DoctorLeave.findById(leave._id)).status).toBe('pending');
    expect((await review(leave._id, 'rejected')).status).toBe(200);
  });

  test('preview ignores expired provisional work without writes, and final review cleans it before approving', async () => {
    const held = await Appointment.create({ patient: patient._id, doctor: doctor._id, date: monday(), time: '11:00 AM', bookingHold: { token: 'expired-preview-hold', expiresAt: new Date(Date.now() - 1000) } });
    const moving = await Appointment.create({ patient: patient._id, doctor: doctor._id, date: monday(1), time: '12:00 PM', rescheduleIntent: { token: 'expired-preview-intent', date: monday(), time: '12:00 PM', expiresAt: new Date(Date.now() - 1000) } });
    const leave = (await apply()).body.leave;
    const preview = await request(app).get(`/api/leaves/${leave._id}/conflicts`).set(auth(admin));
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ conflicts: [], conflictCount: 0, processingCount: 0 });
    expect((await Appointment.findById(held._id)).status).toBe('pending');
    expect((await Appointment.findById(moving._id).select('+rescheduleIntent')).rescheduleIntent).toBeDefined();
    expect((await review(leave._id)).status).toBe(200);
    expect((await Appointment.findById(held._id)).status).toBe('cancelled');
    const original = await Appointment.findById(moving._id).select('+rescheduleIntent');
    expect(original.date).toBe(monday(1));
    expect(original.rescheduleIntent).toBeUndefined();
  });

  test('an expired reschedule target does not hide or replace a current appointment conflict', async () => {
    const current = await Appointment.create({ patient: patient._id, doctor: doctor._id, date: monday(), time: '09:00 AM', rescheduleIntent: { token: 'expired-current-intent', date: monday(), time: '11:00 AM', expiresAt: new Date(Date.now() - 1000) } });
    const leave = (await apply()).body.leave;
    const preview = await request(app).get(`/api/leaves/${leave._id}/conflicts`).set(auth(admin));
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ conflictCount: 1, processingCount: 0 });
    expect(preview.body.conflicts[0]).toMatchObject({ id: String(current._id), date: monday(), time: '09:00 AM' });
    expect((await review(leave._id)).status).toBe(409);
  });

  test('booking holds fence approval even when booking read the leave state just before review', async () => {
    const leave = (await apply()).body.leave;
    const read = deferred(), release = deferred();
    const originalFind = DoctorLeave.findOne;
    let pause = true;
    jest.spyOn(DoctorLeave, 'findOne').mockImplementation(function (filter) {
      if (pause && !filter._id && filter.status?.$in?.includes('reviewing')) {
        pause = false;
        return (async () => { const value = await originalFind.call(this, filter); read.resolve(); await release.promise; return value; })();
      }
      return originalFind.call(this, filter);
    });
    const booking = book().then(r => r);
    await read.promise;
    const decision = await review(leave._id);
    expect(decision.status).toBe(409);
    expect(decision.body.conflicts).toEqual([]);
    release.resolve();
    expect((await booking).status).toBe(201);
    expect((await DoctorLeave.findById(leave._id)).status).toBe('pending');
  });

  test('review intent fences a booking that starts during approval', async () => {
    const leave = (await apply()).body.leave;
    const begun = deferred(), release = deferred();
    const originalUpdate = Appointment.updateMany;
    let pause = true;
    jest.spyOn(Appointment, 'updateMany').mockImplementation(function (...args) {
      if (pause) {
        pause = false;
        return (async () => { const value = await originalUpdate.apply(this, args); begun.resolve(); await release.promise; return value; })();
      }
      return originalUpdate.apply(this, args);
    });
    const approving = review(leave._id).then(r => r);
    await begun.promise;
    expect((await book()).status).toBe(409);
    release.resolve();
    expect((await approving).status).toBe(200);
    expect(await Appointment.countDocuments({ status: { $in: ['pending', 'confirmed'] }, bookingHold: { $exists: false } })).toBe(0);
  });

  test('reschedule intent fences approval and preserves the original fee with an audit trail', async () => {
    const booking = await book(monday(1)); expect(booking.status).toBe(201);
    await Doctor.updateOne({ _id: doctor._id }, { fee: 999 });
    const leave = (await apply()).body.leave;
    const read = deferred(), release = deferred();
    const originalFind = DoctorLeave.findOne;
    let pause = true;
    jest.spyOn(DoctorLeave, 'findOne').mockImplementation(function (filter) {
      if (pause && !filter._id && filter.status?.$in?.includes('reviewing')) {
        pause = false;
        return (async () => { const value = await originalFind.call(this, filter); read.resolve(); await release.promise; return value; })();
      }
      return originalFind.call(this, filter);
    });
    const moved = request(app).put(`/api/appointments/${booking.body.appointment._id}/reschedule`).set(auth(patient)).send({ date: monday(), time: '11:00 AM' }).then(r => r);
    await read.promise;
    expect((await review(leave._id)).status).toBe(409);
    release.resolve();
    expect((await moved).status).toBe(200);
    const stored = await Appointment.findById(booking.body.appointment._id);
    expect(stored.feeAtBooking).toBe(125);
    expect(stored.rescheduleHistory).toHaveLength(1);
    expect(stored.rescheduleHistory[0]).toMatchObject({ fromDate: monday(1), toDate: monday(), fromTime: '10:00 AM', toTime: '11:00 AM' });
    expect(await Appointment.countDocuments({ bookingHold: { $exists: false } })).toBe(1);
  });

  test('expiry cleanup hides abandoned holds and removes intents without losing an original booking', async () => {
    const expiresAt = new Date(Date.now() - 1000);
    const hold = await Appointment.create({ patient: patient._id, doctor: doctor._id, date: monday(), time: '10:00 AM', bookingHold: { token: 'expired-hold', expiresAt } });
    const original = await Appointment.create({ patient: patient._id, doctor: doctor._id, date: monday(1), time: '11:00 AM', rescheduleIntent: { token: 'expired-intent', date: monday(), time: '11:00 AM', expiresAt } });
    await cleanExpiredBookingWork(doctor._id);
    const abandoned = await Appointment.findById(hold._id).select('+bookingHold');
    expect(abandoned.status).toBe('cancelled');
    expect(abandoned.bookingHold.token).toBe('expired-hold');
    const unchanged = await Appointment.findById(original._id).select('+rescheduleIntent');
    expect(unchanged.date).toBe(monday(1));
    expect(unchanged.rescheduleIntent).toBeUndefined();
    expect((await request(app).get('/api/appointments/my').set(auth(patient))).body.count).toBe(1);
    expect((await review((await apply()).body.leave._id)).status).toBe(200);
  });

  test('expired reschedule finalization cannot move the original booking', async () => {
    const booking = await book(monday(1)); expect(booking.status).toBe(201);
    const originalFind = DoctorLeave.findOne;
    jest.spyOn(DoctorLeave, 'findOne').mockImplementation(function (filter) {
      return (async () => {
        const value = await originalFind.call(this, filter);
        await Appointment.updateOne({ _id: booking.body.appointment._id }, { $set: { 'rescheduleIntent.expiresAt': new Date(Date.now() - 1000) } });
        return value;
      })();
    });
    const result = await request(app).put(`/api/appointments/${booking.body.appointment._id}/reschedule`).set(auth(patient)).send({ date: monday(), time: '11:00 AM' });
    expect(result.status).toBe(409);
    const unchanged = await Appointment.findById(booking.body.appointment._id).select('+rescheduleIntent');
    expect(unchanged.date).toBe(monday(1));
    expect(unchanged.rescheduleHistory).toHaveLength(0);
    expect(unchanged.rescheduleIntent).toBeUndefined();
  });

  test('an expired provisional booking cannot activate after its leave check', async () => {
    const originalFind = DoctorLeave.findOne;
    jest.spyOn(DoctorLeave, 'findOne').mockImplementation(function (filter) {
      return (async () => {
        const value = await originalFind.call(this, filter);
        await Appointment.updateMany({ doctor: doctor._id, 'bookingHold.token': { $exists: true } }, { $set: { 'bookingHold.expiresAt': new Date(Date.now() - 1000) } });
        return value;
      })();
    });
    expect((await book()).status).toBe(409);
    expect((await request(app).get('/api/appointments/my').set(auth(patient))).body.count).toBe(0);
    expect(await Appointment.countDocuments({ status: 'pending' })).toBe(0);
  });

  test('a superseded review cannot approve after an administrator rejects it', async () => {
    const leave = (await apply()).body.leave;
    const begun = deferred(), release = deferred();
    const originalUpdate = Appointment.updateMany;
    let pause = true;
    jest.spyOn(Appointment, 'updateMany').mockImplementation(function (...args) {
      if (pause) {
        pause = false;
        return (async () => { const value = await originalUpdate.apply(this, args); begun.resolve(); await release.promise; return value; })();
      }
      return originalUpdate.apply(this, args);
    });
    const approving = review(leave._id).then(r => r);
    await begun.promise;
    expect((await review(leave._id, 'rejected')).status).toBe(200);
    release.resolve();
    expect((await approving).status).toBe(409);
    expect((await DoctorLeave.findById(leave._id)).status).toBe('rejected');
    expect((await book()).status).toBe(201);
  });

  test('an intent expiring between cleanup and the conflict query still prevents approval', async () => {
    const original = await Appointment.create({ patient: patient._id, doctor: doctor._id, date: monday(1), time: '10:00 AM', rescheduleIntent: { token: 'expiry-boundary', date: monday(), time: '11:00 AM', expiresAt: new Date(Date.now() + 60000) } });
    const leave = (await apply()).body.leave;
    const originalUpdate = Appointment.updateMany;
    jest.spyOn(Appointment, 'updateMany').mockImplementation(function (...args) {
      if (args[0]['rescheduleIntent.expiresAt']) {
        return (async () => {
          const value = await originalUpdate.apply(this, args);
          await Appointment.updateOne({ _id: original._id }, { $set: { 'rescheduleIntent.expiresAt': new Date(Date.now() - 1000) } });
          return value;
        })();
      }
      return originalUpdate.apply(this, args);
    });
    const decision = await review(leave._id);
    expect(decision.status).toBe(409);
    expect(decision.body.conflicts).toEqual([{ id: String(original._id), date: monday(), time: '11:00 AM' }]);
    expect((await DoctorLeave.findById(leave._id)).status).toBe('pending');
  });

  test.each(['booking', 'reschedule'])('MongoDB deadline prevents delayed %s finalization after expiry', async (kind) => {
    let original;
    if (kind === 'reschedule') original = (await book(monday(1))).body.appointment;
    const originalUpdate = Appointment.findOneAndUpdate;
    const path = kind === 'booking' ? 'bookingHold' : 'rescheduleIntent';
    jest.spyOn(Appointment, 'findOneAndUpdate').mockImplementation(function (...args) {
      const filter = args[0];
      if (filter.$expr || filter[`${path}.expiresAt`]) {
        return (async () => {
          // Shorten the published work's lifetime, then delay execution after
          // the request already constructed its final compare-and-set filter.
          await Appointment.updateOne({ _id: filter._id }, { $set: { [`${path}.expiresAt`]: new Date(Date.now() + 40) } });
          await new Promise(resolve => setTimeout(resolve, 70));
          return originalUpdate.apply(this, args);
        })();
      }
      return originalUpdate.apply(this, args);
    });
    const result = kind === 'booking' ? await book() : await request(app).put(`/api/appointments/${original._id}/reschedule`).set(auth(patient)).send({ date: monday(), time: '11:00 AM' });
    expect(result.status).toBe(409);
    if (kind === 'reschedule') {
      const unchanged = await Appointment.findById(original._id);
      expect(unchanged.date).toBe(monday(1));
      expect(unchanged.rescheduleHistory).toHaveLength(0);
    } else expect(await Appointment.countDocuments({ bookingHold: { $exists: false } })).toBe(0);
  });
});
