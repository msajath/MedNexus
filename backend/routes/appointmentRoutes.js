const errorHandler = require('../middleware/errorHandler');
const express = require('express');
const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Availability = require('../models/Availability');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

const { defaultSchedule, normalizeTime, isFutureSlot, isWithinSchedule, allowedTransitions } = require('../utils/slots');
const { body, text, check } = require('../middleware/validateInput');
const { activeStatuses, holdDurationMs, realAppointmentFilter, cleanExpiredBookingWork, blockingLeave } = require('../utils/bookingCoordination');
const { serializeAdminAppointment, adminAppointmentSelection } = require('../utils/adminAppointments');
const { withAppointmentPayments } = require('../utils/payments');
const cancellableStatuses = new Set(['pending', 'confirmed']);

router.post('/', protect, authorize('patient'), validateObjectId('doctorId', { source: 'body' }), [body('date').isString(), body('time').isString(), body('type').optional().isIn(['Consultation', 'Follow-up', 'Check-up', 'New Consultation', 'Lab Review', 'Annual Check-up', 'General Check-up']), text('notes', 5000), text('symptoms', 5000)], check, async (req, res) => {
  let hold;
  let token;
  try {
    const { doctorId, date, type, notes, symptoms } = req.body;
    const time = normalizeTime(req.body.time);

    // Verify doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }
    const doctorUser = await User.findById(doctor.user);
    if (!doctorUser || doctorUser.isActive === false || doctorUser.isVerified !== true || doctor.available === false) {
      return res.status(404).json({ success: false, message: 'Doctor is unavailable' });
    }

    const availability = await Availability.findOne({ doctor: doctorId });
    if (!isWithinSchedule(date, time, availability?.schedule || defaultSchedule)) {
      return res.status(400).json({ success: false, message: 'The selected time is outside the doctor\'s availability' });
    }
    if (!isFutureSlot(date, time)) {
      return res.status(400).json({ success: false, message: 'Choose a future appointment time' });
    }

    await cleanExpiredBookingWork(doctorId);
    // The unique index is the final arbiter when requests race.
    const existingAppt = await Appointment.findOne({
      doctor: doctorId,
      date,
      time,
      status: { $in: ['pending', 'confirmed'] },
    });

    if (existingAppt) {
      return res.status(400).json({ success: false, message: 'This time slot is already booked' });
    }

    token = crypto.randomUUID();
    hold = await Appointment.create({
      patient: req.user._id,
      doctor: doctorId,
      date,
      time,
      type: type || 'Consultation',
      notes: notes || '',
      symptoms: symptoms || '',
      feeAtBooking: doctor.fee,
      bookingHold: { token, expiresAt: new Date(Date.now() + holdDurationMs) },
    });

    // Publish intent before checking leave, so a simultaneous approval sees it.
    if (await blockingLeave(doctorId, date)) {
      await Appointment.updateOne({ _id: hold._id, 'bookingHold.token': token }, { $set: { status: 'cancelled' } });
      return res.status(409).json({ success: false, message: 'Doctor is on leave or leave is being reviewed on this date. Choose another date.' });
    }
    const appointment = await Appointment.findOneAndUpdate({ _id: hold._id, status: 'pending', 'bookingHold.token': token, $expr: { $gt: ['$bookingHold.expiresAt', '$$NOW'] } },
      { $unset: { bookingHold: '' } }, { new: true });
    if (!appointment) {
      await Appointment.updateOne({ _id: hold._id, 'bookingHold.token': token }, { $set: { status: 'cancelled' } });
      return res.status(409).json({ success: false, message: 'Booking timed out. Refresh availability and try again.' });
    }

    // Populate and return
    const populated = await Appointment.findById(appointment._id)
      .populate({
        path: 'doctor',
        populate: { path: 'user', select: 'name email' },
      })
      .populate('patient', 'name email');

    res.status(201).json({ success: true, appointment: populated });
  } catch (error) {
    if (hold && token) await Appointment.updateOne({ _id: hold._id, 'bookingHold.token': token }, { $set: { status: 'cancelled' } }).catch(() => {});
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This time slot is already booked' });
    }
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/appointments/my
// @desc    Get current user's appointments (patient)
// @access  Private
// ──────────────────────────────────────────────
router.get('/my', protect, authorize('patient', 'doctor'), async (req, res) => {
  try {
    let appointments;

    if (req.user.role === 'patient') {
      appointments = await Appointment.find({ patient: req.user._id, ...realAppointmentFilter })
        .populate({
          path: 'doctor',
          populate: { path: 'user', select: 'name email' },
        })
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ user: req.user._id });
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor profile not found' });
      }
      appointments = await Appointment.find({ doctor: doctor._id, ...realAppointmentFilter })
        .populate('patient', 'name email phone')
        .sort({ createdAt: -1 });
    }

    // Map to frontend-compatible format
    const formatted = appointments.map((appt) => {
      if (req.user.role === 'patient') {
        return {
          _id: appt._id,
          id: appt._id,
          doctor: {
            _id: appt.doctor?._id,
            name: appt.doctor?.user?.name || 'Unknown Doctor',
            specialty: appt.doctor?.specialty || '',
          },
          doctorId: appt.doctor?._id,
          date: appt.date,
          time: appt.time,
          status: appt.status,
          type: appt.type,
          notes: appt.notes,
          feeAtBooking: appt.feeAtBooking,
          rescheduleHistory: appt.rescheduleHistory,
        };
      } else {
        return {
          id: appt._id,
          patient: {
            _id: appt.patient?._id,
            name: appt.patient?.name || 'Unknown Patient',
            email: appt.patient?.email,
            phone: appt.patient?.phone,
          },
          date: appt.date,
          time: appt.time,
          status: appt.status,
          type: appt.type,
          notes: appt.notes,
          feeAtBooking: appt.feeAtBooking,
          rescheduleHistory: appt.rescheduleHistory,
        };
      }
    });

    res.json({ success: true, count: formatted.length, appointments: formatted });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   PUT /api/appointments/:id/cancel
// @desc    Cancel an appointment (patient shortcut)
// @access  Private
// ──────────────────────────────────────────────
router.put('/:id/reschedule', protect, authorize('patient'), validateObjectId('id'),
  [body('date').isString(), body('time').isString()], check, async (req, res) => {
    let intentToken;
    try {
      const appointment = await Appointment.findOne({ _id: req.params.id, ...realAppointmentFilter });
      if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
      if (String(appointment.patient) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Not authorized' });
      if (!cancellableStatuses.has(appointment.status)) return res.status(409).json({ success: false, message: 'Only pending or confirmed appointments can be rescheduled' });
      const { date } = req.body;
      const time = normalizeTime(req.body.time);
      const doctor = await Doctor.findById(appointment.doctor);
      const doctorUser = doctor && await User.findById(doctor.user);
      if (!doctorUser || doctorUser.isActive === false || doctorUser.isVerified !== true || doctor.available === false) {
        return res.status(404).json({ success: false, message: 'Doctor is unavailable' });
      }
      const availability = await Availability.findOne({ doctor: doctor._id });
      if (!isFutureSlot(date, time) || !isWithinSchedule(date, time, availability?.schedule || defaultSchedule)) {
        return res.status(400).json({ success: false, message: 'Choose a future time within the doctor\'s availability' });
      }
      if (appointment.date === date && appointment.time === time) return res.json({ success: true, appointment });
      await cleanExpiredBookingWork(doctor._id);
      intentToken = crypto.randomUUID();
      const reserved = await Appointment.findOneAndUpdate({
        _id: appointment._id, patient: req.user._id, status: appointment.status,
        date: appointment.date, time: appointment.time, ...realAppointmentFilter,
        rescheduleIntent: { $exists: false },
      }, { $set: { rescheduleIntent: { token: intentToken, date, time, expiresAt: new Date(Date.now() + holdDurationMs) } } }, { new: true });
      if (!reserved) return res.status(409).json({ success: false, message: 'Appointment changed or is being rescheduled. Refresh and retry.' });
      if (await blockingLeave(doctor._id, date)) {
        await Appointment.updateOne({ _id: appointment._id, 'rescheduleIntent.token': intentToken }, { $unset: { rescheduleIntent: '' } });
        return res.status(409).json({ success: false, message: 'Doctor is on leave or leave is being reviewed on this date. Choose another date.' });
      }
      const updated = await Appointment.findOneAndUpdate({
        _id: appointment._id, patient: req.user._id, status: appointment.status,
        date: appointment.date, time: appointment.time, ...realAppointmentFilter,
        'rescheduleIntent.token': intentToken, $expr: { $gt: ['$rescheduleIntent.expiresAt', '$$NOW'] },
      }, { $set: { date, time, status: 'pending' }, $unset: { rescheduleIntent: '' },
        $push: { rescheduleHistory: { fromDate: appointment.date, fromTime: appointment.time, toDate: date, toTime: time, changedAt: new Date(), changedBy: req.user._id } },
      }, { new: true, runValidators: true });
      if (!updated) return res.status(409).json({ success: false, message: 'Appointment changed. Refresh and retry.' });
      res.json({ success: true, appointment: updated });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ success: false, message: 'This time slot is already booked' });
      return errorHandler(error, req, res, () => {});
    } finally {
      if (intentToken) await Appointment.updateOne({ _id: req.params.id, 'rescheduleIntent.token': intentToken }, { $unset: { rescheduleIntent: '' } }).catch(() => {});
    }
  });

router.put('/:id/cancel', protect, validateObjectId('id'), async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ _id: req.params.id, ...realAppointmentFilter });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const isPatient = appointment.patient.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isPatient && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (!cancellableStatuses.has(appointment.status)) {
      return res.status(409).json({ success: false, message: 'Only pending or confirmed appointments can be cancelled' });
    }

    const updated = await Appointment.findOneAndUpdate({ _id: appointment._id, status: appointment.status, ...realAppointmentFilter }, { $set: { status: 'cancelled' }, $unset: { rescheduleIntent: '' } }, { new: true, runValidators: true });
    if (!updated) return res.status(409).json({ success: false, message: 'Appointment changed. Refresh and retry.' });
    res.json({ success: true, appointment: isAdmin ? (await withAppointmentPayments([serializeAdminAppointment(updated)]))[0] : updated });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   PUT /api/appointments/:id/status
