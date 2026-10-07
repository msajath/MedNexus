const mongoose = require('mongoose');

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
    },
    time: {
      type: String,
      required: [true, 'Please provide an appointment time'],
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
  },
  { timestamps: true }
);

// Cancelled and completed appointments no longer reserve the slot.
appointmentSchema.index(
  { doctor: 1, date: 1, time: 1 },
  { unique: true, name: 'active_doctor_slot', partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
