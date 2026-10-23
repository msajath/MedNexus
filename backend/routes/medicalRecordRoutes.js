const { recordRules, check } = require('../middleware/validateInput');
const { clinicDate } = require('../utils/slots');
const errorHandler = require('../middleware/errorHandler');
const express = require('express');
const MedicalRecord = require('../models/MedicalRecord');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { protect, authorize } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

// Administrative accounts never enter the clinical-record API, including direct URLs.
router.use(protect, authorize('patient', 'doctor'));



// ──────────────────────────────────────────────
// @route   GET /api/records/my
// @desc    Get all medical records for the logged-in patient
// @access  Private (patient)
// ──────────────────────────────────────────────
router.get('/my', authorize('patient'), async (req, res) => {
  try {
    const records = await MedicalRecord.find({ patient: req.user._id, deletedAt: null })
      .populate({
        path: 'doctor',
        populate: { path: 'user', select: 'name avatar specialty' },
      })
      .sort({ date: -1, createdAt: -1 });

    res.json({ success: true, count: records.length, records });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   POST /api/records
// @desc    Create a new medical record (patient self-upload)
// @access  Private (patient)
// ──────────────────────────────────────────────
router.post('/', authorize('patient'), recordRules, check, async (req, res) => {
  try {
    const { title, type, description, diagnosis, medications, date, attachments, isPrivate, doctorId } = req.body;

    const record = await MedicalRecord.create({
      patient: req.user._id,
      doctor: doctorId || null,
      title,
      type: type || 'Other',
      description: description || '',
      diagnosis: diagnosis || '',
      medications: medications || [],
      attachments: attachments || [],
      date: date || clinicDate(),
      addedBy: 'patient',
      isPrivate: isPrivate === true,
    });

    if (typeof record.populate === 'function') {
      await record.populate({ path: 'doctor', populate: { path: 'user', select: 'name avatar specialty' } });
    }

    res.status(201).json({ success: true, record });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   DELETE /api/records/:id/attachments/:index
// @desc    Remove an individual attachment from a patient record
// @access  Private (patient)
// ──────────────────────────────────────────────
router.delete('/:id/attachments/:index', authorize('patient'), validateObjectId('id'), async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    if (record.patient.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (record.addedBy !== 'patient' || record.appointment) return res.status(403).json({ success: false, message: 'Clinical records cannot be modified' });
    const index = /^(0|[1-9]\d*)$/.test(req.params.index) ? Number(req.params.index) : NaN;
    if (!Number.isSafeInteger(index) || index >= (record.attachments || []).length) {
      return res.status(400).json({ success: false, message: 'Invalid attachment index' });
    }
    record.attachments.splice(index, 1);
    await record.save();
    res.json({ success: true, message: 'Attachment removed successfully', record });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   DELETE /api/records/:id
// @desc    Soft-delete a patient-uploaded record (clinical records are immutable)
// @access  Private (patient)
// ──────────────────────────────────────────────
router.delete('/:id', authorize('patient'), validateObjectId('id'), async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    if (record.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this record' });
    }

    if (record.addedBy !== 'patient' || record.appointment) {
      return res.status(403).json({ success: false, message: 'Clinical records cannot be deleted' });
    }

    record.deletedAt = new Date();
    await record.save();
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/records/patient/:patientId
// @desc    Get medical records for a specific patient (doctor view)
// @access  Private (doctor)
// ──────────────────────────────────────────────
router.get('/patient/:patientId', authorize('doctor'), validateObjectId('patientId'), async (req, res) => {
  try {
    if (req.user.isVerified !== true) {
      return res.status(403).json({ success: false, message: 'Doctor approval is required' });
    }
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) return res.status(403).json({ success: false, message: 'Doctor profile unavailable' });

    const appointments = await Appointment.find({
      doctor: doctor._id,
      patient: req.params.patientId,
      status: { $in: ['confirmed', 'completed'] },
    }).select('_id');
    if (!appointments.length) {
      return res.status(403).json({ success: false, message: 'No treatment relationship with this patient' });
    }

    const records = await MedicalRecord.find({
      patient: req.params.patientId,
      deletedAt: null,
      isPrivate: { $ne: true },
      $or: [
        { addedBy: 'patient', $or: [{ doctor: null }, { doctor: { $exists: false } }, { doctor: doctor._id }] },
        { doctor: doctor._id },
        { appointment: { $in: appointments.map((appointment) => appointment._id) } },
      ],
    })
      .sort({ date: -1 });

    res.json({ success: true, count: records.length, records });
  } catch (error) {
    return errorHandler(error, req, res, () => {});
  }
});

// ──────────────────────────────────────────────
// @route   POST /api/records/doctor-add
// @desc    Doctor adds a record to a patient
// @access  Private (doctor)
// ──────────────────────────────────────────────
router.post(
  '/doctor-add',
  authorize('doctor'),
  recordRules, check,
  validateObjectId('patientId', { source: 'body' }),
  validateObjectId('appointmentId', { source: 'body' }),
  async (req, res) => {
    try {
      if (req.user.isVerified !== true) {
        return res.status(403).json({ success: false, message: 'Doctor approval is required' });
      }
      const { patientId, title, type, description, diagnosis, medications, date, appointmentId } = req.body;

      const doctorProfile = await Doctor.findOne({ user: req.user._id });
      if (!doctorProfile) {
        return res.status(404).json({ success: false, message: 'Doctor profile not found' });
      }

      const appointment = await Appointment.findOne({
        _id: appointmentId,
        patient: patientId,
        doctor: doctorProfile._id,
        status: { $in: ['confirmed', 'completed'] },
      });
      if (!appointment) {
        return res.status(403).json({ success: false, message: 'A matching confirmed appointment is required' });
      }

      const record = await MedicalRecord.create({
        patient: patientId,
        doctor: doctorProfile._id,
        appointment: appointmentId,
        title,
        type: type || 'Diagnosis',
        description: description || '',
        diagnosis: diagnosis || '',
        medications: medications || [],
        date: date || clinicDate(),
        addedBy: 'doctor',
      });

      res.status(201).json({ success: true, record });
    } catch (error) {
      return errorHandler(error, req, res, () => {});
    }
  },
);

module.exports = router;
