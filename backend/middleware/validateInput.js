const { body, query, validationResult } = require('express-validator');
const { isValidDate } = require('../utils/slots');
const text = (field, max, optional = true) => {
  const rule = body(field);
  return (optional ? rule.optional() : rule).isString().bail().trim().isLength({ min: optional ? 0 : 1, max });
};
const password = (field) => body(field).isString().bail().isLength({ min: 15, max: 72 })
  .custom((value) => Buffer.byteLength(value, 'utf8') <= 72)
  .withMessage('Password must be at least 15 characters and at most 72 UTF-8 bytes');
const check = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array().map(({ msg, path }) => ({ msg, path })) });
  next();
};
const doctorRules = [text('specialty', 120), body('fee').optional().isFloat({ min: 0, max: 1000000 }),
  text('experience', 120), text('location', 300), text('bio', 10000), text('licenseNumber', 120),
  body('available').optional().isBoolean({ strict: true }), body('languages').optional().isArray({ max: 20 }),
  text('languages.*', 100), body('education').optional().isArray({ max: 30 }),
  text('education.*.degree', 200), text('education.*.institution', 200), text('education.*.year', 40),
  body('experienceHistory').optional().isArray({ max: 30 }), text('experienceHistory.*.title', 200),
  text('experienceHistory.*.hospital', 200), text('experienceHistory.*.period', 100)];
const profileRules = [text('name', 120), text('phone', 40), text('address', 1000),
  body('dob').optional().custom((value) => value === '' || isValidDate(value)),
  body('gender').optional().isIn(['Male', 'Female', 'Other', '']),
  body('bloodType').optional().isIn(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown', '']),
  body('avatar').optional({ nullable: true }).isString().bail().isLength({ max: 2800000 })
    .custom((value) => /^\/images\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(value) ||
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)), ...doctorRules];
const recordRules = [text('title', 200, false), body('type').optional().isIn(['Prescription', 'Lab Report', 'Diagnosis', 'Vaccination', 'Imaging', 'Discharge Summary', 'Other']),
  text('description', 10000), text('diagnosis', 10000), body('date').optional().custom(isValidDate),
  body('isPrivate').optional().isBoolean({ strict: true }), body('medications').optional().isArray({ max: 100 }),
  text('medications.*.name', 200, false), text('medications.*.dosage', 200), text('medications.*.frequency', 200), text('medications.*.duration', 200),
  body('attachments').optional().isArray({ max: 10 }), text('attachments.*.name', 200, false),
  body('attachments.*.url').optional().isString().bail().isLength({ max: 1000000 }).custom((value) => /^https:\/\//.test(value) || /^data:(application\/pdf|image\/(png|jpeg|webp));base64,[A-Za-z0-9+/]+=*$/.test(value)),
  text('attachments.*.type', 100)];
const scheduleRules = [body('schedule').isArray({ min: 7, max: 7 }).bail().custom((schedule) => {
  const days = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  for (const item of schedule) {
    if (!item || !days.delete(item.day) || typeof item.enabled !== 'boolean' ||
        !/^([01]\d|2[0-3]):(00|30)$/.test(item.start) || !/^([01]\d|2[0-3]):(00|30)$/.test(item.end) ||
        (item.enabled && (item.start >= item.end || (Number(item.end.slice(0, 2)) * 60 + Number(item.end.slice(3)) - Number(item.start.slice(0, 2)) * 60 - Number(item.start.slice(3)) < 30)))) return false;
  }
  return days.size === 0;
}).withMessage('Provide seven unique days with half-hour times and at least 30 minutes for each enabled day')];
module.exports = { body, query, text, password, check, doctorRules, profileRules, recordRules, scheduleRules };
