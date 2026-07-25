const express = require('express');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// ──────────────────────────────────────────────
// @route   POST /api/appointments
// @desc    Book a new appointment
// @access  Private (patient only)
// ──────────────────────────────────────────────
router.post('/', protect, authorize('patient'), async (req, res) => {
  try {
    const { doctorId, date, time, type, notes, symptoms } = req.body;

    // Verify doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Prevent booking when doctor is marked unavailable
    if (doctor.available === false) {
      return res.status(400).json({ success: false, message: 'Doctor is currently not available for booking' });
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
          patient: appt.patient?.name || 'Unknown Patient',
          age: 0, // would come from patient profile in real app
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
router.put('/:id/cancel', protect, async (req, res) => {
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
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
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

    appointment.status = status;
    await appointment.save();

    res.json({ success: true, appointment });
  } catch (error) {
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
