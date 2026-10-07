const express = require('express');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Availability = require('../models/Availability');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const cancellableStatuses = new Set(['pending', 'confirmed']);
const allowedTransitions = {
  pending: new Set(['confirmed', 'cancelled']),
  confirmed: new Set(['completed', 'cancelled']),
  cancelled: new Set(),
  completed: new Set(),
};

const timeToMinutes = (time) => {
  if (typeof time !== 'string') return null;
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12 || Number(match[2]) > 59) return null;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + Number(match[2]);
};

const isFutureSlot = (date, time) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: process.env.CLINIC_TIME_ZONE || 'Asia/Colombo',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  return date > today || (date === today && timeToMinutes(time) > Number(parts.hour) * 60 + Number(parts.minute));
};

const isWithinSchedule = (date, time, schedule) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const dateValue = new Date(year, month - 1, day);
  if (dateValue.getFullYear() !== year || dateValue.getMonth() !== month - 1 || dateValue.getDate() !== day) return false;

  const daySchedule = schedule.find((item) => item.day === dayNames[dateValue.getDay()]);
  const appointmentMinutes = timeToMinutes(time);
  if (!daySchedule?.enabled || appointmentMinutes === null) return false;

  const [startHours, startMinutes] = daySchedule.start.split(':').map(Number);
  const [endHours, endMinutes] = daySchedule.end.split(':').map(Number);
  return appointmentMinutes >= startHours * 60 + startMinutes &&
    appointmentMinutes + 30 <= endHours * 60 + endMinutes && appointmentMinutes % 30 === 0;
};

// ──────────────────────────────────────────────
// @route   POST /api/appointments
// @desc    Book a new appointment
// @access  Private (patient only)
// ──────────────────────────────────────────────
router.post('/', protect, authorize('patient'), validateObjectId('doctorId', { source: 'body' }), async (req, res) => {
  try {
    const { doctorId, date, time, type, notes, symptoms } = req.body;

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
    const defaultSchedule = [
      { day: 'Monday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Tuesday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Wednesday', enabled: true, start: '10:00', end: '16:00' },
      { day: 'Thursday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Friday', enabled: true, start: '09:00', end: '14:00' },
      { day: 'Saturday', enabled: false, start: '00:00', end: '00:00' },
      { day: 'Sunday', enabled: false, start: '00:00', end: '00:00' },
    ];
    if (!isWithinSchedule(date, time, availability?.schedule || defaultSchedule)) {
      return res.status(400).json({ success: false, message: 'The selected time is outside the doctor\'s availability' });
    }
    if (!isFutureSlot(date, time)) {
      return res.status(400).json({ success: false, message: 'Choose a future appointment time' });
    }

    // Check if slot is already booked
    const existingAppt = await Appointment.findOne({
      doctor: doctorId,
      date,
      time,
      status: { $in: ['pending', 'confirmed'] },
    });

    if (existingAppt) {
      return res.status(400).json({ success: false, message: 'This time slot is already booked' });
    }

    const appointment = await Appointment.create({
      patient: req.user._id,
      doctor: doctorId,
      date,
      time,
      type: type || 'Consultation',
      notes: notes || '',
      symptoms: symptoms || '',
    });

    // Populate and return
    const populated = await Appointment.findById(appointment._id)
      .populate({
        path: 'doctor',
        populate: { path: 'user', select: 'name email' },
      })
      .populate('patient', 'name email');

    res.status(201).json({ success: true, appointment: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This time slot is already booked' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/appointments/my
// @desc    Get current user's appointments (patient)
// @access  Private
// ──────────────────────────────────────────────
router.get('/my', protect, async (req, res) => {
  try {
    let appointments;

    if (req.user.role === 'patient') {
      appointments = await Appointment.find({ patient: req.user._id })
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
      appointments = await Appointment.find({ doctor: doctor._id })
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
        };
      }
    });

    res.json({ success: true, count: formatted.length, appointments: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   PUT /api/appointments/:id/cancel
// @desc    Cancel an appointment (patient shortcut)
// @access  Private
// ──────────────────────────────────────────────
router.put('/:id/cancel', protect, validateObjectId('id'), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
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

    appointment.status = 'cancelled';
    await appointment.save();
    res.json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    const appointment = await Appointment.findById(req.params.id);
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

    if (!allowedTransitions[appointment.status]?.has(status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot change an appointment from ${appointment.status} to ${status}`,
      });
    }

    appointment.status = status;
    await appointment.save();

    res.json({ success: true, appointment });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This time slot is already booked' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/appointments/all
// @desc    Get all appointments (admin only)
// @access  Private (admin)
// ──────────────────────────────────────────────
router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate({
        path: 'doctor',
        populate: { path: 'user', select: 'name email' },
      })
      .populate('patient', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: appointments.length, appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
