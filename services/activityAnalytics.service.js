const { Types } = require('mongoose');
const ActivityModel = require('../models/activity');
const { ACTIVITY_FEATURES, ACTIVITY_LEVELS } = require('../config/activityFeatures');

const MAX_RANGE_DAYS = 180;
const FUNNEL_STEPS = Object.freeze([
  ['landing', ['Landing Hero Start Click', 'Landing Header Start Click', 'Landing Bottom Start Click']],
  ['registration', ['Auth Register Result', 'Auth Register Server Result']],
  ['login', ['Auth Login Result', 'Auth Login Server Result']],
  ['firstGalaxy', ['Portal Galaxy Create Result', 'Galaxy Create Server Result']],
  ['setup', ['Galaxy Setup Loaded', 'View Galaxy Setup Page']],
  ['checkout', ['Payment Checkout Result', 'Payment Checkout Server Result']],
  ['paid', ['Payment Succeeded']],
]);

function boundedInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, max)) : fallback;
}

function parseRange(query = {}) {
  const now = new Date();
  let end = query.endDate ? new Date(query.endDate) : now;
  if (Number.isNaN(end.getTime()) || end > now) end = now;
  let start = query.startDate ? new Date(query.startDate) : new Date(end.getTime() - 7 * 86400000);
  if (Number.isNaN(start.getTime())) start = new Date(end.getTime() - 7 * 86400000);
  const earliest = new Date(end.getTime() - MAX_RANGE_DAYS * 86400000);
  if (start < earliest) start = earliest;
  if (start > end) start = new Date(end.getTime() - 86400000);
  return { start, end };
}

function buildFilter(query = {}) {
  const { start, end } = parseRange(query);
  const filter = { createdAt: { $gte: start, $lte: end } };
  if (ACTIVITY_FEATURES.includes(query.feature)) filter.feature = query.feature;
  if (ACTIVITY_LEVELS.includes(query.level)) filter.level = query.level;
  if (typeof query.action === 'string' && query.action.trim()) filter.action = query.action.trim().slice(0, 160);
  // `page` is reserved for result pagination. Use `activityPage` when
  // filtering by the logical application page to avoid `page=1` becoming
  // an impossible `{ page: "1" }` activity filter.
  if (typeof query.activityPage === 'string' && /^[a-z0-9_-]{1,64}$/.test(query.activityPage)) {
    filter.page = query.activityPage;
  }
  if (typeof query.sessionId === 'string' && /^[0-9a-f-]{36}$/i.test(query.sessionId)) filter.sessionId = query.sessionId;
  if (typeof query.requestId === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(query.requestId)) filter.requestId = query.requestId;
  if (typeof query.errorType === 'string' && /^[a-z0-9_]{1,80}$/.test(query.errorType)) filter['metadata.errorType'] = query.errorType;
  if (query.actor === 'authenticated') filter.userId = { $ne: null };
  if (query.actor === 'anonymous') filter.userId = null;
  if (Types.ObjectId.isValid(query.galaxyId)) filter.galaxyId = new Types.ObjectId(query.galaxyId);
  return filter;
}

function publicActivity(document) {
  return {
    _id: document._id,
    action: document.action,
    feature: document.feature,
    level: document.level,
    actor: document.userId ? `user:${String(document.userId).slice(-8)}` : `anon:${String(document.anonymousId || '').slice(-8)}`,
    sessionId: document.sessionId || null,
    requestId: document.requestId || null,
    galaxyId: document.galaxyId || null,
    paymentId: document.paymentId || null,
    page: document.page,
    path: document.path,
    description: document.description,
    metadata: document.metadata || {},
    startedAt: document.startedAt,
    endedAt: document.endedAt,
    createdAt: document.createdAt,
  };
}

class ActivityAnalyticsService {
  async list(query = {}) {
    const page = boundedInt(query.page, 1, 100000);
    const limit = boundedInt(query.limit, 50, 100);
    const filter = buildFilter(query);
    const [rows, total] = await Promise.all([
      ActivityModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ActivityModel.countDocuments(filter),
    ]);
    return { activities: rows.map(publicActivity), total, page, limit };
  }

