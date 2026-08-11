// middlewares/subscription.js
const SubscriptionModel = require('../models/subscription');
const { errorResponse } = require('../context/responseHandle');
const { PLAN_RANK } = require('../config/plans');
const { hasEntitlementBypass } = require('../config/runtime');

const requireSubscription = (minPlan) => async (req, res, next) => {
  if (hasEntitlementBypass({ role: req.user.role })) return next();
  try {
    const sub = await SubscriptionModel.findOne({ userId: req.user._id, status: 'active' });

    if (!sub || sub.expiredAt < new Date()) {
      if (sub) {
        await SubscriptionModel.findByIdAndUpdate(sub._id, { status: 'expired' });
      }
      return next(new errorResponse({ message: 'Active subscription required', statusCode: 403 }));
    }

    const currentRank = PLAN_RANK[sub.plan] ?? -1;
    const requiredRank = PLAN_RANK[minPlan];
    if (requiredRank == null || currentRank < requiredRank) {
      return next(new errorResponse({ message: minPlan + ' plan or higher required', statusCode: 403 }));
    }

    req.subscription = sub;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireSubscription };
