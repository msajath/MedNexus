const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (!hasSmtpConfig) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

const sendMail = async ({ to, subject, text, html }) => {
  const mailFrom = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@localhost';
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP is not configured');
    }
    console.warn(`[mailer] SMTP not configured. Skipping email to ${to}.`);
    console.log(`
[mailer] Subject: ${subject}
[mailer] To: ${to}
[mailer] Text:\n${text}
`);
    return { skipped: true };
  }

  return activeTransporter.sendMail({
    from: mailFrom,
    to,
    subject,
    text,
    html,
  });
};

module.exports = { sendMail };
