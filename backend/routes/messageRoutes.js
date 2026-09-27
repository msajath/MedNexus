const express = require('express');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();
router.use(protect);

router.get('/', async (req, res) => {
  try {
    const messages = await Message.find({ recipient: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, count: messages.length, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/read', validateObjectId('id'), async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true },
    );
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    return res.json({ success: true, message });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
