const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    title: {
      type: String,
      required: [true, 'Please provide a record title'],
    },
    type: {
      type: String,
      enum: ['Prescription', 'Lab Report', 'Diagnosis', 'Vaccination', 'Imaging', 'Discharge Summary', 'Other'],
      default: 'Other',
    },
    description: {
      type: String,
      default: '',
    },
    diagnosis: {
      type: String,
      default: '',
    },
    medications: [
      {
        name: String,
        dosage: String,
        frequency: String,
        duration: String,
      },
    ],
    attachments: [
      {
        name: String,
        url: String,   // base64 or file path
        type: String,  // MIME type
      },
    ],
    date: {
      type: String,
      required: true,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    addedBy: {
      type: String,
      enum: ['patient', 'doctor'],
      default: 'doctor',
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
