const Appointment = require('../models/Appointment');
const DoctorLeave = require('../models/DoctorLeave');

const activeStatuses = ['pending', 'confirmed'];
const holdDurationMs = 2 * 60 * 1000;
const realAppointmentFilter = { bookingHold: { $exists: false } };

// Both updates are expiry-fenced. A refreshed intent or activated booking cannot
// be cancelled by cleanup that started earlier.
const cleanExpiredBookingWork = async (doctor) => {
  const now = new Date();
  await Appointment.updateMany({ doctor, status: { $in: activeStatuses }, 'bookingHold.expiresAt': { $lte: now } },
    { $set: { status: 'cancelled' } });
  await Appointment.updateMany({ doctor, 'rescheduleIntent.expiresAt': { $lte: now } },
    { $unset: { rescheduleIntent: '' } });
};

const blockingLeave = (doctor, date) => DoctorLeave.findOne({
  doctor, status: { $in: ['approved', 'reviewing'] }, startDate: { $lte: date }, endDate: { $gte: date },
});

module.exports = { activeStatuses, holdDurationMs, realAppointmentFilter, cleanExpiredBookingWork, blockingLeave };
