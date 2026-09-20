const express = require('express');
const Availability = require('../models/Availability');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const defaultSchedule = [
  { day: 'Monday', enabled: true, start: '09:00', end: '17:00' },
  { day: 'Tuesday', enabled: true, start: '09:00', end: '17:00' },
  { day: 'Wednesday', enabled: true, start: '10:00', end: '16:00' },
  { day: 'Thursday', enabled: true, start: '09:00', end: '17:00' },
  { day: 'Friday', enabled: true, start: '09:00', end: '14:00' },
  { day: 'Saturday', enabled: false, start: '00:00', end: '00:00' },
  { day: 'Sunday', enabled: false, start: '00:00', end: '00:00' },
];

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const minutesPart = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${String(displayHours).padStart(2, '0')}:${String(minutesPart).padStart(2, '0')} ${period}`;
};

const getSlotsForSchedule = (schedule) => {
  const slots = { morning: [], afternoon: [], evening: [] };
  const start = timeToMinutes(schedule.start);
  const end = timeToMinutes(schedule.end);

  for (let minutes = start; minutes < end; minutes += 30) {
    const slot = minutesToTime(minutes);
    const period = minutes < 12 * 60 ? 'morning' : minutes < 16 * 60 ? 'afternoon' : 'evening';
    slots[period].push(slot);
  }

  return slots;
};

const getAllSlots = () => {
  const slots = { morning: [], afternoon: [], evening: [] };
  for (let minutes = 8 * 60; minutes < 20 * 60; minutes += 30) {
    const slot = minutesToTime(minutes);
    const period = minutes < 12 * 60 ? 'morning' : minutes < 16 * 60 ? 'afternoon' : 'evening';
    slots[period].push(slot);
  }
  return slots;
};

const subtractSlots = (allSlots, availableSlots) => Object.fromEntries(
  Object.entries(allSlots).map(([period, slots]) => [
    period,
    slots.filter((slot) => !availableSlots[period].includes(slot)),
  ])
);

const isValidDate = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const dateValue = new Date(year, month - 1, day);
  return dateValue.getFullYear() === year && dateValue.getMonth() === month - 1 && dateValue.getDate() === day;
};

// ──────────────────────────────────────────────
// @route   PUT /api/availability
// @desc    Set/update doctor's weekly availability
// @access  Private (doctor only)
// ──────────────────────────────────────────────
router.put('/', protect, authorize('doctor'), async (req, res) => {
  try {
    const { schedule } = req.body;

    if (!schedule || !Array.isArray(schedule)) {
      return res.status(400).json({ success: false, message: 'Schedule array is required' });
    }

    // Find the doctor profile for the current user
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    // Upsert availability
    let availability = await Availability.findOne({ doctor: doctor._id });

    if (availability) {
      availability.schedule = schedule;
      await availability.save();
    } else {
      availability = await Availability.create({
        doctor: doctor._id,
        schedule,
      });
    }

    res.json({ success: true, schedule: availability.schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/availability/slots/:doctorId/:date
// @desc    Get available time slots for a specific doctor on a date
// @access  Public
// NOTE: This route MUST be defined before /:doctorId to avoid
//       Express matching "slots" as a doctorId parameter.
// ──────────────────────────────────────────────
router.get('/slots/:doctorId/:date', async (req, res) => {
  try {
    const { doctorId, date } = req.params;

    if (!isValidDate(date)) {
      return res.status(400).json({ success: false, message: 'Date must be in YYYY-MM-DD format' });
    }

    // Determine day of week from date (use UTC-safe parsing for YYYY-MM-DD)
    const dateParts = date.split('-');
    const dateObj = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2])
    );
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    // Get doctor's availability
    const availability = await Availability.findOne({ doctor: doctorId });

    const schedule = availability?.schedule || defaultSchedule;
    const daySchedule = schedule.find((s) => s.day === dayOfWeek);
    const allSlots = getAllSlots();

    if (!daySchedule || !daySchedule.enabled) {
      return res.json({
        success: true,
        slots: { morning: [], afternoon: [], evening: [] },
        unavailableSlots: allSlots,
        bookedSlots: [],
      });
    }

    const availableSlots = getSlotsForSchedule(daySchedule);

    // Query existing appointments for this doctor on this date
    // that are not cancelled (i.e., pending or confirmed)
    const existingAppointments = await Appointment.find({
      doctor: doctorId,
      date: date,
      status: { $in: ['pending', 'confirmed'] },
    });

    // Collect already-booked time slots
    const bookedSlots = existingAppointments.map((appt) => appt.time);

    res.json({
      success: true,
      slots: availableSlots,
      unavailableSlots: subtractSlots(allSlots, availableSlots),
      bookedSlots,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/availability/:doctorId
// @desc    Get a doctor's weekly availability
// @access  Public
// ──────────────────────────────────────────────
router.get('/:doctorId', async (req, res) => {
  try {
    const availability = await Availability.findOne({ doctor: req.params.doctorId });

    if (!availability) {
      return res.json({ success: true, schedule: defaultSchedule });
    }

    res.json({ success: true, schedule: availability.schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
