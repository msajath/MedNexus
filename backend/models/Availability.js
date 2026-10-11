const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      unique: true,
    },
    schedule: [
      {
        day: {
          type: String,
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          required: true,
        },
        enabled: {
          type: Boolean,
          default: false,
        },
        start: {
          type: String,
          default: '09:00',
        },
        end: {
          type: String,
          default: '17:00',
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Availability', availabilitySchema);
