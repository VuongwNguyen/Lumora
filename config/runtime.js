const PARTNER_EQUIVALENT_PLAN = 'pro';

function getEntitlementBypassMode({ role } = {}) {
  if (role === 'admin') return 'admin';
  return null;
}

function getRoleEntitlementPlan({ role } = {}) {
  if (role === 'partner') return PARTNER_EQUIVALENT_PLAN;
  return null;
}

function hasEntitlementBypass(options = {}) {
  return getEntitlementBypassMode(options) !== null;
}

module.exports = {
  PARTNER_EQUIVALENT_PLAN,
  getEntitlementBypassMode,
  getRoleEntitlementPlan,
  hasEntitlementBypass,
};