// @desc    Update appointment status (confirm/cancel)
// @access  Private
// ──────────────────────────────────────────────
router.put('/:id/status', protect, validateObjectId('id'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!['confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    if (req.user.role === 'patient' && status !== 'cancelled') {
      return res.status(403).json({ success: false, message: 'Patients may only cancel their appointments' });
    }

    const appointment = await Appointment.findOne({ _id: req.params.id, ...realAppointmentFilter });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Verify the user owns this appointment (patient or doctor)
    const doctor = await Doctor.findOne({ user: req.user._id });
    const isPatient = appointment.patient.toString() === req.user._id.toString();
    const isDoctor = doctor && appointment.doctor.toString() === doctor._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this appointment' });
    }

    if (!allowedTransitions[appointment.status]?.includes(status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot change an appointment from ${appointment.status} to ${status}`,
      });
    }

    const updated = await Appointment.findOneAndUpdate({ _id: appointment._id, status: appointment.status, ...realAppointmentFilter }, { $set: { status }, $unset: { rescheduleIntent: '' } }, { new: true, runValidators: true });
    if (!updated) return res.status(409).json({ success: false, message: 'Appointment changed. Refresh and retry.' });

    if (status === 'completed') {
      try {
        const existingPayment = await Payment.findOne({ appointment: updated._id, status: 'received' });
        if (!existingPayment) {
          const doc = await Doctor.findById(updated.doctor);
          const fee = (typeof updated.feeAtBooking === 'number' && updated.feeAtBooking >= 0)
            ? updated.feeAtBooking
            : (doc?.fee ?? 100);
          const amountMinor = Math.round(fee * 100);
          if (amountMinor > 0) {
            await Payment.create({
              appointment: updated._id,
              doctor: updated.doctor,
              patient: updated.patient,
              amountMinor,
              currency: 'USD',
              method: 'auto_credit',
              reference: `AUTO-${String(updated._id).slice(-8).toUpperCase()}`,
              status: 'received',
              receivedAt: new Date(),
              recordedAt: new Date(),
              recordedBy: req.user._id,
            });
          }
        }
      } catch (paymentErr) {
        console.error('Error auto-crediting completed appointment payment:', paymentErr);
      }
    }

    res.json({ success: true, appointment: isAdmin ? (await withAppointmentPayments([serializeAdminAppointment(updated)]))[0] : updated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This time slot is already booked' });
    }
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/appointments/all
// @desc    Get all appointments (admin only)
// @access  Private (admin)
// ──────────────────────────────────────────────
router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    const appointments = await Appointment.find(realAppointmentFilter)
      .select(adminAppointmentSelection)
      .populate({
        path: 'doctor',
        populate: { path: 'user', select: 'name email' },
      })
      .populate('patient', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: appointments.length, appointments: await withAppointmentPayments(appointments.map(serializeAdminAppointment)) });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

module.exports = router;
