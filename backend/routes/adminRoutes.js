const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Availability = require('../models/Availability');
const MedicalRecord = require('../models/MedicalRecord');
const Message = require('../models/Message');
const ContactMessage = require('../models/ContactMessage');
const { protect, authorize } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

// All admin routes require admin role
router.use(protect, authorize('admin'));

// ──────────────────────────────────────────────
// @route   GET /api/admin/stats
// @desc    Get platform-wide statistics
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const active = { isActive: { $ne: false } };
    const totalUsers = await User.countDocuments(active);
    const totalDoctors = await User.countDocuments({ ...active, role: 'doctor' });
    const totalPatients = await User.countDocuments({ ...active, role: 'patient' });
    const totalAppointments = await Appointment.countDocuments();
    const monthlyAppointments = await Appointment.countDocuments({
      createdAt: { $gte: new Date(new Date().setDate(1)) }, // from 1st of current month
    });
    const pendingApprovals = await User.countDocuments({ ...active, role: 'doctor', isVerified: false });

    // Calculate revenue (sum of all confirmed appointment fees)
    const confirmedAppointments = await Appointment.find({ status: 'confirmed' }).populate('doctor');
    const revenue = confirmedAppointments.reduce((sum, appt) => sum + (appt.doctor?.fee || 0), 0);

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers.toLocaleString(),
        totalDoctors: totalDoctors.toLocaleString(),
        totalPatients: totalPatients.toLocaleString(),
        totalAppointments: totalAppointments.toLocaleString(),
        monthlyAppointments: monthlyAppointments.toLocaleString(),
        pendingApprovals: pendingApprovals.toString(),
        revenue: `$${revenue.toLocaleString()}`,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { role } = req.query;
    let query = { isActive: { $ne: false } };
    if (role) query.role = role;

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   PUT /api/admin/verify-doctor/:userId
// @desc    Verify/approve a doctor account
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.put('/verify-doctor/:userId', validateObjectId('userId'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'doctor' || user.isActive === false) {
      return res.status(400).json({ success: false, message: 'User is not a doctor' });
    }

    user.isVerified = true;
    await user.save();

    res.json({ success: true, message: `Dr. ${user.name} has been verified`, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   POST /api/admin/doctors
// @desc    Add a new doctor to the system
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.post('/doctors', async (req, res) => {
  try {
    const { name, specialty, fee } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Name and valid email are required' });
    }

    // 1. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // 2. Create User document
    const user = await User.create({
      name,
      email,
      // The doctor sets their own password through the reset flow.
      password: crypto.randomBytes(32).toString('hex'),
      role: 'doctor',
      isVerified: true // Pre-verified since admin is adding them
    });

    // 3. Create Doctor profile
    const doctor = await Doctor.create({
      user: user._id,
      specialty: specialty || 'General Practice',
      fee: fee || 100,
    });

    // 4. Create default Availability
    const defaultAvailability = [
      { day: 'Monday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Tuesday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Wednesday', enabled: true, start: '10:00', end: '16:00' },
      { day: 'Thursday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Friday', enabled: true, start: '09:00', end: '14:00' },
      { day: 'Saturday', enabled: false, start: '00:00', end: '00:00' },
      { day: 'Sunday', enabled: false, start: '00:00', end: '00:00' },
    ];
    
    await Availability.create({
      doctor: doctor._id,
      schedule: defaultAvailability
    });

    res.status(201).json({
      success: true,
      message: 'Doctor added. Ask them to set a password using Forgot Password.',
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      doctor: { id: doctor._id, specialty: doctor.specialty },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/admin/doctors-detail
// @desc    Get all doctors with full detail including credentials
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/doctors-detail', async (req, res) => {
  try {
    const doctors = await Doctor.find()
      .populate('user', 'name email phone avatar isVerified isActive createdAt');

    const result = doctors.filter(doc => doc.user && doc.user.isActive !== false).map(doc => ({
      _id: doc._id,
      userId: doc.user?._id,
      name: doc.user?.name,
      email: doc.user?.email,
      phone: doc.user?.phone,
      avatar: doc.user?.avatar,
      isVerified: doc.user?.isVerified,
      joinedDate: doc.user?.createdAt,
      specialty: doc.specialty,
      fee: doc.fee,
      experience: doc.experience,
      location: doc.location,
      bio: doc.bio,
      rating: doc.rating,
      reviews: doc.reviews,
      available: doc.available,
      credentialsChanged: doc.credentialsChanged,
    }));

    res.json({ success: true, count: result.length, doctors: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/admin/doctors/:userId
// @desc    Get a doctor's profile, earnings, appointments, and patients
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/doctors/:userId', validateObjectId('userId'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.params.userId })
      .populate('user', 'name email phone avatar isVerified createdAt');

    if (!doctor || !doctor.user) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const appointments = await Appointment.find({ doctor: doctor._id })
      .populate('patient', 'name email phone avatar createdAt')
      .sort({ date: -1, time: -1 });

    const earningAppointments = appointments.filter((appointment) =>
      ['confirmed', 'completed'].includes(appointment.status)
    );
    const patients = [...new Map(
      appointments
        .filter((appointment) => appointment.patient)
        .map((appointment) => [String(appointment.patient._id), appointment.patient])
    ).values()];

    res.json({
      success: true,
      doctor: {
        id: doctor._id,
        userId: doctor.user._id,
        name: doctor.user.name,
        email: doctor.user.email,
        phone: doctor.user.phone,
        avatar: doctor.user.avatar,
        isVerified: doctor.user.isVerified,
        joinedDate: doctor.user.createdAt,
        specialty: doctor.specialty,
        fee: doctor.fee,
        experience: doctor.experience,
        location: doctor.location,
        bio: doctor.bio,
        rating: doctor.rating,
        reviews: doctor.reviews,
        available: doctor.available,
        totalAppointments: appointments.length,
        completedAppointments: appointments.filter((appointment) => appointment.status === 'completed').length,
        totalPatients: patients.length,
        earnings: earningAppointments.length * doctor.fee,
        patients,
        appointments,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   DELETE /api/admin/users/:userId
// @desc    Delete a user account
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.delete('/users/:userId', validateObjectId('userId'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin accounts cannot be deactivated here' });
    }
    if (user.isActive === false) {
      return res.json({ success: true, message: 'Account already deactivated' });
    }

    user.isActive = false;
    await user.save();

    if (user.role === 'doctor') {
      const doctor = await Doctor.findOne({ user: user._id });
      if (doctor) {
        doctor.available = false;
        await doctor.save();
      }
    }

    res.json({ success: true, message: `Account for ${user.name} deactivated; clinical history retained` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/admin/recent-activity
// @desc    Get recent platform activity
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/recent-activity', async (req, res) => {
  try {
    // Fetch recent appointments
    const recentAppointments = await Appointment.find()
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name' } })
      .populate('patient', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Fetch recently registered users
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5);

    // Build activity feed
    const activity = [];

    recentAppointments.forEach((appt) => {
      activity.push({
        id: appt._id,
        type: 'booking',
        message: `${appt.patient?.name || 'A patient'} booked with ${appt.doctor?.user?.name || 'a doctor'}`,
        time: appt.createdAt,
        icon: 'calendar_today',
      });
    });

    recentUsers.forEach((user) => {
      activity.push({
        id: user._id,
        type: 'registration',
        message: `${user.name} registered as ${user.role}`,
        time: user.createdAt,
        icon: 'person_add',
      });
    });

    // Sort by time descending
    activity.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({ success: true, activity: activity.slice(0, 10) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Contact form inbox for administrators
router.get('/contact-messages', async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json({ success: true, count: messages.length, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/contact-messages/:id/status', validateObjectId('id'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid contact message status' });
    }

    const message = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!message) return res.status(404).json({ success: false, message: 'Contact message not found' });
    return res.json({ success: true, message });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/admin/appointments
// @desc    Get all appointments with full patient/doctor info
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email avatar' } })
      .populate('patient', 'name email phone avatar')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: appointments.length, appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   PUT /api/admin/appointments/:id/status
// @desc    Admin update appointment status
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.put('/appointments/:id/status', validateObjectId('id'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    res.json({ success: true, appointment });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This time slot is already booked' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/admin/records
// @desc    Get all medical records (admin view)
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/records', async (req, res) => {
  try {
    const records = await MedicalRecord.find()
      .populate('patient', 'name email')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 });
    res.json({ success: true, count: records.length, records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
