const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const { protect } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

const router = express.Router();

// Simple in-memory rate limiter for sensitive endpoints (forgot-password)
// Keeps a sliding window counter per key (email or ip). This is intentionally
// lightweight so it works without extra dependencies. For production, prefer
// a distributed store (Redis) and a battle-tested package (express-rate-limit).
const rateLimitStore = new Map();
const RATE_LIMITS = {
  perEmail: { windowMs: 60 * 60 * 1000, max: 5 }, // 5 per email per hour
  perIP: { windowMs: 60 * 60 * 1000, max: 20 }, // 20 per IP per hour
  resetPerEmail: { windowMs: 60 * 60 * 1000, max: 5 },
  resetPerIP: { windowMs: 60 * 60 * 1000, max: 20 },
};

const normalizeEmail = (email) => email.trim().toLowerCase();

function isRateLimited(key, { windowMs, max }) {
  const now = Date.now();
  const entry = rateLimitStore.get(key) || { count: 0, firstAt: now };

  // Reset window if expired
  if (now - entry.firstAt > windowMs) {
    entry.count = 0;
    entry.firstAt = now;
  }

  entry.count += 1;
  rateLimitStore.set(key, entry);

  return entry.count > max;
}

// Helper: Generate JWT
const generateToken = (user) => {
  return jwt.sign({ id: user._id, version: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// ──────────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register a new user (patient or doctor)
// @access  Public
// ──────────────────────────────────────────────
router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').trim().isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['patient', 'doctor']).withMessage('Role must be patient or doctor'),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { name, password, role, phone, licenseNumber } = req.body;
      const email = normalizeEmail(req.body.email);

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'User already exists with this email' });
      }

      // Create user
      const user = await User.create({
        name,
        email,
        password,
        role: role || 'patient',
        phone: phone || '',
      });

      // If registering as doctor, also create a Doctor profile
      if (role === 'doctor') {
        await Doctor.create({
          user: user._id,
          specialty: req.body.specialty || 'General Practice',
          fee: req.body.fee || 100,
          licenseNumber: licenseNumber || '',
          location: req.body.location || '',
        });
      }

      // Generate token
      const token = generateToken(user);

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      });
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.email) {
        return res.status(400).json({ success: false, message: 'User already exists with this email' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ──────────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Login user & return JWT
// @access  Public
// ──────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { password } = req.body;
      const email = normalizeEmail(req.body.email);

      // Find user and include password field
      const user = await User.findOne({ email }).select('+password');
      if (!user || user.isActive === false) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      // Check password
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      // Generate token
      const token = generateToken(user);

      // If doctor, fetch doctor-specific info
      let doctorInfo = null;
      if (user.role === 'doctor') {
        doctorInfo = await Doctor.findOne({ user: user._id });
      }

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          ...(doctorInfo && { specialty: doctorInfo.specialty }),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ──────────────────────────────────────────────
// @route   GET /api/auth/me
// @desc    Get current logged-in user's profile
// @access  Private
// ──────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    let doctorProfile = null;
    if (user.role === 'doctor') {
      doctorProfile = await Doctor.findOne({ user: user._id });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        dob: user.dob,
        gender: user.gender,
        bloodType: user.bloodType,
        address: user.address,
        avatar: user.avatar,
        createdAt: user.createdAt,
        ...(doctorProfile && { doctorProfile }),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
// ──────────────────────────────────────────────
router.put('/profile', protect, [body('email').optional().trim().isEmail().withMessage('Please provide a valid email')], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { name, phone, email, dob, gender, bloodType, address, avatar, specialty, fee, experience, location, bio } = req.body;

    const user = await User.findById(req.user._id);
    const normalizedEmail = email ? normalizeEmail(email) : null;
    const emailChanged = normalizedEmail && normalizedEmail !== user.email;
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (emailChanged) {
      const emailExists = await User.findOne({ email: normalizedEmail });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email is already in use by another account' });
      }
      user.email = normalizedEmail;
    }
    if (dob) user.dob = dob;
    if (gender) user.gender = gender;
    if (bloodType) user.bloodType = bloodType;
    if (address) user.address = address;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    // If user is a doctor, update Doctor profile
    let doctorProfile = null;
    if (user.role === 'doctor') {
      doctorProfile = await Doctor.findOne({ user: user._id });
      if (doctorProfile) {
        if (specialty !== undefined) doctorProfile.specialty = specialty;
        if (fee !== undefined) doctorProfile.fee = fee;
        if (experience !== undefined) doctorProfile.experience = experience;
        if (location !== undefined) doctorProfile.location = location;
        if (bio !== undefined) doctorProfile.bio = bio;
        // If email changed by doctor, mark credentials as changed
        if (emailChanged) doctorProfile.credentialsChanged = true;
        await doctorProfile.save();
      }
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        dob: user.dob,
        gender: user.gender,
        bloodType: user.bloodType,
        address: user.address,
        avatar: user.avatar,
        ...(doctorProfile && { doctorProfile })
      },
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(400).json({ success: false, message: 'Email is already in use by another account' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   PUT /api/auth/password
// @desc    Change user password
// @access  Private
// ──────────────────────────────────────────────
router.put(
  '/password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const user = await User.findById(req.user._id).select('+password');
      const isMatch = await user.matchPassword(req.body.currentPassword);

      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }

      user.password = req.body.newPassword;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      // If doctor, mark credentials changed
      if (user.role === 'doctor') {
        await Doctor.findOneAndUpdate({ user: user._id }, { credentialsChanged: true });
      }

      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ──────────────────────────────────────────────
// @route   POST /api/auth/forgot-password
// @desc    Generate a temporary password and email it to the registered address
// @access  Public
// ──────────────────────────────────────────────
router.post(
  '/forgot-password',
  [body('email').trim().isEmail().withMessage('Please provide a valid email')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      // rate-limit by email and by IP to prevent abuse
      const email = normalizeEmail(req.body.email);
      const emailKey = `forgot:${email}`;
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const ipKey = `forgot:${ip}`;

      if (isRateLimited(emailKey, RATE_LIMITS.perEmail)) {
        return res.status(429).json({ success: false, message: 'Too many password reset requests for this email. Try again later.' });
      }

      if (isRateLimited(ipKey, RATE_LIMITS.perIP)) {
        return res.status(429).json({ success: false, message: 'Too many requests from this IP address. Try again later.' });
      }

      if (process.env.NODE_ENV === 'production' && !(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)) {
        return res.status(503).json({ success: false, message: 'Password reset email is unavailable' });
      }

      const user = await User.findOne({ email, isActive: { $ne: false } });
      if (!user) {
        return res.json({
          success: true,
          message: 'If an account exists for that email, a reset code has been sent',
        });
      }

      const resetCode = user.generateResetToken();
      await user.save();

      await sendMail({
        to: user.email,
        subject: 'Your MEDNEXUS password reset code',
        text: [
          `Hello ${user.name},`,
          '',
          'We received a request to reset your password.',
          `Your reset code is: ${resetCode}`,
          '',
          'This code expires in 30 minutes.',
          '',
          'If you did not request this change, please contact support immediately.',
        ].join('\n'),
        html: `
          <p>Hello ${user.name},</p>
          <p>We received a request to reset your password.</p>
          <p><strong>Your reset code is:</strong> <code>${resetCode}</code></p>
          <p>This code expires in 30 minutes.</p>
          <p>If you did not request this change, please contact support immediately.</p>
        `,
      });

      res.json({
        success: true,
        message: 'If an account exists for that email, a reset code has been sent',
      });
    } catch (error) {
      console.error('Password reset request failed:', error.message);
      res.status(503).json({ success: false, message: 'Password reset email is unavailable' });
    }
  }
);

// ──────────────────────────────────────────────
// @route   POST /api/auth/reset-password
// @desc    Reset password using OTP code
// @access  Public
// ──────────────────────────────────────────────
router.post(
  '/reset-password',
  [
    body('email').trim().isEmail().withMessage('Please provide a valid email'),
    body('resetCode').notEmpty().withMessage('Reset code is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { resetCode, newPassword } = req.body;
      const email = normalizeEmail(req.body.email);
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      if (isRateLimited(`reset-email:${email}`, RATE_LIMITS.resetPerEmail) ||
          isRateLimited(`reset-ip:${ip}`, RATE_LIMITS.resetPerIP)) {
        return res.status(429).json({ success: false, message: 'Too many reset attempts. Try again later.' });
      }

      // Hash the provided code to compare with stored hash
      const hashedCode = crypto.createHash('sha256').update(resetCode).digest('hex');

      const user = await User.findOne({
        email,
        isActive: { $ne: false },
        resetPasswordToken: hashedCode,
        resetPasswordExpire: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset code' });
      }

      // Set new password
      user.password = newPassword;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      user.resetPasswordToken = null;
      user.resetPasswordExpire = null;
      await user.save();

      if (user.role === 'doctor') {
        await Doctor.findOneAndUpdate({ user: user._id }, { credentialsChanged: true });
      }

      res.json({ success: true, message: 'Password reset successfully. You can now log in with your new password.' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

module.exports = router;
