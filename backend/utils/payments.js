const Payment = require('../models/Payment');
const crypto = require('crypto');

const idOf = (value) => value == null ? null : String(value._id || value);
const normalizePaymentReference = (value) => {
  const reference = typeof value === 'string' ? value.trim() : '';
  if (/[\u0000-\u001f\u007f]/.test(reference)) throw new Error('Payment reference contains invalid control characters');
  return reference;
};

const paymentFingerprint = ({ appointmentId, amountMinor, currency, method, reference }) =>
  crypto.createHash('sha256').update(JSON.stringify({
    appointmentId: String(appointmentId), amountMinor, currency, method,
    reference: normalizePaymentReference(reference),
  })).digest('hex');

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

const findPaymentDuplicates = async (model = Payment) => {
  const [references, appointments, invalidReferences] = await Promise.all([
    model.aggregate([
      { $match: { reference: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$reference', count: { $sum: 1 }, paymentIds: { $push: '$_id' }, methods: { $addToSet: '$method' } } },
      { $match: { count: { $gt: 1 } } },
      { $project: { _id: 0, reference: '$_id', count: 1, paymentIds: 1, methods: 1 } },
    ]),
    model.aggregate([
      { $match: { status: 'received' } },
      { $group: { _id: '$appointment', count: { $sum: 1 }, paymentIds: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
      { $project: { _id: 0, appointmentId: '$_id', count: 1, paymentIds: 1 } },
    ]),
    model.find({ reference: { $type: 'string', $regex: /[\u0000-\u001f\u007f]/ } })
      .select('_id reference').lean(),
  ]);
  return { reusedReferences: references, multipleReceivedPayments: appointments, invalidReferences };
};

module.exports = {
  serializePayment, summarizePayments, withAppointmentPayments, normalizePaymentReference,
  paymentFingerprint, findPaymentDuplicates,
};
