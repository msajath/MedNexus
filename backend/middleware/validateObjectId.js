const mongoose = require('mongoose');

const validateObjectId = (paramName) => (req, res, next) => {
  const value = req.params[paramName];

  if (!mongoose.isObjectIdOrHexString(value)) {
    return res.status(400).json({
      success: false,
      message: `Invalid ${paramName}`,
    });
  }

  next();
};

module.exports = validateObjectId;
