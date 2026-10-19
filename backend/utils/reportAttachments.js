const MAX_REPORT_BYTES = 700 * 1024;
const supportedTypes = {
  'application/pdf': /\.pdf$/i,
  'image/png': /\.png$/i,
  'image/jpeg': /\.jpe?g$/i,
  'image/webp': /\.webp$/i,
};

const isValidReportAttachment = (attachment) => {
  if (!attachment || typeof attachment !== 'object') return false;
  const { name, type, url } = attachment;
  if (typeof name !== 'string' || name.length < 1 || name.length > 200 ||
      /[\\/\x00-\x1f]/.test(name) || !Object.hasOwn(supportedTypes, type) || !supportedTypes[type].test(name) || typeof url !== 'string') return false;
  const match = url.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[1] !== type || match[2].length > Math.ceil(MAX_REPORT_BYTES / 3) * 4) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_REPORT_BYTES || bytes.toString('base64') !== match[2]) return false;
  if (type === 'application/pdf') return bytes.subarray(0, 5).toString() === '%PDF-';
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (type === 'image/jpeg') return bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
  return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
};

module.exports = { MAX_REPORT_BYTES, isValidReportAttachment };
