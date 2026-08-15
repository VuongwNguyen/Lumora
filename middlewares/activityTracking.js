const crypto = require('crypto');
const ActivityService = require('../services/activity.service');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{1,100}$/;

function normalizeRoute(value = '') {
  return String(value).split('?')[0]
    .replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id')
    .replace(/\/\d{5,}(?=\/|$)/g, '/:id')
    .slice(0, 500);
}

function getClientIp(req) {
  const raw = req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] ||
    String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';
  return String(raw).replace(/^::ffff:/, '').slice(0, 100);
}

function requestId(req) {
  const supplied = String(req.headers['x-request-id'] || '');
  return REQUEST_ID_RE.test(supplied) ? supplied : crypto.randomUUID();
}

function contextFromRequest(req) {
  const sessionId = String(req.headers['x-activity-session'] || '');
  const anonymousId = String(req.headers['x-anonymous-id'] || '');
  return {
    userId: req.user?._id || null,
    clientIp: getClientIp(req),
    requestId: req.activityRequestId,
    sessionId: UUID_RE.test(sessionId) ? sessionId : null,
    anonymousId: UUID_RE.test(anonymousId) ? anonymousId : null,
  };
}

function shouldSkip(req) {
  return /^\/(activity|admin)(\/|$)/.test(req.path || '');
}

function domainOperation(method, path) {
  const key = method.toUpperCase() + ' ' + normalizeRoute(path);
  const rules = [
    [/^POST \/auth\/register$/, 'Auth Register Server Result'],
    [/^POST \/auth\/verify-otp$/, 'Auth OTP Verify Server Result'],
    [/^POST \/auth\/login$/, 'Auth Login Server Result'],
    [/^POST \/auth\/reset-password$/, 'Auth Password Reset Server Result'],
    [/^PUT \/auth\/change-password$/, 'Auth Password Change Server Result'],
    [/^DELETE \/auth\/account$/, 'Auth Account Delete Server Result'],
    [/^POST \/galaxies\/?$/, 'Galaxy Create Server Result'],
    [/^PUT \/galaxies\/:id$/, 'Galaxy Update Server Result'],
    [/^DELETE \/galaxies\/:id$/, 'Galaxy Delete Server Result'],
    [/^POST \/gallary\/upload$/, 'Gallery Upload Server Result'],
    [/^POST \/gallary\/items\/bulk-delete$/, 'Gallery Bulk Delete Server Result'],
    [/^DELETE \/gallary\/items\/:id$/, 'Gallery Delete Server Result'],
    [/^POST \/payment\/create$/, 'Payment Checkout Server Result'],
    [/^POST \/support\/requests$/, 'Support Request Server Result'],
  ];
  for (const [matcher, action] of rules) {
    if (matcher.test(key)) return action;
  }
  return null;
}

function safeLog(payload, req, extraContext = {}) {
  if (!ActivityService.isEnabled()) return;
  ActivityService.createServer(payload, { ...contextFromRequest(req), ...extraContext }).catch(error => {
    if (process.env.NODE_ENV !== 'production') console.warn('[activity] server event failed:', error.message);
  });
}

function activityRequestContext(req, res, next) {
  req.activityRequestId = requestId(req);
  req.activityStartedAt = Date.now();
  res.setHeader('X-Request-Id', req.activityRequestId);

  res.once('finish', () => {
    if (shouldSkip(req)) return;
    const durationMs = Date.now() - req.activityStartedAt;
    const route = normalizeRoute(req.originalUrl || req.path);
    const baseMeta = {
      route, method: req.method, statusCode: res.statusCode, durationMs,
      requestId: req.activityRequestId, role: req.user?.role || 'anonymous',
    };
    const optedOut = req.headers['x-activity-opt-out'] === 'true';

    if (res.statusCode >= 400 && process.env.ACTIVITY_LOG_SERVER_ERRORS !== 'false') {
      safeLog({
        action: 'Server Request Failed', feature: 'reliability',
        level: res.statusCode >= 500 ? 'error' : 'warn', status: 0,
        requestId: req.activityRequestId, path: route,
        metadata: {
          ...baseMeta,
          errorType: res.statusCode === 429 ? 'rate_limited' : (res.statusCode >= 500 ? 'server_error' : 'client_error'),
        },
      }, req);
    }

    if (!optedOut && durationMs >= 2000 && process.env.ACTIVITY_LOG_SLOW_REQUESTS !== 'false') {
      safeLog({
        action: 'Server Request Slow', feature: 'reliability', level: 'warn',
        requestId: req.activityRequestId, path: route, metadata: baseMeta,
      }, req);
    }

    const domainAction = optedOut ? null : domainOperation(req.method, route);
    if (domainAction) {
      safeLog({
        action: domainAction, status: res.statusCode < 400 ? 1 : 0,
        requestId: req.activityRequestId, path: route, metadata: baseMeta,
      }, req);
    }
  });
  next();
}

function logUnhandledError(req, err) {
  if (shouldSkip(req) || process.env.ACTIVITY_LOG_SERVER_ERRORS === 'false') return;
  const statusCode = err.statusCode || err.status || 500;
  if (statusCode < 500) return;
  safeLog({
    action: 'Server Unhandled Error', feature: 'reliability',
    level: statusCode >= 500 ? 'error' : 'warn', status: 0,
    requestId: req.activityRequestId, path: normalizeRoute(req.originalUrl || req.path),
    metadata: {
      route: normalizeRoute(req.originalUrl || req.path), method: req.method, statusCode,
      durationMs: Date.now() - (req.activityStartedAt || Date.now()), requestId: req.activityRequestId,
      errorType: statusCode >= 500 ? 'server_error' : 'client_error', errorMsg: err.message,
    },
  }, req);
}

module.exports = {
  activityRequestContext,
  contextFromRequest,
  domainOperation,
  getClientIp,
  logUnhandledError,
  normalizeRoute,
  safeLog,
};
