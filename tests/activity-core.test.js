const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'activity-test-secret';
process.env.NODE_ENV = 'test';
process.env.ACTIVITY_TRACKING_ENABLED = 'false';

const { deriveFeature, deriveLevel } = require('../config/activityFeatures');
const { redactString, sanitizeMetadata } = require('../config/activityErrors');
const ActivityModel = require('../models/activity');
const ActivityService = require('../services/activity.service');
const {
  ActivityValidationError,
  normalizeActivityPayload,
} = ActivityService;
const clientLogger = require('../public/shared/js/activityLogger');
const jwt = require('jsonwebtoken');
const { optionalAuth } = require('../middlewares/auth');

const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const SESSION_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

test('development mode never enables activity persistence', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalToggle = process.env.ACTIVITY_TRACKING_ENABLED;
  try {
    process.env.NODE_ENV = 'development';
    process.env.ACTIVITY_TRACKING_ENABLED = 'true';
    assert.equal(ActivityService.isEnabled(), false);

    process.env.NODE_ENV = 'production';
    assert.equal(ActivityService.isEnabled(), true);
    process.env.ACTIVITY_TRACKING_ENABLED = 'false';
    assert.equal(ActivityService.isEnabled(), false);
  } finally {
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
    if (originalToggle === undefined) delete process.env.ACTIVITY_TRACKING_ENABLED;
    else process.env.ACTIVITY_TRACKING_ENABLED = originalToggle;
  }
});

test('feature and level are derived with Arena-compatible semantics', () => {
  assert.equal(deriveFeature('Galaxy Photo Upload Result'), 'galaxy');
  assert.equal(deriveFeature('Payment Checkout Result'), 'payment');
  assert.equal(deriveFeature('API Error'), 'reliability');
  assert.equal(deriveLevel({ status: 0 }), 'error');
  assert.equal(deriveLevel({ explicitLevel: 'warn', status: 0 }), 'warn');
  assert.equal(deriveLevel({ errorType: 'unknown' }), 'info');
});

test('credentials are recursively redacted and strings are truncated', () => {
  const clean = sanitizeMetadata({
    password: 'plain-secret',
    nested: { authorization: 'Bearer abc.def.ghi', url: '/x?token=secret&ok=1' },
  });
  assert.equal(clean.password, '[REDACTED]');
  assert.equal(clean.nested.authorization, '[REDACTED]');
  assert.equal(clean.nested.url, '/x?token=***&ok=1');
  assert.match(redactString('Bearer abc.def.ghi'), /Bearer \*\*\*/);
  assert.equal(redactString('User alice@example.com failed'), 'User ***@example.com failed');
  assert.match(redactString('x'.repeat(2100)), /\[truncated\]$/);
});

test('server normalization strips query data and ignores spoofed userId', () => {
  const normalized = normalizeActivityPayload({
    action: 'Galaxy Photo Upload Result',
    status: 0,
    userId: '000000000000000000000000',
    anonymousId: DEVICE_ID,
    sessionId: SESSION_ID,
    page: 'galaxy_setup',
    path: '/portal/galaxy-setup.html?token=secret#caption',
    description: { errorType: 'photo_upload_fail', otp: '123456' },
  }, {
    userId: '111111111111111111111111',
    clientIp: '127.0.0.1',
  });

  assert.equal(normalized.userId, '111111111111111111111111');
  assert.equal(normalized.path, '/portal/galaxy-setup.html');
  assert.equal(normalized.feature, 'galaxy');
  assert.equal(normalized.level, 'error');
  assert.equal(normalized.metadata.otp, '[REDACTED]');
  assert.equal(normalized.metadata.sessionId, SESSION_ID);
  assert.match(normalized.metadata.errorTypeDescription, /Tải ảnh/);
});

test('invalid activity payload returns field-level validation issues', () => {
  assert.throws(
    () => normalizeActivityPayload({ action: '', anonymousId: 'not-a-uuid', page: 'Bad Page' }),
    error => {
      assert.ok(error instanceof ActivityValidationError);
      assert.deepEqual(error.issues.map(issue => issue.field).sort(), ['action', 'anonymousId', 'page']);
      return true;
    },
  );
  assert.throws(
    () => normalizeActivityPayload({ action: 'Email alice@example.com clicked' }),
    error => error instanceof ActivityValidationError && error.issues.some(issue => issue.field === 'action'),
  );
});

test('activity model declares an absolute TTL index', () => {
  const ttlIndex = ActivityModel.schema.indexes().find(([keys]) => keys.expiresAt === 1);
  assert.ok(ttlIndex);
  assert.equal(ttlIndex[1].expireAfterSeconds, 0);
});

test('optional auth attaches only a correctly signed JWT and never blocks anonymous tracking', () => {
  const validToken = jwt.sign({ _id: '111111111111111111111111', role: 'user' }, process.env.JWT_SECRET);
  const validReq = { headers: { authorization: 'Bearer ' + validToken } };
  let validNext = false;
  optionalAuth(validReq, {}, () => { validNext = true; });
  assert.equal(validNext, true);
  assert.equal(validReq.user._id, '111111111111111111111111');

  const invalidReq = { headers: { authorization: 'Bearer invalid-token' } };
  let invalidNext = false;
  optionalAuth(invalidReq, {}, () => { invalidNext = true; });
  assert.equal(invalidNext, true);
  assert.equal(invalidReq.user, undefined);
});

test('browser logger builds a sanitized fire-and-forget payload', () => {
  const payload = clientLogger.buildActivity({
    action: 'Payment Checkout Result',
    status: 0,
    path: '/portal/?signature=secret',
    description: {
      errorType: 'timeout',
      password: 'plain-secret',
      nested: { Authorization: 'Bearer abc.def.ghi' },
    },
  });

  assert.equal(payload.feature, 'payment');
  assert.equal(payload.level, 'error');
  assert.equal(payload.path, '/portal/');
  assert.equal(payload.metadata.password, '[REDACTED]');
  assert.equal(payload.metadata.nested.Authorization, '[REDACTED]');
  assert.match(payload.metadata.errorTypeDescription, /quá thời gian/);
});

test('POST /activity/add accepts valid anonymous activity without a database when disabled', async t => {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/activity', require('../routes/activity.routes'));
  app.use((err, req, res, next) => {
    res.status(500).json({ ok: false, error: err.message });
  });

  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const validResponse = await fetch(baseUrl + '/activity/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'View Landing Page',
      anonymousId: DEVICE_ID,
      sessionId: SESSION_ID,
      page: 'landing',
      path: '/?token=secret',
    }),
  });
  const validBody = await validResponse.json();
  assert.equal(validResponse.status, 200);
  assert.equal(validBody.ok, true);
  assert.equal(validBody.disabled, true);
  assert.equal(validBody.id, null);

  const invalidResponse = await fetch(baseUrl + '/activity/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: '', page: 'Bad Page' }),
  });
  const invalidBody = await invalidResponse.json();
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidBody.ok, false);
  assert.equal(invalidBody.error, 'validation_error');

  const oversizedResponse = await fetch(baseUrl + '/activity/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'View Landing Page', description: 'x'.repeat(33 * 1024) }),
  });
  const oversizedBody = await oversizedResponse.json();
  assert.equal(oversizedResponse.status, 413);
  assert.equal(oversizedBody.error, 'payload_too_large');
});
