const { query, text, body, doctorRules, check } = require('../middleware/validateInput');
const { allowedTransitions } = require('../utils/slots');
const errorHandler = require('../middleware/errorHandler');
const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const Availability = require('../models/Availability');
const ContactMessage = require('../models/ContactMessage');
const { protect, authorize } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const { isValidDate } = require('../utils/slots');
const { adminAppointmentFilter, adminAppointmentSelection, serializeAdminAppointment, summarizeAppointments } = require('../utils/adminAppointments');
const { summarizePayments, withAppointmentPayments } = require('../utils/payments');

const router = express.Router();

// All admin routes require admin role
router.use(protect, authorize('admin'));
router.use(require('./adminPaymentRoutes'));

// ──────────────────────────────────────────────
// @route   GET /api/admin/stats
// @desc    Get platform-wide statistics
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const active = { isActive: { $ne: false } };
    const totalUsers = await User.countDocuments(active);
    const totalDoctors = await User.countDocuments({ ...active, role: 'doctor' });
    const totalPatients = await User.countDocuments({ ...active, role: 'patient' });
    const appointments = await Appointment.find(adminAppointmentFilter).select('status rescheduleHistory');
    const { appointmentSummary } = summarizeAppointments(appointments);
    const earnings = summarizePayments(await Payment.find());
    const totalAppointments = appointmentSummary.total;
    const monthlyAppointments = await Appointment.countDocuments({
      ...adminAppointmentFilter,
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }, // from 1st of current month
    });
    const pendingApprovals = await User.countDocuments({ ...active, role: 'doctor', isVerified: false });

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers.toLocaleString(),
        totalDoctors: totalDoctors.toLocaleString(),
        totalPatients: totalPatients.toLocaleString(),
        totalAppointments: totalAppointments.toLocaleString(),
        monthlyAppointments: monthlyAppointments.toLocaleString(),
        pendingApprovals: pendingApprovals.toString(),
        revenue: `$${earnings.netReceived.toLocaleString()}`,
      },
      appointmentSummary,
      earnings,
    });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// Earnings include only manually verified payment receipts. Booking status and
// consultation fees never imply that money has been received.
router.get('/earnings', async (req, res) => {
  try {
    const [doctors, appointments, payments, payouts] = await Promise.all([
      Doctor.find().populate('user', 'name isActive email'),
      Appointment.find(adminAppointmentFilter).select('doctor status'),
      Payment.find(),
      Payout.find().sort({ processedAt: -1 }),
    ]);
    const rowFor = (doctorId) => ({
      doctorId, userId: null, name: 'Removed doctor', specialty: '', fee: 100,
      bankDetails: { bankName: '', accountNumber: '', accountHolderName: '', routingNumber: '', branch: '' },
      isActive: false, completedAppointments: 0, payments: [], totalPaidOut: 0,
    });
    const rows = new Map(doctors.map((doctor) => [String(doctor._id), {
      ...rowFor(String(doctor._id)), userId: doctor.user?._id || null,
      name: doctor.user?.name || 'Removed doctor', specialty: doctor.specialty,
      fee: doctor.fee ?? 100,
      bankDetails: doctor.bankDetails || { bankName: '', accountNumber: '', accountHolderName: '', routingNumber: '', branch: '' },
      isActive: Boolean(doctor.user && doctor.user.isActive !== false),
    }]));
    for (const appointment of appointments) {
      const key = String(appointment.doctor);
      if (!rows.has(key)) rows.set(key, rowFor(key));
      if (appointment.status === 'completed') rows.get(key).completedAppointments += 1;
    }
    for (const payment of payments) {
      const key = String(payment.doctor);
      if (!rows.has(key)) rows.set(key, rowFor(key));
      rows.get(key).payments.push(payment);
    }
    for (const payout of payouts) {
      const key = String(payout.doctor);
      if (rows.has(key)) {
        rows.get(key).totalPaidOut = (rows.get(key).totalPaidOut || 0) + payout.amount;
      }
    }
    const result = [...rows.values()].map(({ payments: receipts, totalPaidOut, ...row }) => {
      const summary = summarizePayments(receipts);
      const grossEarned = summary.netReceived;
      const pendingBalance = Math.max(0, grossEarned - totalPaidOut);
      return {
        ...row,
        ...summary,
        totalPaidOut: Math.round(totalPaidOut * 100) / 100,
        pendingBalance: Math.round(pendingBalance * 100) / 100,
      };
    });
    result.sort((a, b) => b.netReceived - a.netReceived || a.name.localeCompare(b.name));
    const totalDoctorPayouts = payouts.reduce((acc, p) => acc + p.amount, 0);
    const earnings = summarizePayments(payments);
    const hospitalRetained = Math.round((earnings.netReceived - totalDoctorPayouts) * 100) / 100;

    res.json({
      success: true,
      earnings,
      totalDoctorPayouts: Math.round(totalDoctorPayouts * 100) / 100,
      hospitalRetained,
      doctors: result,
      payoutsCount: payouts.length,
    });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/users', [query('role').optional().isIn(['patient', 'doctor', 'admin'])], check, async (req, res) => {
  try {
    const { role } = req.query;
    let query = { isActive: { $ne: false } };
    if (role) query.role = role;

    const users = await User.find(query).select('_id name email phone avatar role isVerified isActive createdAt updatedAt').sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   PUT /api/admin/verify-doctor/:userId
// @desc    Verify/approve a doctor account
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.put('/verify-doctor/:userId', validateObjectId('userId'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'doctor' || user.isActive === false) {
      return res.status(400).json({ success: false, message: 'User is not a doctor' });
    }

    user.isVerified = true;
    await user.save();

    res.json({ success: true, message: `Dr. ${user.name} has been verified`, user: {
      _id: user._id, name: user.name, email: user.email, role: user.role,
      isVerified: user.isVerified, isActive: user.isActive,
    } });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   POST /api/admin/doctors
// @desc    Add a new doctor to the system
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.post('/doctors', [text('name', 120, false), body('email').isString().bail().trim().isEmail(), ...doctorRules], check, async (req, res) => {
  try {
    const { name, specialty, fee } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Name and valid email are required' });
    }

    // 1. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // 2. Create User document
    const user = await User.create({
      name,
      email,
      // The doctor sets their own password through the reset flow.
      password: crypto.randomBytes(32).toString('hex'),
      role: 'doctor',
      isVerified: true // Pre-verified since admin is adding them
    });

    // 3. Create Doctor profile
    const doctor = await Doctor.create({
      user: user._id,
      specialty: specialty || 'General Practice',
      fee: fee ?? 100,
    });

    // 4. Create default Availability
    const defaultAvailability = [
      { day: 'Monday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Tuesday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Wednesday', enabled: true, start: '10:00', end: '16:00' },
      { day: 'Thursday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Friday', enabled: true, start: '09:00', end: '14:00' },
      { day: 'Saturday', enabled: false, start: '00:00', end: '00:00' },
      { day: 'Sunday', enabled: false, start: '00:00', end: '00:00' },
    ];
    
    await Availability.create({
      doctor: doctor._id,
      schedule: defaultAvailability
    });

    res.status(201).json({
      success: true,
      message: 'Doctor added. Ask them to set a password using Forgot Password.',
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      doctor: { id: doctor._id, specialty: doctor.specialty },
    });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/admin/doctors-detail
// @desc    Get all doctors with full detail including credentials
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/doctors-detail', async (req, res) => {
  try {
    const doctors = await Doctor.find()
      .populate('user', 'name email phone avatar isVerified isActive createdAt');

    const result = doctors.filter(doc => doc.user && doc.user.isActive !== false).map(doc => ({
      _id: doc._id,
      userId: doc.user?._id,
      name: doc.user?.name,
      email: doc.user?.email,
      phone: doc.user?.phone,
      avatar: doc.user?.avatar,
      isVerified: doc.user?.isVerified,
      joinedDate: doc.user?.createdAt,
      specialty: doc.specialty,
      fee: doc.fee,
      experience: doc.experience,
      location: doc.location,
      bio: doc.bio,
      rating: doc.rating,
      reviews: doc.reviews,
      available: doc.available,
      credentialsChanged: doc.credentialsChanged,
      bankDetails: doc.bankDetails || {},
    }));

    res.json({ success: true, count: result.length, doctors: result });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/admin/doctors/:userId
// @desc    Get a doctor's profile, earnings, appointments, and patients
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/doctors/:userId', validateObjectId('userId'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.params.userId })
      .populate('user', 'name email phone avatar isVerified createdAt');

    if (!doctor || !doctor.user) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const appointments = await Appointment.find({ ...adminAppointmentFilter, doctor: doctor._id })
      .select(adminAppointmentSelection)
      .populate('patient', 'name email phone avatar createdAt')
      .sort({ date: -1, time: -1 });

    const { appointmentSummary } = summarizeAppointments(appointments);
    const earnings = summarizePayments(await Payment.find({ doctor: doctor._id }));
    const administrativeAppointments = await withAppointmentPayments(appointments.map((appointment) => serializeAdminAppointment({
      ...appointment.toObject(), doctor,
    })));
    const patients = [...new Map(
      appointments
        .filter((appointment) => appointment.patient)
        .map((appointment) => [String(appointment.patient._id), appointment.patient])
    ).values()];

    res.json({
      success: true,
      doctor: {
        id: doctor._id,
        userId: doctor.user._id,
        name: doctor.user.name,
        email: doctor.user.email,
        phone: doctor.user.phone,
        avatar: doctor.user.avatar,
        isVerified: doctor.user.isVerified,
        joinedDate: doctor.user.createdAt,
        specialty: doctor.specialty,
        fee: doctor.fee,
        bankDetails: doctor.bankDetails || {},
        experience: doctor.experience,
        location: doctor.location,
        bio: doctor.bio,
        rating: doctor.rating,
        reviews: doctor.reviews,
        available: doctor.available,
        totalAppointments: appointments.length,
        completedAppointments: appointments.filter((appointment) => appointment.status === 'completed').length,
        totalPatients: patients.length,
        earnings: earnings.netReceived,
        earningsSummary: earnings,
        appointmentSummary,
        patients,
        appointments: administrativeAppointments,
      },
    });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   DELETE /api/admin/users/:userId
// @desc    Delete a user account
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.delete('/users/:userId', validateObjectId('userId'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin accounts cannot be deactivated here' });
    }
    if (user.isActive === false) {
      return res.json({ success: true, message: 'Account already deactivated' });
    }

    user.isActive = false;
    await user.save();

    if (user.role === 'doctor') {
      const doctor = await Doctor.findOne({ user: user._id });
      if (doctor) {
        doctor.available = false;
        await doctor.save();
      }
    }

    res.json({ success: true, message: `Account for ${user.name} deactivated; clinical history retained` });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/admin/recent-activity
// @desc    Get recent platform activity
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/recent-activity', async (req, res) => {
  try {
    // Fetch recent appointments
    const recentAppointments = await Appointment.find(adminAppointmentFilter)
      .select('_id patient doctor createdAt')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name' } })
      .populate('patient', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Fetch recently registered users
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5);

    // Build activity feed
    const activity = [];

    recentAppointments.forEach((appt) => {
      activity.push({
        id: appt._id,
        type: 'booking',
        message: `${appt.patient?.name || 'A patient'} booked with ${appt.doctor?.user?.name || 'a doctor'}`,
        time: appt.createdAt,
        icon: 'calendar_today',
      });
    });

    recentUsers.forEach((user) => {
      activity.push({
        id: user._id,
        type: 'registration',
        message: `${user.name} registered as ${user.role}`,
        time: user.createdAt,
        icon: 'person_add',
      });
    });

    // Sort by time descending
    activity.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({ success: true, activity: activity.slice(0, 10) });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// Contact form inbox for administrators
router.get('/contact-messages', async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json({ success: true, count: messages.length, messages });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

router.put('/contact-messages/:id/status', validateObjectId('id'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid contact message status' });
    }

    const message = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!message) return res.status(404).json({ success: false, message: 'Contact message not found' });
    return res.json({ success: true, message });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/admin/appointments
// @desc    Get all appointments with full patient/doctor info
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/appointments', [
  query('status').optional().isString().bail().isIn(['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled']),
  query('doctorId').optional().isString().bail().isMongoId(),
  query('dateFrom').optional().isString().bail().custom(isValidDate),
  query('dateTo').optional().isString().bail().custom(isValidDate),
], check, async (req, res) => {
  try {
    const filter = { ...adminAppointmentFilter };
    if (req.query.status === 'rescheduled') filter['rescheduleHistory.0'] = { $exists: true };
    else if (req.query.status) filter.status = req.query.status;
    if (req.query.doctorId) filter.doctor = req.query.doctorId;
    if (req.query.dateFrom && req.query.dateTo && req.query.dateFrom > req.query.dateTo) {
      return res.status(400).json({ success: false, message: 'Start date must not be after end date' });
    }
    if (req.query.dateFrom || req.query.dateTo) filter.date = {
      ...(req.query.dateFrom ? { $gte: req.query.dateFrom } : {}),
      ...(req.query.dateTo ? { $lte: req.query.dateTo } : {}),
    };
    const appointments = await Appointment.find(filter)
      .select(adminAppointmentSelection)
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email avatar' } })
      .populate('patient', 'name email phone avatar')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: appointments.length,
      appointmentSummary: summarizeAppointments(appointments).appointmentSummary,
      appointments: await withAppointmentPayments(appointments.map(serializeAdminAppointment)),
    });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   PUT /api/admin/appointments/:id/status
// @desc    Admin update appointment status
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.put('/appointments/:id/status', validateObjectId('id'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const current = await Appointment.findOne({ _id: req.params.id, ...adminAppointmentFilter }).select('_id status');
    if (!current) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (!allowedTransitions[current.status]?.includes(status)) return res.status(409).json({ success: false, message: 'Invalid appointment status transition' });
    const appointment = await Appointment.findOneAndUpdate(
      { _id: current._id, status: current.status, ...adminAppointmentFilter },
      { $set: { status }, $unset: { rescheduleIntent: '' } }, { new: true, runValidators: true }
    ).select(adminAppointmentSelection);
    if (!appointment) return res.status(409).json({ success: false, message: 'Appointment changed. Refresh and retry.' });

    if (status === 'completed') {
      try {
        const existingPayment = await Payment.findOne({ appointment: appointment._id, status: 'received' });
        if (!existingPayment) {
          const doc = await Doctor.findById(appointment.doctor);
          const fee = (typeof appointment.feeAtBooking === 'number' && appointment.feeAtBooking >= 0)
            ? appointment.feeAtBooking
            : (doc?.fee ?? 100);
          const amountMinor = Math.round(fee * 100);
          if (amountMinor > 0) {
            await Payment.create({
              appointment: appointment._id,
              doctor: appointment.doctor,
              patient: appointment.patient,
              amountMinor,
              currency: 'USD',
              method: 'auto_credit',
              reference: `AUTO-${String(appointment._id).slice(-8).toUpperCase()}`,
              status: 'received',
              receivedAt: new Date(),
              recordedAt: new Date(),
              recordedBy: req.user._id,
            });
          }
        }
      } catch (paymentErr) {
        console.error('Error auto-crediting completed appointment payment:', paymentErr);
      }
    }

    res.json({ success: true, appointment: (await withAppointmentPayments([serializeAdminAppointment(appointment)]))[0] });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This time slot is already booked' });
    }
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   PUT /api/admin/doctors/:id/fee
// @desc    Admin sets/fixes the consultation charge for a doctor
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.put('/doctors/:id/fee', validateObjectId('id'), async (req, res) => {
  try {
    const fee = Number(req.body.fee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 1000000) {
      return res.status(400).json({ success: false, message: 'Please provide a valid consultation fee between 0 and 1,000,000' });
    }

    let doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      // Check if parameter is a user ID
      doctor = await Doctor.findOne({ user: req.params.id });
    }
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    doctor.fee = fee;
    await doctor.save();

    res.json({
      success: true,
      message: `Consultation fee for doctor successfully updated to $${fee}`,
      doctor: {
        id: doctor._id,
        userId: doctor.user,
        fee: doctor.fee,
        specialty: doctor.specialty,
      },
    });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   POST /api/admin/payouts
// @desc    Admin sends money / pays salary to a doctor's bank account
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.post('/payouts', async (req, res) => {
  try {
    const { doctorId, amount, bankDetails, reference, notes } = req.body;
    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'Doctor ID is required' });
    }
    const payoutAmount = Number(amount);
    if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payout amount must be a positive number' });
    }

    let doctor = await Doctor.findById(doctorId).populate('user', 'name email');
    if (!doctor) {
      doctor = await Doctor.findOne({ user: doctorId }).populate('user', 'name email');
    }
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Determine target bank details
    const targetBank = {
      bankName: bankDetails?.bankName || doctor.bankDetails?.bankName || '',
      accountNumber: bankDetails?.accountNumber || doctor.bankDetails?.accountNumber || '',
      accountHolderName: bankDetails?.accountHolderName || doctor.bankDetails?.accountHolderName || doctor.user?.name || '',
      routingNumber: bankDetails?.routingNumber || doctor.bankDetails?.routingNumber || '',
      branch: bankDetails?.branch || doctor.bankDetails?.branch || '',
    };

    if (!targetBank.bankName.trim() || !targetBank.accountNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Doctor bank name and account number are required to process bank payout',
      });
    }

    // Update doctor's saved bank details if provided
    doctor.bankDetails = targetBank;
    await doctor.save();

    // Calculate current gross received and past payouts
    const [payments, existingPayouts] = await Promise.all([
      Payment.find({ doctor: doctor._id, status: 'received' }),
      Payout.find({ doctor: doctor._id, status: 'completed' }),
    ]);

    const grossEarned = payments.reduce((acc, p) => acc + (p.amountMinor / 100), 0);
    const pastPaid = existingPayouts.reduce((acc, p) => acc + p.amount, 0);
    const availableBalance = Math.max(0, grossEarned - pastPaid);

    const ref = (reference || `PAY-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`).trim();

    const payout = await Payout.create({
      doctor: doctor._id,
      doctorUser: doctor.user?._id || doctor.user,
      amount: Math.round(payoutAmount * 100) / 100,
      currency: 'USD',
      bankDetails: targetBank,
      status: 'completed',
      reference: ref,
      notes: notes ? String(notes).trim().slice(0, 500) : 'Doctor salary / earnings payout',
      processedBy: req.user._id,
      processedAt: new Date(),
    });

    const newPaidTotal = pastPaid + payout.amount;
    const newBalance = Math.max(0, grossEarned - newPaidTotal);

    res.status(201).json({
      success: true,
      message: `Successfully sent $${payout.amount.toFixed(2)} to ${doctor.user?.name || 'doctor'}'s bank account`,
      payout,
      doctorEarnings: {
        grossEarned: Math.round(grossEarned * 100) / 100,
        totalPaidOut: Math.round(newPaidTotal * 100) / 100,
        pendingBalance: Math.round(newBalance * 100) / 100,
      },
    });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/admin/payouts
// @desc    Get all bank payouts history
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/payouts', async (req, res) => {
  try {
    const filter = {};
    if (req.query.doctorId) {
      filter.doctor = req.query.doctorId;
    }
    const payouts = await Payout.find(filter)
      .populate('doctorUser', 'name email avatar')
      .populate('processedBy', 'name email')
      .sort({ processedAt: -1 });

    const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      success: true,
      count: payouts.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      payouts,
    });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/admin/records
// @desc    Explicitly reject clinical-record access for administrators
// @access  Private (admin only)
// ──────────────────────────────────────────────
router.get('/records', (req, res) => res.status(403).json({
  success: false, message: 'Administrators cannot access clinical records',
}));

module.exports = router;
