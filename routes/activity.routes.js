const router = require('express').Router();
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const asyncHandler = require('../context/asyncHandler');
const { optionalAuth } = require('../middlewares/auth');
const { activityPayloadLimit } = require('../middlewares/activity');
const ActivityController = require('../controllers/activity.controller');

const activityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: req => req.user ? 600 : 300,
  keyGenerator: req => req.user ? `user:${req.user._id}` : `ip:${ipKeyGenerator(req.ip)}`,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
  message: { ok: false, error: 'rate_limited' },
});

router.post('/add', optionalAuth, activityLimiter, activityPayloadLimit, asyncHandler(ActivityController.add));

module.exports = router;
