const { MAX_REPORT_BYTES, isValidReportAttachment } = require('../utils/reportAttachments');

const attachment = (name, type, bytes) => ({ name, type, url: `data:${type};base64,${bytes.toString('base64')}` });

test('accepts a PDF signature and rejects renamed executable content', () => {
  expect(isValidReportAttachment(attachment('report.pdf', 'application/pdf', Buffer.from('%PDF-1.4\nreport')))).toBe(true);
  expect(isValidReportAttachment(attachment('report.pdf', 'application/pdf', Buffer.from('<script>alert(1)</script>')))).toBe(false);
  expect(isValidReportAttachment(attachment('../report.pdf', 'application/pdf', Buffer.from('%PDF-1.4')))).toBe(false);
});

test('rejects malformed attachment values, MIME types, and oversized reports', () => {
  expect(isValidReportAttachment(null)).toBe(false);
  expect(isValidReportAttachment({ name: 'x.pdf', type: 'toString', url: 'data:toString;base64,AA==' })).toBe(false);
  expect(isValidReportAttachment(attachment('large.pdf', 'application/pdf', Buffer.concat([
    Buffer.from('%PDF-'), Buffer.alloc(MAX_REPORT_BYTES),
  ])))).toBe(false);
});
