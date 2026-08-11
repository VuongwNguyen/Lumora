// middlewares/subscription.js
const SubscriptionModel = require('../models/subscription');
const { errorResponse } = require('../context/responseHandle');
const { PLAN_RANK } = require('../config/plans');
const { getEntitlementBypassMode, getRoleEntitlementPlan } = require('../config/runtime');

const requireSubscription = (minPlan) => async (req, res, next) => {
  const accessMode = getEntitlementBypassMode({ role: req.user.role });
  if (accessMode === 'admin') return next();
  const rolePlan = getRoleEntitlementPlan({ role: req.user.role });
  if (rolePlan) {
    const roleRank = PLAN_RANK[rolePlan] ?? -1;
    const requiredRank = PLAN_RANK[minPlan];
    if (requiredRank != null && roleRank >= requiredRank) {
      req.subscription = { plan: rolePlan, accessMode: 'partner', grantedByRole: true };
      return next();
    }
    return next(new errorResponse({ message: minPlan + ' plan or higher required', statusCode: 403 }));
  }
  try {
    const sub = await SubscriptionModel.findOne({
      userId: req.user._id,
      status: 'active',
      isSimulation: { $ne: true },
    });

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
