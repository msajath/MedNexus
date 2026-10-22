const crypto = require('crypto');
const express = require('express');
const DoctorLeave = require('../models/DoctorLeave');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { protect, authorize } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const errorHandler = require('../middleware/errorHandler');
const { body, text, check } = require('../middleware/validateInput');
const { isValidDate, clinicDate } = require('../utils/slots');
const { activeStatuses, cleanExpiredBookingWork } = require('../utils/bookingCoordination');

const router = express.Router();
router.use(protect);
const populateDoctor = (query) => query.populate({ path: 'doctor', select: 'user specialty', populate: { path: 'user', select: 'name email' } });
const conflictFilter = (leave) => ({ doctor: leave.doctor, status: { $in: activeStatuses }, $or: [
  { date: { $gte: leave.startDate, $lte: leave.endDate } },
  // Count every remaining intent: one can expire after cleanup but before
  // this query. Activation also checks its deadline on MongoDB's clock.
  { 'rescheduleIntent.date': { $gte: leave.startDate, $lte: leave.endDate } },
] });
const overlapFilter = (leave) => ({ _id: { $ne: leave._id }, doctor: leave.doctor, status: { $in: ['approved', 'reviewing'] }, startDate: { $lte: leave.endDate }, endDate: { $gte: leave.startDate } });
const previewConflictFilter = (leave) => ({ doctor: leave.doctor, status: { $in: activeStatuses }, $and: [
  { $or: [{ bookingHold: { $exists: false } }, { $expr: { $gt: ['$bookingHold.expiresAt', '$$NOW'] } }] },
  { $or: [
    { date: { $gte: leave.startDate, $lte: leave.endDate } },
    { 'rescheduleIntent.date': { $gte: leave.startDate, $lte: leave.endDate }, $expr: { $gt: ['$rescheduleIntent.expiresAt', '$$NOW'] } },
  ] },
] });
const conflictDate = (appt, leave, liveIntentOnly = false) => {
  const intent = appt.rescheduleIntent;
  const targetOverlaps = intent && intent.date >= leave.startDate && intent.date <= leave.endDate && (!liveIntentOnly || intent.expiresAt > new Date());
  return { id: appt._id, date: targetOverlaps ? intent.date : appt.date, time: targetOverlaps ? intent.time : appt.time };
};
const ownDoctor = async (req, res) => {
  if (!req.user.isVerified || req.user.isActive === false) {
    res.status(403).json({ success: false, message: 'An active, verified doctor account is required' });
    return null;
  }
  const doctor = await Doctor.findOne({ user: req.user._id });
  if (!doctor) res.status(404).json({ success: false, message: 'Doctor profile not found' });
  return doctor;
};

router.get('/my', authorize('doctor'), async (req, res) => {
  try {
    const doctor = await ownDoctor(req, res);
    if (!doctor) return;
    const leaves = await DoctorLeave.find({ doctor: doctor._id }).sort({ createdAt: -1 });
    res.json({ success: true, leaves, clinicDate: clinicDate() });
  } catch (error) { return errorHandler(error, req, res, () => {}); }
});

router.post('/', authorize('doctor'), [body('startDate').custom(isValidDate), body('endDate').custom(isValidDate), text('reason', 1000, false)], check, async (req, res) => {
  try {
    const doctor = await ownDoctor(req, res);
    if (!doctor) return;
    const { startDate, endDate, reason } = req.body;
    const duration = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 + 1;
    if (startDate < clinicDate() || duration < 1 || duration > 366) {
      return res.status(400).json({ success: false, message: 'Choose current or future dates, in order, covering at most 366 days' });
    }
    const overlap = await DoctorLeave.findOne({ doctor: doctor._id, status: { $in: ['pending', 'reviewing', 'approved'] }, startDate: { $lte: endDate }, endDate: { $gte: startDate } });
    if (overlap) return res.status(409).json({ success: false, message: 'An existing leave request overlaps these dates' });
    const leave = await DoctorLeave.create({ doctor: doctor._id, startDate, endDate, reason });
    res.status(201).json({ success: true, leave });
  } catch (error) { return errorHandler(error, req, res, () => {}); }
});

router.put('/:id/cancel', authorize('doctor'), validateObjectId('id'), async (req, res) => {
  try {
    const doctor = await ownDoctor(req, res);
    if (!doctor) return;
    const leave = await DoctorLeave.findOneAndUpdate({ _id: req.params.id, doctor: doctor._id, status: 'pending' }, { $set: { status: 'cancelled' } }, { new: true, runValidators: true });
    if (!leave) return res.status(409).json({ success: false, message: 'Only your own pending leave requests can be cancelled' });
    res.json({ success: true, leave });
  } catch (error) { return errorHandler(error, req, res, () => {}); }
});

router.get('/', authorize('admin'), async (req, res) => {
  try {
    if (req.query.status && !['pending', 'reviewing', 'approved', 'rejected', 'cancelled'].includes(req.query.status)) {
      return res.status(400).json({ success: false, message: 'Invalid leave status' });
    }
    const filter = req.query.status ? { status: req.query.status === 'pending' ? { $in: ['pending', 'reviewing'] } : req.query.status } : {};
    const leaves = await populateDoctor(DoctorLeave.find(filter).sort({ createdAt: -1 }));
    res.json({ success: true, leaves });
  } catch (error) { return errorHandler(error, req, res, () => {}); }
});

// Administrative preview is read-only. The review endpoint repeats every check
// after publishing its review intent; preview is never an approval guarantee.
router.get('/:id/conflicts', authorize('admin'), validateObjectId('id'), async (req, res) => {
  try {
    const leave = await DoctorLeave.findById(req.params.id);
    if (!leave) return res.status(404).json({ success: false, message: 'Leave request not found' });
    const filter = previewConflictFilter(leave);
    const [appointments, conflictCount, processingCount, overlapLeaveCount, doctor] = await Promise.all([
      Appointment.find({ ...filter, bookingHold: { $exists: false } }).select('_id date time status patient +rescheduleIntent').populate('patient', 'name').limit(100),
      Appointment.countDocuments(filter),
      Appointment.countDocuments({ ...filter, bookingHold: { $exists: true } }),
      DoctorLeave.countDocuments(overlapFilter(leave)),
      Doctor.findById(leave.doctor).populate('user', 'isActive isVerified'),
    ]);
    res.json({ success: true, conflicts: appointments.map((appt) => ({ ...conflictDate(appt, leave, true), status: appt.status, patientName: appt.patient?.name || 'Unknown patient' })),
      conflictCount, processingCount, overlapLeaveCount, doctor: { active: Boolean(doctor?.user && doctor.user.isActive !== false), verified: Boolean(doctor?.user?.isVerified) } });
  } catch (error) { return errorHandler(error, req, res, () => {}); }
});

router.put('/:id/review', authorize('admin'), validateObjectId('id'), [body('status').isIn(['approved', 'rejected']), text('adminNote', 1000)], check, async (req, res) => {
  let token;
  try {
    const initial = await DoctorLeave.findById(req.params.id);
    if (!initial) return res.status(404).json({ success: false, message: 'Leave request not found' });
    if (!['pending', 'reviewing'].includes(initial.status)) return res.status(409).json({ success: false, message: 'This leave request has already been processed' });
    token = crypto.randomUUID();
    const reviewing = await DoctorLeave.findOneAndUpdate({ _id: initial._id, status: { $in: ['pending', 'reviewing'] } }, { $set: { status: 'reviewing', reviewToken: token } }, { new: true });
    if (!reviewing) return res.status(409).json({ success: false, message: 'Leave request changed. Refresh and retry.' });

    if (req.body.status === 'approved') {
      const doctor = await Doctor.findById(reviewing.doctor).populate('user', 'isActive isVerified');
      if (!doctor?.user || doctor.user.isActive === false || doctor.user.isVerified !== true) {
        await DoctorLeave.updateOne({ _id: reviewing._id, status: 'reviewing', reviewToken: token }, { $set: { status: 'pending' }, $unset: { reviewToken: '' } });
        return res.status(409).json({ success: false, message: 'Only an active, verified doctor can have leave approved' });
      }
      await cleanExpiredBookingWork(reviewing.doctor);
      const overlap = await DoctorLeave.findOne(overlapFilter(reviewing));
      const conflicts = await Appointment.find(conflictFilter(reviewing)).select('_id date time +bookingHold +rescheduleIntent').limit(100);
      if (overlap || conflicts.length) {
        await DoctorLeave.updateOne({ _id: reviewing._id, status: 'reviewing', reviewToken: token }, { $set: { status: 'pending' }, $unset: { reviewToken: '' } });
        const visibleConflicts = conflicts.filter((appt) => !appt.bookingHold).map((appt) => conflictDate(appt, reviewing));
        return res.status(409).json({ success: false, message: overlap ? 'Another approved or reviewing leave overlaps these dates' : 'Active appointments or bookings being processed overlap these dates. Move or cancel appointments, or retry shortly.', conflicts: visibleConflicts });
      }
    }
    const leave = await populateDoctor(DoctorLeave.findOneAndUpdate({ _id: reviewing._id, status: 'reviewing', reviewToken: token }, { $set: { status: req.body.status, adminNote: req.body.adminNote || '', reviewedBy: req.user._id, reviewedAt: new Date() }, $unset: { reviewToken: '' } }, { new: true, runValidators: true }));
    if (!leave) return res.status(409).json({ success: false, message: 'Leave request changed. Refresh and retry.' });
    // findOneAndUpdate bypasses select:false on some Mongoose return paths.
    const result = leave.toObject();
    delete result.reviewToken;
    res.json({ success: true, leave: result });
  } catch (error) {
    // Keep an interrupted review blocked. An admin can explicitly resume/reject it.
    return errorHandler(error, req, res, () => {});
  }
});

module.exports = router;
