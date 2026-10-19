const mongoose = require('mongoose');
const MedicalRecord = require('../models/MedicalRecord');

test('accepts a named report attachment with its MIME type and data URL', () => {
  const record = new MedicalRecord({
    patient: new mongoose.Types.ObjectId(), title: 'Lab report', date: '2026-10-20',
    attachments: [{ name: 'results.pdf', type: 'application/pdf',
      url: `data:application/pdf;base64,${Buffer.from('%PDF-1.4\nreport').toString('base64')}` }],
  });
  expect(record.validateSync()).toBeUndefined();
  expect(record.attachments[0].name).toBe('results.pdf');
  expect(record.attachments[0].type).toBe('application/pdf');
});
