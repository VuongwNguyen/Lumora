const { Types } = require('mongoose');
const ActivityModel = require('../models/activity');
const { ACTIVITY_FEATURES, ACTIVITY_LEVELS, deriveFeature, deriveLevel } = require('../config/activityFeatures');
const { describeErrorType, redactString, sanitizeMetadata } = require('../config/activityErrors');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_RE = /^[a-z0-9_-]{1,64}$/;
const ACTION_RE = /^[A-Za-z][A-Za-z0-9 ()/_-]{0,159}$/;

class ActivityValidationError extends Error {
  constructor(issues) {
    super('Invalid activity payload');
    this.name = 'ActivityValidationError';
    this.issues = issues;
  }
}

function optionalString(value, maxLength) {
  if (value == null || value === '') return null;
  return redactString(value, maxLength);
}

function normalizePath(value) {
  if (!value) return '';
  try {
    return new URL(String(value), 'https://lumora.local').pathname.slice(0, 500);
  } catch {
    return String(value).split(/[?#]/)[0].slice(0, 500);
  }
}

function normalizeDate(value, field, issues) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    issues.push({ field, message: 'must be a valid ISO date' });
    return null;
  }
  return date;
}

function normalizeId(value, field, issues) {
  if (value == null || value === '') return null;
  if (!Types.ObjectId.isValid(value)) {
    issues.push({ field, message: 'must be a valid ObjectId' });
    return null;
  }
  return value;
}

function normalizeUuid(value, field, issues) {
  if (value == null || value === '') return null;
  if (!UUID_RE.test(String(value))) {
    issues.push({ field, message: 'must be a valid UUID' });
    return null;
  }
  return String(value).toLowerCase();
}

function getRetentionDays() {
  const configured = Number.parseInt(process.env.ACTIVITY_RAW_RETENTION_DAYS, 10);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 3650) : 180;
}

function normalizeActivityPayload(payload, context = {}) {
  const issues = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ActivityValidationError([{ field: 'body', message: 'must be an object' }]);
  }

  const action = typeof payload.action === 'string' ? payload.action.trim() : '';
  if (!action) issues.push({ field: 'action', message: 'is required' });
  if (action.length > 160) issues.push({ field: 'action', message: 'must be at most 160 characters' });
  if (action && !ACTION_RE.test(action)) issues.push({ field: 'action', message: 'must follow the activity naming convention' });

  let feature = deriveFeature(action);
  if (payload.feature != null) {
    if (!ACTIVITY_FEATURES.includes(payload.feature)) {
      issues.push({ field: 'feature', message: 'is not supported' });
    } else {
      feature = payload.feature;
    }
  }

  if (payload.level != null && !ACTIVITY_LEVELS.includes(payload.level)) {
    issues.push({ field: 'level', message: 'is not supported' });
  }
  if (payload.status != null && payload.status !== 0 && payload.status !== 1) {
    issues.push({ field: 'status', message: 'must be 0 or 1' });
  }

  const anonymousId = normalizeUuid(payload.anonymousId, 'anonymousId', issues);
  const deviceId = normalizeUuid(payload.deviceId, 'deviceId', issues);
  const sessionId = normalizeUuid(payload.sessionId, 'sessionId', issues);
  const galaxyId = normalizeId(payload.galaxyId, 'galaxyId', issues);
  const paymentId = normalizeId(payload.paymentId, 'paymentId', issues);
  const startedAt = normalizeDate(payload.startedAt, 'startedAt', issues);
  const endedAt = normalizeDate(payload.endedAt, 'endedAt', issues);
  if (startedAt && endedAt && endedAt < startedAt) {
    issues.push({ field: 'endedAt', message: 'must be after startedAt' });
  }

  const page = payload.page == null ? 'unknown' : String(payload.page).trim();
  if (!PAGE_RE.test(page)) issues.push({ field: 'page', message: 'must use lowercase letters, numbers, underscore or dash' });

  let description = null;
  let rawMetadata = {};
  if (typeof payload.description === 'string') {
    description = redactString(payload.description, 2000);
  } else if (payload.description && typeof payload.description === 'object' && !Array.isArray(payload.description)) {
    rawMetadata = { ...payload.description };
  } else if (payload.description != null) {
    issues.push({ field: 'description', message: 'must be a string or object' });
  }
  if (payload.metadata != null) {
    if (!payload.metadata || typeof payload.metadata !== 'object' || Array.isArray(payload.metadata)) {
      issues.push({ field: 'metadata', message: 'must be an object' });
    } else {
      rawMetadata = { ...rawMetadata, ...payload.metadata };
    }
  }

  if (payload.status != null) rawMetadata.status = payload.status;
  if (sessionId) rawMetadata.sessionId = sessionId;
  const metadata = sanitizeMetadata(rawMetadata);
  const errorType = typeof metadata.errorType === 'string' ? metadata.errorType : null;
  if (errorType && !metadata.errorTypeDescription) {
    metadata.errorTypeDescription = describeErrorType(errorType);
  }
  const level = deriveLevel({ explicitLevel: payload.level, status: payload.status, errorType });

  if (issues.length) throw new ActivityValidationError(issues);

  const now = new Date();
  return {
    action,
    feature,
    level,
    userId: context.userId || null,
    clientIp: optionalString(context.clientIp, 100) || '',
    anonymousId,
    deviceId: deviceId || anonymousId,
    sessionId,
    requestId: optionalString(context.requestId || payload.requestId, 100),
    galaxyId,
    paymentId,
    page,
    path: normalizePath(payload.path),
    description,
    metadata,
    startedAt,
    endedAt,
    createdAt: now,
    expiresAt: new Date(now.getTime() + getRetentionDays() * 24 * 60 * 60 * 1000),
  };
}

class ActivityService {
  isEnabled() {
    return process.env.ACTIVITY_TRACKING_ENABLED !== 'false';
  }

  async create(payload, context = {}) {
    const activity = normalizeActivityPayload(payload, context);
    if (!this.isEnabled()) return { disabled: true, activity };
    const document = await ActivityModel.create(activity);
    return { disabled: false, activity: document };
  }
}

module.exports = new ActivityService();
module.exports.ActivityValidationError = ActivityValidationError;
module.exports.normalizeActivityPayload = normalizeActivityPayload;
module.exports.getRetentionDays = getRetentionDays;
