const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false, // don't return password by default
    },
    role: {
      type: String,
      enum: ['patient', 'doctor', 'admin'],
      default: 'patient',
    },
    phone: {
      type: String,
      default: '',
    },
    dob: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      default: 'Other',
    },
    bloodType: {
      type: String,
      default: 'Unknown',
    },
    address: {
      type: String,
      default: '',
    },
    avatar: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: function () {
        return this.role === 'patient'; // patients auto-verified, doctors need approval
      },
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpire: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password reset token
userSchema.methods.generateResetToken = function () {
  // Generate a 6-digit OTP code
  const resetCode = crypto.randomInt(100000, 1000000).toString();

  // Hash the code and store it
  this.resetPasswordToken = crypto.createHash('sha256').update(resetCode).digest('hex');

  // Set expiry to 30 minutes
  this.resetPasswordExpire = Date.now() + 30 * 60 * 1000;

  return resetCode;
};

module.exports = mongoose.model('User', userSchema);
