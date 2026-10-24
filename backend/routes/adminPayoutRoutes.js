const express = require('express');
const crypto = require('crypto');
const Doctor = require('../models/Doctor');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const validateObjectId = require('../middleware/validateObjectId');
const errorHandler = require('../middleware/errorHandler');
const { body, text, check } = require('../middleware/validateInput');
const { summarizePayments } = require('../utils/payments');
const { toMinor, summarizePayouts, serializePayout } = require('../utils/payouts');
const router = express.Router();

// Mounted after admin authorization. Saving a request never claims a bank transfer.
router.post('/payouts', validateObjectId('doctorId', { source: 'body' }), [
  body('amount').custom(value => toMinor(value) !== null),
  ...['bankName', 'accountNumber', 'accountHolderName'].map(field => body(`bankDetails.${field}`).isString().bail().trim().isLength({ min: 1, max: 120 }).bail().not().matches(/[\u0000-\u001f\u007f]/)),
  text('reference', 120), text('notes', 500),
], check, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.body.doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    const [payments, payouts] = await Promise.all([Payment.find({ doctor: doctor._id }), Payout.find({ doctor: doctor._id })]);
    const earnings = summarizePayments(payments);
    const { totalPaidOut, reservedPayouts } = summarizePayouts(payouts);
    const amountMinor = toMinor(req.body.amount);
    const availableMinor = Math.round((earnings.netReceived - totalPaidOut - reservedPayouts) * 100);
    if (amountMinor > availableMinor) return res.status(409).json({ success: false, message: 'Payout exceeds the available earnings balance' });
    const payout = await Payout.create({
      doctor: doctor._id, doctorUser: doctor.user, amount: amountMinor / 100, currency: 'USD',
      bankDetails: {
        bankName: req.body.bankDetails.bankName, accountNumber: req.body.bankDetails.accountNumber,
        accountHolderName: req.body.bankDetails.accountHolderName,
      },
      status: 'pending', reference: req.body.reference || `PAY-${crypto.randomUUID()}`,
      notes: req.body.notes || '', processedBy: req.user._id,
    });
    return res.status(201).json({ success: true, payout: serializePayout(payout),
      message: 'Payout request saved. No money has been transferred; a bank payment provider must be connected.' });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'This doctor already has a pending payout. Review it before creating another.' });
    return errorHandler(error, req, res, () => {});
  }
});

router.get('/payouts', async (req, res) => {
  try {
    if (req.query.doctorId && !/^[a-f\d]{24}$/i.test(req.query.doctorId)) return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
    const payouts = await Payout.find(req.query.doctorId ? { doctor: req.query.doctorId } : {})
      .populate('doctorUser', 'name email').populate('processedBy', 'name').sort({ createdAt: -1 });
    res.json({ success: true, count: payouts.length, ...summarizePayouts(payouts), payouts: payouts.map(serializePayout), transfersEnabled: false });
  } catch (error) { return errorHandler(error, req, res, () => {}); }
});
router.post('/payouts/:id/cancel', validateObjectId('id'), async (req, res) => {
  try {
    const payout = await Payout.findOneAndUpdate({ _id: req.params.id, status: 'pending' }, { $set: { status: 'cancelled' } }, { returnDocument: 'after' });
    if (!payout) return res.status(409).json({ success: false, message: 'Only pending payout requests can be cancelled' });
    res.json({ success: true, payout: serializePayout(payout) });
  } catch (error) { return errorHandler(error, req, res, () => {}); }
});
module.exports = router;
