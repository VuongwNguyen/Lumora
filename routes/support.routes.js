const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const asyncHandler = require('../context/asyncHandler');
const SupportController = require('../controllers/support.controller');

const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: false, message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.', statusCode: 429 },
  skip: () => process.env.NODE_ENV !== 'production',
});

router.post('/requests', supportLimiter, asyncHandler(SupportController.create));

module.exports = router;