  async overview(query = {}) {
    const filter = buildFilter(query);
    const [summary] = await ActivityModel.aggregate([
      { $match: filter },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        sessions: { $addToSet: '$sessionId' },
        errors: { $sum: { $cond: [{ $in: ['$level', ['error', 'fatal']] }, 1, 0] } },
        warnings: { $sum: { $cond: [{ $eq: ['$level', 'warn'] }, 1, 0] } },
        authenticated: { $sum: { $cond: [{ $ne: ['$userId', null] }, 1, 0] } },
      } },
      { $project: {
        _id: 0, total: 1, errors: 1, warnings: 1, authenticated: 1,
        activeSessions: { $size: { $setDifference: ['$sessions', [null]] } },
        errorRate: { $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$errors', '$total'] }, 100] }, 0] },
      } },
    ]);
    return summary || { total: 0, activeSessions: 0, errors: 0, warnings: 0, authenticated: 0, errorRate: 0 };
  }

  async grouped(query, groupId, extraMatch = {}) {
    const limit = boundedInt(query.limit, 20, 100);
    return ActivityModel.aggregate([
      { $match: { ...buildFilter(query), ...extraMatch } },
      { $group: { _id: groupId, count: { $sum: 1 }, lastSeenAt: { $max: '$createdAt' }, avgDurationMs: { $avg: '$metadata.durationMs' } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
  }

  actions(query = {}) {
    return this.grouped(query, { action: '$action', feature: '$feature' });
  }

  errors(query = {}) {
    return this.grouped(query, {
      errorType: { $ifNull: ['$metadata.errorType', 'unknown'] },
      action: '$action', endpoint: { $ifNull: ['$metadata.endpoint', '$metadata.route'] },
    }, { level: { $in: ['error', 'fatal'] } });
  }

  blocked(query = {}) {
    return this.grouped(query, { action: '$action', reason: { $ifNull: ['$metadata.reason', 'unknown'] } }, { action: /Blocked$/ });
  }

  async performance(query = {}) {
    const limit = boundedInt(query.limit, 20, 100);
    const rows = await ActivityModel.aggregate([
      { $match: { ...buildFilter(query), 'metadata.durationMs': { $type: 'number' } } },
      { $project: { action: 1, endpoint: { $ifNull: ['$metadata.endpoint', '$metadata.route'] }, durationMs: '$metadata.durationMs' } },
      { $limit: 50000 },
      { $group: {
        _id: { action: '$action', endpoint: '$endpoint' }, count: { $sum: 1 },
        avgDurationMs: { $avg: '$durationMs' }, maxDurationMs: { $max: '$durationMs' }, durations: { $push: '$durationMs' },
      } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    return rows.map(row => {
      const durations = row.durations.sort((a, b) => a - b);
      const percentile = value => durations[Math.min(durations.length - 1, Math.floor((durations.length - 1) * value))] || 0;
      return { ...row, durations: undefined, p50DurationMs: percentile(0.5), p90DurationMs: percentile(0.9) };
    });
  }

  async journey(sessionId, query = {}) {
    if (!/^[0-9a-f-]{36}$/i.test(sessionId || '')) return [];
    const limit = boundedInt(query.limit, 500, 1000);
    const rows = await ActivityModel.find({ ...buildFilter(query), sessionId })
      .sort({ createdAt: 1 }).limit(limit).lean();
    return rows.map(publicActivity);
  }

  async funnel(query = {}) {
    const filter = buildFilter(query);
    const actionNames = FUNNEL_STEPS.flatMap(([, actions]) => actions);
    const rows = await ActivityModel.aggregate([
      { $match: { ...filter, action: { $in: actionNames } } },
      { $project: {
        sessionId: 1,
        step: { $switch: {
          branches: FUNNEL_STEPS.map(([step, actions]) => ({ case: { $in: ['$action', actions] }, then: step })),
          default: 'other',
        } },
      } },
      { $group: { _id: '$step', events: { $sum: 1 }, sessionIds: { $addToSet: '$sessionId' } } },
      { $project: { events: 1, sessions: { $size: { $setDifference: ['$sessionIds', [null]] } } } },
    ]);
    const byStep = new Map(rows.map(row => [row._id, row]));
    return FUNNEL_STEPS.map(([step]) => ({
      step, events: byStep.get(step)?.events || 0, sessions: byStep.get(step)?.sessions || 0,
    }));
  }
}

module.exports = new ActivityAnalyticsService();
module.exports.buildFilter = buildFilter;
module.exports.parseRange = parseRange;
