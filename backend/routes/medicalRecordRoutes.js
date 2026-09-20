const express = require('express');
const MedicalRecord = require('../models/MedicalRecord');
const Doctor = require('../models/Doctor');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const getLocalDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ──────────────────────────────────────────────
// @route   GET /api/records/my
// @desc    Get all medical records for the logged-in patient
// @access  Private (patient)
// ──────────────────────────────────────────────
router.get('/my', protect, authorize('patient'), async (req, res) => {
  try {
    const records = await MedicalRecord.find({ patient: req.user._id })
      .populate({
        path: 'doctor',
        populate: { path: 'user', select: 'name avatar' },
      })
      .sort({ date: -1, createdAt: -1 });

    res.json({ success: true, count: records.length, records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   POST /api/records
// @desc    Create a new medical record (patient self-upload)
// @access  Private (patient)
// ──────────────────────────────────────────────
router.post('/', protect, authorize('patient'), async (req, res) => {
  try {
    const { title, type, description, diagnosis, medications, date, attachments } = req.body;

    const record = await MedicalRecord.create({
      patient: req.user._id,
      title,
      type: type || 'Other',
      description: description || '',
      diagnosis: diagnosis || '',
      medications: medications || [],
      attachments: attachments || [],
      date: date || getLocalDateString(),
      addedBy: 'patient',
    });

    res.status(201).json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   DELETE /api/records/:id
// @desc    Delete a medical record (patient can delete own records)
// @access  Private (patient)
// ──────────────────────────────────────────────
router.delete('/:id', protect, authorize('patient'), async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    if (record.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this record' });
    }

    await MedicalRecord.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   GET /api/records/patient/:patientId
// @desc    Get medical records for a specific patient (doctor view)
// @access  Private (doctor)
// ──────────────────────────────────────────────
router.get('/patient/:patientId', protect, authorize('doctor'), async (req, res) => {
  try {
    const records = await MedicalRecord.find({ patient: req.params.patientId })
      .sort({ date: -1 });

    res.json({ success: true, count: records.length, records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
// @route   POST /api/records/doctor-add
// @desc    Doctor adds a record to a patient
// @access  Private (doctor)
// ──────────────────────────────────────────────
router.post('/doctor-add', protect, authorize('doctor'), async (req, res) => {
  try {
    const { patientId, title, type, description, diagnosis, medications, date, appointmentId } = req.body;

    const doctorProfile = await Doctor.findOne({ user: req.user._id });
    if (!doctorProfile) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    const record = await MedicalRecord.create({
      patient: patientId,
      doctor: doctorProfile._id,
      appointment: appointmentId || null,
      title,
      type: type || 'Diagnosis',
      description: description || '',
      diagnosis: diagnosis || '',
      medications: medications || [],
      date: date || getLocalDateString(),
      addedBy: 'doctor',
    });

    res.status(201).json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
