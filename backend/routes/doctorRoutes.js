const express = require('express');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// ──────────────────────────────────────────────
// @route   GET /api/doctors
// @desc    Get all doctors (with search & filter)
// @access  Public
// ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, specialty, available } = req.query;
    let query = {};

    // Filter by specialty
    if (specialty && specialty !== 'All Specialties') {
      query.specialty = { $regex: specialty, $options: 'i' };
    }

    // Filter by availability
    if (available !== undefined) {
      query.available = available === 'true';
    }

    // 1. First find all verified doctor user IDs
    const verifiedUsers = await User.find({ role: 'doctor', isVerified: true }).select('_id');
    const verifiedUserIds = verifiedUsers.map(u => u._id);

    // 2. Add to query
    query.user = { $in: verifiedUserIds };

    let doctors = await Doctor.find(query).populate('user', 'name email avatar isVerified');

    // Search by doctor name
    if (search) {
      const searchLower = search.toLowerCase();
      doctors = doctors.filter(
        (doc) =>
          doc.user.name.toLowerCase().includes(searchLower) ||
          doc.specialty.toLowerCase().includes(searchLower)
      );
    }

    // Only return verified doctors to the public
    doctors = doctors.filter((doc) => doc.user && doc.user.isVerified);

    // Map to frontend-compatible format
    const formatted = doctors.map((doc) => ({
      id: doc._id,
      name: doc.user.name,
      email: doc.user.email,
      specialty: doc.specialty,
      fee: doc.fee,
      rating: doc.rating,
      reviews: doc.reviews,
      experience: doc.experience,
      location: doc.location,
      available: doc.available,
      languages: doc.languages,
      avatar: doc.user.avatar,
    }));

    res.json({ success: true, count: formatted.length, doctors: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/doctors/specialties/list
// @desc    Get all unique specialties
// @access  Public
// NOTE: This route MUST be defined before /:id to avoid
//       Express matching "specialties" as an id parameter.
// ──────────────────────────────────────────────
router.get('/specialties/list', async (req, res) => {
  try {
    const specialties = await Doctor.distinct('specialty');
    res.json({ success: true, specialties: ['All Specialties', ...specialties] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   PUT /api/doctors/profile
// @desc    Update own doctor profile
// @access  Private (doctor only)
// ──────────────────────────────────────────────
router.put('/profile', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    const allowedFields = ['specialty', 'fee', 'experience', 'location', 'languages', 'bio', 'available', 'education', 'experienceHistory'];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        doctor[field] = req.body[field];
      }
    });

    await doctor.save();

    res.json({ success: true, doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/doctors/:id
// @desc    Get single doctor profile
// @access  Public
// ──────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate('user', 'name email avatar');

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    res.json({
      success: true,
      doctor: {
        id: doctor._id,
        name: doctor.user.name,
        email: doctor.user.email,
        specialty: doctor.specialty,
        fee: doctor.fee,
        rating: doctor.rating,
        reviews: doctor.reviews,
        experience: doctor.experience,
        location: doctor.location,
        available: doctor.available,
        languages: doctor.languages,
        bio: doctor.bio,
        education: doctor.education,
        experienceHistory: doctor.experienceHistory,
        avatar: doctor.user.avatar,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
