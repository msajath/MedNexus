const mongoose = require('mongoose');

const validateObjectId = (fieldName, options = {}) => (req, res, next) => {
  const { source = 'params', optional = false } = options;
  const value = req[source]?.[fieldName];

  if (optional && (value === undefined || value === null || value === '')) {
    return next();
  }

  if (!mongoose.isObjectIdOrHexString(value)) {
    return res.status(400).json({
      success: false,
      message: `Invalid ${fieldName}`,
    });
  }

  next();
};

module.exports = validateObjectId;
