const { query, check, doctorRules } = require('../middleware/validateInput');
const errorHandler = require('../middleware/errorHandler');
const express = require('express');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

const getFallbackAvatar = (doctor) => {
  const key = doctor.user?.email || doctor.user?.name || String(doctor._id);
  const hash = [...key].reduce((total, character) => total + character.charCodeAt(0), 0);
  return `/images/doc${(hash % 15) + 1}.png`;
};

// ──────────────────────────────────────────────
// @route   GET /api/doctors
// @desc    Get all doctors (with search & filter)
// @access  Public
// ──────────────────────────────────────────────
router.get('/', [query('search').optional().isString().bail().isLength({ max: 120 }), query('specialty').optional().isString().bail().isLength({ max: 120 }), query('available').optional().isIn(['true', 'false'])], check, async (req, res) => {
  try {
    const { search, specialty, available } = req.query;
    let query = {};

    // Filter by specialty
    if (specialty && specialty !== 'All Specialties') {
      query.specialty = specialty;
    }

    // Filter by availability
    if (available !== undefined) {
      query.available = available === 'true';
    }

    // 1. First find all verified doctor user IDs
    const verifiedUsers = await User.find({ role: 'doctor', isVerified: true, isActive: { $ne: false } }).select('_id');
    const verifiedUserIds = verifiedUsers.map(u => u._id);

    // 2. Add to query
    query.user = { $in: verifiedUserIds };

    let doctors = await Doctor.find(query).populate('user', 'name email avatar isVerified');
    doctors = doctors.filter((doc) => doc.user && doc.user.isVerified);

    // Search by doctor name
    if (search) {
      const searchLower = search.toLowerCase();
      doctors = doctors.filter(
        (doc) =>
          doc.user.name.toLowerCase().includes(searchLower) ||
          doc.specialty.toLowerCase().includes(searchLower) ||
          doc.location?.toLowerCase().includes(searchLower)
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
      avatar: doc.user.avatar || getFallbackAvatar(doc),
    }));

    res.json({ success: true, count: formatted.length, doctors: formatted });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
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
    const verifiedUsers = await User.find({ role: 'doctor', isVerified: true, isActive: { $ne: false } }).select('_id');
    const specialties = await Doctor.distinct('specialty', { user: { $in: verifiedUsers.map((user) => user._id) } });
    res.json({ success: true, specialties: ['All Specialties', ...specialties] });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/doctors/platform-stats
// @desc    Get real platform statistics (verified doctors, patients, specialties)
// @access  Public
// ──────────────────────────────────────────────
router.get('/platform-stats', async (req, res) => {
  try {
    const verifiedUsers = await User.find({ role: 'doctor', isVerified: true, isActive: { $ne: false } }).select('_id');
    const verifiedUserIds = verifiedUsers.map((user) => user._id);

    const [verifiedDoctors, happyPatients, distinctSpecialties] = await Promise.all([
      Doctor.countDocuments({ user: { $in: verifiedUserIds } }),
      User.countDocuments({ role: 'patient', isActive: { $ne: false } }),
      Doctor.distinct('specialty', { user: { $in: verifiedUserIds } }),
    ]);

    const cleanSpecialties = distinctSpecialties.filter(Boolean);
    const specialtiesCount = Math.max(cleanSpecialties.length, cleanSpecialties.length > 0 ? cleanSpecialties.length : 6);

    res.json({
      success: true,
      stats: {
        verifiedDoctors,
        happyPatients,
        specialties: specialtiesCount,
      },
    });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   PUT /api/doctors/profile
// @desc    Update own doctor profile
// @access  Private (doctor only)
// ──────────────────────────────────────────────
router.put('/profile', protect, authorize('doctor'), doctorRules, check, async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    // Fee cannot be modified by doctor (only by administrator)
    const allowedFields = ['specialty', 'experience', 'location', 'languages', 'bio', 'available', 'education', 'experienceHistory', 'bankDetails'];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        doctor[field] = req.body[field];
      }
    });

    await doctor.save();

    res.json({ success: true, doctor });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/doctors/:id
// @desc    Get single doctor profile
// @access  Public
// ──────────────────────────────────────────────
router.get('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate('user', 'name email avatar isVerified isActive');

    if (!doctor || !doctor.user || doctor.user.isVerified !== true || doctor.user.isActive === false) {
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
        avatar: doctor.user.avatar || getFallbackAvatar(doctor),
      },
    });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

module.exports = router;
