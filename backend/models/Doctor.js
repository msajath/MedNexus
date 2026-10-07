const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    credentialsChanged: {
      type: Boolean,
      default: false, // True once doctor has changed their own email/password
    },
    specialty: {
      type: String,
      required: [true, 'Please provide a specialty'],
    },
    fee: {
      type: Number,
      required: [true, 'Please provide a consultation fee'],
    },
    experience: {
      type: String,
      default: '1+ Years',
    },
    location: {
      type: String,
      default: '',
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviews: {
      type: Number,
      default: 0,
    },
    languages: {
      type: [String],
      default: ['English'],
    },
    available: {
      type: Boolean,
      default: true,
    },
    bio: {
      type: String,
      default: '',
    },
    education: [
      {
        degree: String,
        institution: String,
        year: String,
      },
    ],
    experienceHistory: [
      {
        title: String,
        hospital: String,
        period: String,
      },
    ],
    licenseNumber: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);
