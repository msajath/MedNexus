const express = require('express');
const { body, query, text, check } = require('../middleware/validateInput');
const validateObjectId = require('../middleware/validateObjectId');
const errorHandler = require('../middleware/errorHandler');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const { adminAppointmentFilter } = require('../utils/adminAppointments');
const { serializePayment, summarizePayments } = require('../utils/payments');

// Mounted after the admin authentication/authorization middleware.
const router = express.Router();
const validAmount = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1000000 &&
  /^\d+(?:\.\d{1,2})?$/.test(String(value));

router.post('/appointments/:id/payment', validateObjectId('id'), [
  body('amount').custom(validAmount).withMessage('Use a positive amount with at most two decimal places, up to 1,000,000'),
  body('currency').isString().bail().equals('USD'),
  body('method').isString().bail().isIn(['cash', 'bank_transfer', 'card', 'other']),
  text('reference', 120),
  body('receivedAt').optional().isString().bail().isISO8601({ strict: true, strictSeparator: true }).bail()
    .custom((value) => /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Date.parse(value) <= Date.now()),
], check, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ _id: req.params.id, ...adminAppointmentFilter }).select('_id doctor patient status');
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (appointment.status === 'cancelled') return res.status(409).json({ success: false, message: 'Cannot record a payment for a cancelled appointment' });
    const payment = await Payment.create({
      appointment: appointment._id, doctor: appointment.doctor, patient: appointment.patient,
      amountMinor: Math.round(req.body.amount * 100), currency: 'USD', method: req.body.method,
      reference: req.body.reference || '', receivedAt: req.body.receivedAt ? new Date(req.body.receivedAt) : new Date(),
      recordedAt: new Date(), recordedBy: req.user._id, status: 'received',
    });
    res.status(201).json({ success: true, payment: serializePayment(payment) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'This appointment already has a received payment. Refund it before recording another receipt.' });
    return errorHandler(error, req, res, () => {});
  }
});

router.post('/payments/:id/refund', validateObjectId('id'), [text('reason', 1000, false)], check, async (req, res) => {
  try {
    const payment = await Payment.findOneAndUpdate({ _id: req.params.id, status: 'received' }, {
      $set: { status: 'refunded', refundedAt: new Date(), refundedBy: req.user._id, refundReason: req.body.reason },
    }, { new: true, runValidators: true });
    if (!payment) {
      const exists = await Payment.exists({ _id: req.params.id });
      return res.status(exists ? 409 : 404).json({ success: false, message: exists ? 'This payment has already been refunded' : 'Payment not found' });
    }
    res.json({ success: true, payment: serializePayment(payment) });
  } catch (error) { return errorHandler(error, req, res, () => {}); }
});

router.get('/payments', [
  query('status').optional().isString().bail().isIn(['received', 'refunded']),
  query('doctorId').optional().isString().bail().isMongoId(),
  query('appointmentId').optional().isString().bail().isMongoId(),
], check, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.doctorId) filter.doctor = req.query.doctorId;
    if (req.query.appointmentId) filter.appointment = req.query.appointmentId;
    const payments = await Payment.find(filter).sort({ recordedAt: -1, _id: -1 });
    res.json({ success: true, count: payments.length, payments: payments.map(serializePayment), earnings: summarizePayments(payments) });
  } catch (error) { return errorHandler(error, req, res, () => {}); }
});

module.exports = router;
