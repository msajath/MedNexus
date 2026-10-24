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
      validate: value => /^\d+(?:\.\d{1,2})?$/.test(String(value)),
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'LKR'],
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
      enum: ['pending', 'completed', 'processing', 'failed', 'cancelled'],
      default: 'pending',
    },
    reference: {
      type: String,
      default: '',
      maxlength: 120,
    },
    // Populated only by a future verified provider callback, never by request input.
    providerTransferId: { type: String, maxlength: 200 },
    providerConfirmedAt: Date,
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
payoutSchema.index({ doctor: 1 }, { unique: true, name: 'one_active_payout_per_doctor',
  partialFilterExpression: { status: { $in: ['pending', 'processing'] } } });

module.exports = mongoose.model('Payout', payoutSchema);
