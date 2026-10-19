const errorHandler = require('../middleware/errorHandler');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { limiter, accountLimiter } = require('../middleware/security');
const { password: passwordRule, text, doctorRules, profileRules } = require('../middleware/validateInput');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const { protect } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

const router = express.Router();

const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

const normalizeEmail = (email) => email.trim().toLowerCase();

// Helper: Generate JWT
const generateToken = (user) => {
  return jwt.sign({ id: user._id, version: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
    algorithm: 'HS256',
  });
};

// ──────────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register a new user (patient or doctor)
// @access  Public
// ──────────────────────────────────────────────
router.post(
  '/register',
  limiter(20, 60 * 60 * 1000),
  [
    text('name', 120, false),
    text('phone', 40),
    ...doctorRules,
    body('email').isString().bail().trim().isLength({ max: 254 }).isEmail().withMessage('Please provide a valid email'),
    passwordRule('password'),
    body('role').optional().isIn(['patient', 'doctor']).withMessage('Role must be patient or doctor'),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array().map(({ msg, path }) => ({ msg, path })) });
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
          fee: req.body.fee ?? 100,
          licenseNumber: licenseNumber || '',
          location: req.body.location || '',
        });
      }

      // Generate token
      const token = generateToken(user);
      res.cookie('mednexus_session', token, sessionCookieOptions);

      res.status(201).json({
        success: true,
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
      return errorHandler(error, req, res, () => {});
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
  limiter(30),
  accountLimiter(10, { skipSuccessfulRequests: true }),
  [
    body('email').isString().bail().trim().isLength({ max: 254 }).isEmail().withMessage('Please provide a valid email'),
    body('password').isString().bail().isLength({ min: 1, max: 72 }).withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array().map(({ msg, path }) => ({ msg, path })) });
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
      res.cookie('mednexus_session', token, sessionCookieOptions);

      // If doctor, fetch doctor-specific info
      let doctorInfo = null;
      if (user.role === 'doctor') {
        doctorInfo = await Doctor.findOne({ user: user._id });
      }

      res.json({
        success: true,
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
      return errorHandler(error, req, res, () => {});
    }
  }
);

router.post('/logout', protect, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  } catch (error) { return errorHandler(error, req, res, () => {}); }
  res.clearCookie('mednexus_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.json({ success: true });
});

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
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
// ──────────────────────────────────────────────
router.put('/profile', protect, [...profileRules, body('email').optional().trim().isEmail().withMessage('Please provide a valid email')], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array().map(({ msg, path }) => ({ msg, path })) });
    }
    const { name, phone, email, dob, gender, bloodType, address, avatar, specialty, fee, experience, location, bio } = req.body;

    const user = await User.findById(req.user._id);
    const normalizedEmail = email ? normalizeEmail(email) : null;
    const emailChanged = normalizedEmail && normalizedEmail !== user.email;
    if (emailChanged) {
      if (typeof req.body.currentPassword !== 'string' || Buffer.byteLength(req.body.currentPassword) > 72) {
        return res.status(401).json({ success: false, message: 'Confirm your current password to change email' });
      }
      const credentialUser = await User.findById(req.user._id).select('+password');
      if (!await credentialUser.matchPassword(req.body.currentPassword)) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      user.resetPasswordToken = null;
      user.resetPasswordExpire = null;
    }
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (emailChanged) {
      const emailExists = await User.findOne({ email: normalizedEmail });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email is already in use by another account' });
      }
      user.email = normalizedEmail;
    }
    if (dob !== undefined) user.dob = dob;
    if (gender !== undefined) user.gender = gender;
    if (bloodType !== undefined) user.bloodType = bloodType;
    if (address !== undefined) user.address = address;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();
    if (emailChanged) res.cookie('mednexus_session', generateToken(user), sessionCookieOptions);

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
    return errorHandler(error, req, res, () => {});
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
  limiter(10),
  [
    body('currentPassword').isString().bail().isLength({ min: 1, max: 72 }).withMessage('Current password is required'),
    passwordRule('newPassword'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array().map(({ msg, path }) => ({ msg, path })) });
      }

      const user = await User.findById(req.user._id).select('+password');
      const isMatch = await user.matchPassword(req.body.currentPassword);

      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }

      user.password = req.body.newPassword;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      user.resetPasswordToken = null;
      user.resetPasswordExpire = null;
      await user.save();
      res.cookie('mednexus_session', generateToken(user), sessionCookieOptions);

      // If doctor, mark credentials changed
      if (user.role === 'doctor') {
        await Doctor.findOneAndUpdate({ user: user._id }, { credentialsChanged: true });
      }

      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      return errorHandler(error, req, res, () => {});
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
  limiter(20, 60 * 60 * 1000),
  accountLimiter(5),
  [body('email').isString().bail().trim().isLength({ max: 254 }).isEmail().withMessage('Please provide a valid email')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array().map(({ msg, path }) => ({ msg, path })) });
      }

      const email = normalizeEmail(req.body.email);

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
          'This code expires in 5 minutes.',
          '',
          'If you did not request this change, please contact support immediately.',
        ].join('\n'),
        html: `
          <p>Hello,</p>
          <p>We received a request to reset your password.</p>
          <p><strong>Your reset code is:</strong> <code>${resetCode}</code></p>
          <p>This code expires in 5 minutes.</p>
          <p>If you did not request this change, please contact support immediately.</p>
        `,
      });

      res.json({
        success: true,
        message: 'If an account exists for that email, a reset code has been sent',
      });
    } catch (error) {
      console.error('Password reset request failed:', error.name || 'Error');
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
  limiter(20, 60 * 60 * 1000),
  accountLimiter(5),
  [
    body('email').isString().bail().trim().isLength({ max: 254 }).isEmail().withMessage('Please provide a valid email'),
    body('resetCode').isString().bail().matches(/^\d{6}$/).withMessage('A six-digit reset code is required'),
    passwordRule('newPassword'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array().map(({ msg, path }) => ({ msg, path })) });
      }

      const { resetCode, newPassword } = req.body;
      const email = normalizeEmail(req.body.email);
      // Hash the provided code to compare with stored hash
      const hashedCode = crypto.createHash('sha256').update(resetCode).digest('hex');

      const passwordHash = await bcrypt.hash(newPassword, 12);
      const user = await User.findOneAndUpdate({
        email, isActive: { $ne: false }, resetPasswordToken: hashedCode,
        resetPasswordExpire: { $gt: Date.now() },
      }, {
        $set: { password: passwordHash, resetPasswordToken: null, resetPasswordExpire: null },
        $inc: { tokenVersion: 1 },
      }, { new: true });
      if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired reset code' });

      if (user.role === 'doctor') {
        await Doctor.findOneAndUpdate({ user: user._id }, { credentialsChanged: true });
      }

      res.json({ success: true, message: 'Password reset successfully. You can now log in with your new password.' });
    } catch (error) {
      return errorHandler(error, req, res, () => {});
    }
  }
);

module.exports = router;
