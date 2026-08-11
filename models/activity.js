const { model, Schema } = require('mongoose');
const { ACTIVITY_FEATURES, ACTIVITY_LEVELS } = require('../config/activityFeatures');

const activitySchema = new Schema({
  action: { type: String, required: true, trim: true, maxlength: 160, index: true },
  feature: { type: String, enum: ACTIVITY_FEATURES, required: true, index: true },
  level: { type: String, enum: ACTIVITY_LEVELS, default: 'info', index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  clientIp: { type: String, default: '' },
  anonymousId: { type: String, default: null, index: true },
  deviceId: { type: String, default: null },
  sessionId: { type: String, default: null, index: true },
  requestId: { type: String, default: null, index: true },
  dedupKey: { type: String, maxlength: 200 },
  galaxyId: { type: Schema.Types.ObjectId, ref: 'Galaxy', default: null, index: true },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
  page: { type: String, default: 'unknown', maxlength: 64 },
  path: { type: String, default: '', maxlength: 500 },
  description: { type: String, default: null, maxlength: 2000 },
  metadata: { type: Schema.Types.Mixed, default: {} },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false, strict: true });

activitySchema.index({ feature: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });
activitySchema.index({ level: 1, createdAt: -1 });
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ anonymousId: 1, createdAt: -1 });
activitySchema.index({ sessionId: 1, createdAt: 1 });
activitySchema.index({ galaxyId: 1, createdAt: -1 });
activitySchema.index({ dedupKey: 1 }, { unique: true, sparse: true });
activitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model('Activity', activitySchema, 'activities');
