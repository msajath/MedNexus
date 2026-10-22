const express = require('express');
const Doctor = require('../models/Doctor');
const Payment = require('../models/Payment');
const { protect, authorize } = require('../middleware/auth');
const errorHandler = require('../middleware/errorHandler');
const { summarizePayments } = require('../utils/payments');

const router = express.Router();

// Doctors can see their own received-payment totals, without other doctors'
// receipts or patient payment references. Only admin routes can record money.
router.get('/my', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id }).select('_id');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    const payments = await Payment.find({ doctor: doctor._id }).select('amountMinor status currency');
    res.json({ success: true, earnings: summarizePayments(payments) });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

module.exports = router;
