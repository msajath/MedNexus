const mongoose = require('mongoose');
const { normalizeTime, isValidDate, timeToMinutes } = require('../utils/slots');

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    date: {
      type: String,
      required: [true, 'Please provide an appointment date'],
      validate: isValidDate,
    },
    time: {
      type: String,
      required: [true, 'Please provide an appointment time'],
      set: normalizeTime,
      validate: (value) => timeToMinutes(value) !== null && timeToMinutes(value) % 30 === 0,
    },
    type: {
      type: String,
      enum: ['Consultation', 'Follow-up', 'Check-up', 'New Consultation', 'Lab Review', 'Annual Check-up', 'General Check-up'],
      default: 'Consultation',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
    notes: {
      type: String,
      default: '',
    },
    symptoms: {
      type: String,
      default: '',
    },
    // Snapshot the agreed consultation fee. Missing legacy values stay unknown.
    feeAtBooking: { type: Number, min: 0, max: 1000000 },
    rescheduleHistory: {
      type: [{
        _id: false,
        fromDate: String, fromTime: String, toDate: String, toTime: String,
        changedAt: { type: Date, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      }],
      default: [],
    },
    // Provisional records reserve the unique slot but never appear as bookings.
    bookingHold: {
      type: new mongoose.Schema({ token: String, expiresAt: Date }, { _id: false }),
      select: false,
    },
    // Preserve the original booking while a new date is checked against leave.
    rescheduleIntent: {
      type: new mongoose.Schema({ token: String, date: String, time: String, expiresAt: Date }, { _id: false }),
      select: false,
    },
  },
  { timestamps: true }
);

// Cancelled and completed appointments no longer reserve the slot.
appointmentSchema.index(
  { doctor: 1, date: 1, time: 1 },
  { unique: true, name: 'active_doctor_slot', partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
