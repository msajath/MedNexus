const mongoose = require('mongoose');

// A manual receipt records money an administrator verified as already received.
// This model never stores card numbers, bank credentials or gateway secrets.
const paymentSchema = new mongoose.Schema({
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amountMinor: { type: Number, required: true, min: 1, max: 100000000, validate: Number.isSafeInteger },
  currency: { type: String, enum: ['USD'], required: true },
  method: { type: String, enum: ['cash', 'bank_transfer', 'card', 'other'], required: true },
  reference: { type: String, default: '', maxlength: 120 },
  status: { type: String, enum: ['received', 'refunded'], default: 'received', required: true },
  receivedAt: { type: Date, required: true },
  recordedAt: { type: Date, required: true, default: Date.now },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  refundedAt: Date,
  refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  refundReason: { type: String, maxlength: 1000 },
}, { timestamps: true });

paymentSchema.index({ appointment: 1 }, {
  unique: true, name: 'one_received_payment_per_appointment', partialFilterExpression: { status: 'received' },
});
paymentSchema.index({ doctor: 1, recordedAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
