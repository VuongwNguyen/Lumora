const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'activity-test-secret';
process.env.NODE_ENV = 'test';
process.env.ACTIVITY_TRACKING_ENABLED = 'false';

const ActivityModel = require('../models/activity');
const ActivityService = require('../services/activity.service');
const { buildFilter, parseRange } = require('../services/activityAnalytics.service');
const { activityRequestContext, domainOperation, normalizeRoute } = require('../middlewares/activityTracking');

const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const SESSION_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

test('server activity context supports deterministic deduplication without client spoofing', async () => {
  const result = await ActivityService.createServer({
    action: 'Payment Succeeded',
    status: 1,
    paymentId: '111111111111111111111111',
  }, {
    userId: '222222222222222222222222',
    sessionId: SESSION_ID,
    anonymousId: DEVICE_ID,
    requestId: 'request-123',
    dedupKey: 'payment:succeeded:111111111111111111111111',
  });

  assert.equal(result.disabled, true);
  assert.equal(result.activity.dedupKey, 'payment:succeeded:111111111111111111111111');
  assert.equal(result.activity.sessionId, SESSION_ID);
  assert.equal(String(result.activity.userId), '222222222222222222222222');

  const index = ActivityModel.schema.indexes().find(([keys]) => keys.dedupKey === 1);
  assert.ok(index);
  assert.equal(index[1].unique, true);
  assert.equal(index[1].sparse, true);
});

test('request routes are normalized and important mutations have stable server actions', () => {
  assert.equal(normalizeRoute('/galaxies/69abc3057a7d444cdd589f39?token=secret'), '/galaxies/:id');
  assert.equal(domainOperation('POST', '/auth/login'), 'Auth Login Server Result');
  assert.equal(domainOperation('PUT', '/galaxies/69abc3057a7d444cdd589f39'), 'Galaxy Update Server Result');
  assert.equal(domainOperation('GET', '/galaxies/69abc3057a7d444cdd589f39'), null);
});

test('browser opt-out suppresses server domain tracking but retains failed-request security logs', async () => {
  const originalEnabled = ActivityService.isEnabled;
  const originalCreateServer = ActivityService.createServer;
  const events = [];
  ActivityService.isEnabled = () => true;
  ActivityService.createServer = async payload => { events.push(payload); return { disabled: true, activity: payload }; };

  function finish(statusCode) {
    const req = {
      headers: { 'x-activity-opt-out': 'true' },
      path: '/auth/login', originalUrl: '/auth/login', method: 'POST', ip: '127.0.0.1',
    };
    const res = new EventEmitter();
    res.statusCode = statusCode;
    res.setHeader = () => {};
    activityRequestContext(req, res, () => {});
    res.emit('finish');
  }

  try {
    finish(200);
    assert.deepEqual(events, []);
    finish(500);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(events.map(event => event.action), ['Server Request Failed']);
  } finally {
    ActivityService.isEnabled = originalEnabled;
    ActivityService.createServer = originalCreateServer;
  }
});

test('analytics filters enforce allowlists and cap the query window at 180 days', () => {
  const range = parseRange({ startDate: '2020-01-01', endDate: new Date().toISOString() });
  assert.ok(range.end - range.start <= 180 * 86400000);

  const filter = buildFilter({
    feature: 'payment',
    level: 'error',
    sessionId: SESSION_ID,
    errorType: 'payment_webhook_invalid',
    actor: 'authenticated',
    dangerous: '{ "$where": "sleep(1000)" }',
  });
  assert.equal(filter.feature, 'payment');
  assert.equal(filter.level, 'error');
  assert.equal(filter.sessionId, SESSION_ID);
  assert.equal(filter['metadata.errorType'], 'payment_webhook_invalid');
  assert.deepEqual(filter.userId, { $ne: null });
  assert.equal(filter.dangerous, undefined);

  const paginationFilter = buildFilter({ page: '1' });
  assert.equal(paginationFilter.page, undefined);
  const logicalPageFilter = buildFilter({ activityPage: 'galaxy_setup' });
  assert.equal(logicalPageFilter.page, 'galaxy_setup');
});

test('tracked fetch logs API failures and mapped domain results without recursing', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/shared/js/trackedFetch.js'), 'utf8');
  const events = [];
  let nativeCalls = 0;
  const window = {
    location: { href: 'https://lumora.test/auth/', origin: 'https://lumora.test', pathname: '/auth/' },
    crypto: { randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    fetch: async () => {
      nativeCalls += 1;
      return { ok: false, status: 500, headers: { get: () => 'backend-request-id' } };
    },
    LumoraActivity: {
      getSessionId: () => SESSION_ID,
      getDeviceId: () => DEVICE_ID,
      classifyApiError: status => status >= 500 ? 'server_error' : 'unknown',
      log: event => events.push(event),
      logResult: (action, ok, metadata, error, extra) => events.push({ action, ok, metadata, error, extra }),
    },
  };
  vm.runInNewContext(source, { window, globalThis: window, URL, Headers, console, Math });

  await window.fetch('/auth/login', { method: 'POST' });
  assert.equal(nativeCalls, 1);
  assert.equal(events[0].action, 'API Error');
  assert.equal(events[0].requestId, 'backend-request-id');
  assert.equal(events[1].action, 'Auth Login Result');
  assert.equal(events[1].ok, false);

  events.length = 0;
  await window.fetch('/activity/add', { method: 'POST' });
  assert.equal(nativeCalls, 2);
  assert.deepEqual(events, []);
});

test('all end-user HTML entry points load tracking and admin is explicitly excluded', () => {
  const files = [
    'public/index.html', 'public/auth/index.html', 'public/portal/index.html',
    'public/portal/galaxy-setup.html', 'public/portal/story-setup.html', 'public/portal/galaxy.html',
    'public/story/index.html', 'public/fall/index.html', 'public/aurora/index.html',
    'public/galaxy-moon/index.html', 'public/privacy/index.html', 'public/terms/index.html',
    'public/owner-info/index.html', 'public/support/index.html',
    'public/payment-policy/index.html', 'public/refund-policy/index.html',
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.match(source, /activityApi\.js/);
    assert.match(source, /activityLogger\.js/);
    assert.match(source, /trackedFetch\.js/);
    assert.match(source, /activityAutoTracker\.js/);
  }
  const admin = fs.readFileSync(path.join(__dirname, '../public/admin/index.html'), 'utf8');
  assert.doesNotMatch(admin, /activityAutoTracker\.js|trackedFetch\.js/);
});
