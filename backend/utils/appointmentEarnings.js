const Payment = require('../models/Payment');

// Service earnings use the booked price, never a doctor's later fee or a default.
// These credits are an earnings ledger entry, not a card charge or bank deposit.
async function creditCompletedAppointment(appointment, actorId) {
  const fee = appointment.feeAtBooking;
  if (typeof fee !== 'number' || !Number.isFinite(fee) || fee <= 0) return;
  const amountMinor = Math.round(fee * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor > 100000000) throw new Error('Invalid booked consultation fee');
  // A refunded appointment must not be credited again when completion is retried.
  if (await Payment.findOne({ appointment: appointment._id })) return;
  try {
    await Payment.create({ appointment: appointment._id, doctor: appointment.doctor, patient: appointment.patient,
      amountMinor, currency: 'USD', method: 'auto_credit', reference: `AUTO-${appointment._id}`,
      status: 'received', receivedAt: new Date(), recordedBy: actorId });
  } catch (error) {
    if (error.code === 11000 && await Payment.findOne({ appointment: appointment._id })) return;
    throw error;
  }
}
module.exports = { creditCompletedAppointment };
