const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    doctorUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payout amount is required'],
      min: [0.01, 'Payout amount must be greater than 0'],
      max: [1000000, 'Payout amount exceeds maximum allowable limit'],
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD'],
    },
    bankDetails: {
      bankName: { type: String, required: true },
      accountNumber: { type: String, required: true },
      accountHolderName: { type: String, required: true },
      routingNumber: { type: String, default: '' },
      branch: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['completed', 'processing', 'failed'],
      default: 'completed',
    },
    reference: {
      type: String,
      default: '',
      maxlength: 120,
    },
    notes: {
      type: String,
      default: '',
      maxlength: 500,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

payoutSchema.index({ doctor: 1, processedAt: -1 });
payoutSchema.index({ doctorUser: 1 });

module.exports = mongoose.model('Payout', payoutSchema);
