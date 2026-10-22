const Payment = require('../models/Payment');

const idOf = (value) => value == null ? null : String(value._id || value);

const serializePayment = (payment) => ({
  id: idOf(payment), appointmentId: idOf(payment.appointment), doctorId: idOf(payment.doctor),
  patientId: idOf(payment.patient), amount: payment.amountMinor / 100, currency: payment.currency,
  method: payment.method, reference: payment.reference || '', status: payment.status,
  receivedAt: payment.receivedAt, recordedAt: payment.recordedAt, recordedBy: idOf(payment.recordedBy),
  refundedAt: payment.refundedAt || null, refundedBy: idOf(payment.refundedBy), refundReason: payment.refundReason || '',
});

const summarizePayments = (payments) => {
  let grossMinor = 0;
  let refundedMinor = 0;
  let receivedPayments = 0;
  for (const payment of payments) {
    if (!['received', 'refunded'].includes(payment.status)) continue;
    grossMinor += payment.amountMinor;
    if (payment.status === 'refunded') refundedMinor += payment.amountMinor;
    else receivedPayments += 1;
  }
  return { receivedAmount: grossMinor / 100, refundedAmount: refundedMinor / 100,
    netReceived: (grossMinor - refundedMinor) / 100, receivedPayments, currency: 'USD', basis: 'recorded_payments' };
};

const withAppointmentPayments = async (appointments) => {
  if (!appointments.length) return [];
  const payments = await Payment.find({ appointment: { $in: appointments.map((appointment) => appointment._id) } })
    .sort({ recordedAt: -1, _id: -1 });
  const latest = new Map();
  for (const payment of payments) {
    const key = idOf(payment.appointment);
    if (!latest.has(key) || payment.status === 'received') latest.set(key, payment);
  }
  return appointments.map((appointment) => {
    const payment = latest.get(idOf(appointment));
    return { ...appointment, paymentStatus: payment?.status || 'unpaid', payment: payment ? serializePayment(payment) : null };
  });
};

module.exports = { serializePayment, summarizePayments, withAppointmentPayments };
