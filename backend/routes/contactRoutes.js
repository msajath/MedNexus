const { limiter } = require('../middleware/security');
const errorHandler = require('../middleware/errorHandler');
const express = require('express');
const { body, validationResult } = require('express-validator');
const ContactMessage = require('../models/ContactMessage');

const router = express.Router();

router.post(
  '/',
  limiter(5, 60 * 60 * 1000),
  [
    body('name').isString().bail().trim().isLength({ min: 1, max: 120 }).withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
    body('subject').isString().bail().trim().isLength({ min: 1, max: 200 }).withMessage('Subject is required'),
    body('message').isString().bail().trim().isLength({ min: 10, max: 5000 }).withMessage('Message must be between 10 and 5000 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array().map(({ msg, path }) => ({ msg, path })) });

    try {
      const { name, email, subject, message } = req.body;
      await ContactMessage.create({ name, email, subject, message });
      return res.status(201).json({ success: true, message: 'Your message has been received' });
    } catch (error) {
      return errorHandler(error, req, res, () => {});
    }
  },
);

module.exports = router;
