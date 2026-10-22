const mongoose = require('mongoose');
const { isValidDate } = require('../utils/slots');

const doctorLeaveSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  startDate: { type: String, required: true, validate: isValidDate },
  endDate: { type: String, required: true, validate: isValidDate },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'reviewing', 'approved', 'rejected', 'cancelled'], default: 'pending' },
  adminNote: { type: String, default: '', maxlength: 1000 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  // A fresh token fences off an interrupted or superseded review.
  reviewToken: { type: String, select: false },
}, { timestamps: true });

doctorLeaveSchema.index({ doctor: 1, status: 1, startDate: 1, endDate: 1 });
module.exports = mongoose.model('DoctorLeave', doctorLeaveSchema);
