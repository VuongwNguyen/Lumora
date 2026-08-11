function isDevelopmentBypass(env = process.env) {
  const nodeEnv = String(env.NODE_ENV || '').toLowerCase();
  if (nodeEnv === 'production' || nodeEnv === 'test') return false;
  const developmentMode = nodeEnv === 'development' || env.npm_lifecycle_event === 'dev';
  if (!developmentMode) return false;
  return String(env.DEV_BYPASS_LOCKS || 'true').toLowerCase() !== 'false';
}

function getEntitlementBypassMode({ role, env = process.env } = {}) {
  if (role === 'admin') return 'admin';
  if (isDevelopmentBypass(env)) return 'development';
  if (role === 'partner') return 'partner';
  return null;
}

function hasEntitlementBypass(options = {}) {
  return getEntitlementBypassMode(options) !== null;
}

module.exports = { isDevelopmentBypass, getEntitlementBypassMode, hasEntitlementBypass };
