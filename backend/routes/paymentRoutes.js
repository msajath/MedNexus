const express = require('express');
const Doctor = require('../models/Doctor');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const { protect, authorize } = require('../middleware/auth');
const errorHandler = require('../middleware/errorHandler');
const { summarizePayments } = require('../utils/payments');

const router = express.Router();

// Doctors can see their own received-payment totals and payouts sent to their bank.
router.get('/my', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const [payments, payouts] = await Promise.all([
      Payment.find({ doctor: doctor._id }).select('amountMinor status currency recordedAt receivedAt reference'),
      Payout.find({ doctor: doctor._id }).sort({ processedAt: -1 }),
    ]);

    const earnings = summarizePayments(payments);
    const totalPaidOut = payouts.reduce((sum, p) => sum + p.amount, 0);
    const pendingBalance = Math.max(0, earnings.netReceived - totalPaidOut);

    res.json({
      success: true,
      earnings,
      grossEarned: earnings.netReceived,
      totalPaidOut: Math.round(totalPaidOut * 100) / 100,
      pendingBalance: Math.round(pendingBalance * 100) / 100,
      bankDetails: doctor.bankDetails || {},
      payouts,
    });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

module.exports = router;
