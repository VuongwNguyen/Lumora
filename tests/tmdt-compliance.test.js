const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'tmdt-test-secret';
process.env.PAYMENTS_ENABLED = 'false';

const { getComplianceConfig, safeHttpsUrl } = require('../config/compliance');
const { PLANS, PLAN_KEYS, PLAN_RANK, planHasFeature } = require('../config/plans');
const PaymentModel = require('../models/payment');
const PaymentService = require('../services/payment.service');
const PaymentController = require('../controllers/payment.controller');
const { sanitizePlainText, validatePayload } = require('../services/support.service');
const GalaxyModel = require('../models/galaxy');
const SubscriptionModel = require('../models/subscription');
const GalaxyService = require('../services/galaxy.service');
const { isDevelopmentBypass, getEntitlementBypassMode, hasEntitlementBypass } = require('../config/runtime');

const completeEnv = {
  OWNER_NAME: 'Lumora Owner', OWNER_TAX_ID: 'TAX-001', OWNER_ADDRESS: 'Business address',
  SUPPORT_EMAIL: 'support@example.com', SUPPORT_PHONE: '+84123456789',
  PAYMENT_TAX_NOTICE: 'Giá đã được mô tả theo quyết định của PO.',
  PAYMENT_TAX_NOTICE_EN: 'Pricing is described according to the PO decision.',
  SUPPORT_RESPONSE_NOTICE: 'Phản hồi theo thời hạn do PO phê duyệt.',
  SUPPORT_RESPONSE_NOTICE_EN: 'Responses follow the timeframe approved by the PO.',
  REFUND_TIMELINE_NOTICE: 'Xử lý theo thời hạn do PO phê duyệt.',
  REFUND_TIMELINE_NOTICE_EN: 'Refunds follow the timeframe approved by the PO.',
  REFUND_METHOD_NOTICE: 'Hoàn tiền theo phương thức do PO phê duyệt.',
  REFUND_METHOD_NOTICE_EN: 'Refunds use the method approved by the PO.',
  LEGAL_CONTENT_APPROVED: 'true', PAYMENTS_ENABLED: 'true',
  PAYOS_CLIENT_ID: 'test-client', PAYOS_API_KEY: 'test-api', PAYOS_CHECKSUM_KEY: 'test-checksum',
};

test('payment remains disabled until every launch prerequisite is configured', () => {
  assert.equal(getComplianceConfig({ PAYMENTS_ENABLED: 'true' }).payments.enabled, false);
  const missingEnglishNotice = { ...completeEnv };
  delete missingEnglishNotice.REFUND_METHOD_NOTICE_EN;
  assert.equal(getComplianceConfig(missingEnglishNotice).payments.enabled, false);
  const enabled = getComplianceConfig(completeEnv);
  assert.equal(enabled.payments.enabled, true);
  assert.equal(enabled.payments.configurationComplete, true);
  assert.equal(enabled.owner.name, 'Lumora Owner');
  assert.equal(enabled.plans.pro.yearly, PLANS.pro.yearly);
  assert.equal(enabled.plans.pro.monthly, PLANS.pro.monthly);
  assert.equal(enabled.translations.en.taxNotice, completeEnv.PAYMENT_TAX_NOTICE_EN);
});

test('public configuration only accepts HTTPS ministry confirmation URLs', () => {
  assert.equal(safeHttpsUrl('javascript:alert(1)'), '');
  assert.equal(safeHttpsUrl('http://online.gov.vn/example'), '');
  assert.equal(safeHttpsUrl('https://online.gov.vn/example'), 'https://online.gov.vn/example');
  assert.equal(getComplianceConfig({ SUPPORT_EMAIL: 'not-an-email', SUPPORT_PHONE: 'bad' }).owner.supportEmail, '');
});

test('plan capabilities are centralized and Fall universe belongs to Pro', () => {
  assert.equal(planHasFeature('pro', 'fall_universe'), true);
  assert.equal(planHasFeature('plus', 'fall_universe'), false);
  assert.equal(planHasFeature('free', 'fall_universe'), false);
});

test('development lock bypass is explicit and can never activate in production', () => {
  assert.equal(isDevelopmentBypass({ NODE_ENV: 'development' }), true);
  assert.equal(isDevelopmentBypass({ npm_lifecycle_event: 'dev' }), true);
  assert.equal(isDevelopmentBypass({ NODE_ENV: 'development', DEV_BYPASS_LOCKS: 'false' }), false);
  assert.equal(isDevelopmentBypass({ NODE_ENV: 'production', npm_lifecycle_event: 'dev', DEV_BYPASS_LOCKS: 'true' }), false);
  assert.equal(isDevelopmentBypass({ NODE_ENV: 'test', DEV_BYPASS_LOCKS: 'true' }), false);
  assert.equal(hasEntitlementBypass({ role: 'admin', env: { NODE_ENV: 'production' } }), true);
  assert.equal(hasEntitlementBypass({ role: 'partner', env: { NODE_ENV: 'production' } }), true);
  assert.equal(hasEntitlementBypass({ role: 'user', env: { NODE_ENV: 'production' } }), false);
  assert.equal(getEntitlementBypassMode({ role: 'admin', env: { NODE_ENV: 'development' } }), 'admin');
  assert.equal(getEntitlementBypassMode({ role: 'partner', env: { NODE_ENV: 'development' } }), 'development');
  assert.equal(getEntitlementBypassMode({ role: 'partner', env: { NODE_ENV: 'production' } }), 'partner');
  assert.equal(getEntitlementBypassMode({ role: 'user', env: { NODE_ENV: 'development' } }), 'development');
});

test('development status exposes all feature entitlements without creating a real subscription', async () => {
  const originalFind = SubscriptionModel.findOne;
  const originalEnv = process.env.NODE_ENV;
  SubscriptionModel.findOne = () => ({ sort: async () => null });
  process.env.NODE_ENV = 'development';
  try {
    const status = await PaymentService.getStatus('user-a');
    assert.equal(status.developmentBypass, true);
    assert.equal(status.accessMode, 'development');
    assert.equal(status.plan, 'development');
    assert.equal(status.maxGalaxies, Number.MAX_SAFE_INTEGER);
    assert.ok(status.features.includes('fall_universe'));
    assert.equal(status.effectivePlan, PLAN_KEYS.at(-1));
  } finally {
    SubscriptionModel.findOne = originalFind;
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  }
});

test('admin API entitlement outranks development and does not require a subscription', async () => {
  const originalFind = SubscriptionModel.findOne;
  const originalEnv = process.env.NODE_ENV;
  SubscriptionModel.findOne = () => ({ sort: async () => null });
  process.env.NODE_ENV = 'development';
  try {
    const status = await PaymentService.getStatus('admin-a', 'admin');
    assert.equal(status.plan, 'admin');
    assert.equal(status.accessMode, 'admin');
    assert.equal(status.privilegedBypass, true);
    assert.equal(status.developmentBypass, false);
    assert.equal(status.maxGalaxies, Number.MAX_SAFE_INTEGER);
    assert.ok(status.features.includes('fall_universe'));
  } finally {
    SubscriptionModel.findOne = originalFind;
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  }
});

test('development activation creates a paid local record and never needs PayOS', async () => {
  const originals = {
    paymentFindOne: PaymentModel.findOne,
    paymentCreate: PaymentModel.create,
    paymentUpdate: PaymentModel.findByIdAndUpdate,
    subscriptionFindOne: SubscriptionModel.findOne,
    subscriptionCreate: SubscriptionModel.create,
  };
  const originalEnv = process.env.NODE_ENV;
  const paymentUpdates = [];
  process.env.NODE_ENV = 'development';
  PaymentModel.findOne = async () => null;
  PaymentModel.create = async value => ({ ...value, _id: 'payment-dev-1' });
  PaymentModel.findByIdAndUpdate = async (id, update) => { paymentUpdates.push({ id, update }); return { _id: id, ...update }; };
  SubscriptionModel.findOne = async () => null;
  SubscriptionModel.create = async value => ({ ...value, _id: 'subscription-dev-1' });
  try {
    const result = await PaymentService.devActivate({
      userId: 'user-a', userEmail: 'user@example.com', plan: 'pro', period: 'monthly',
      idempotencyKey: 'checkout:dev-1234567890',
    });
    assert.equal(result.status, 'paid');
    assert.equal(result.simulated, true);
    assert.equal(result.paymentId, 'payment-dev-1');
    assert.equal(paymentUpdates.at(-1).update.status, 'paid');
    assert.match(paymentUpdates.at(-1).update.payosTransactionId, /^DEV-/);
  } finally {
    PaymentModel.findOne = originals.paymentFindOne;
    PaymentModel.create = originals.paymentCreate;
    PaymentModel.findByIdAndUpdate = originals.paymentUpdate;
    SubscriptionModel.findOne = originals.subscriptionFindOne;
    SubscriptionModel.create = originals.subscriptionCreate;
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  }
});

test('development activation endpoint is inaccessible outside development', async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let forwarded;
  try {
    await PaymentController.devActivate({ body: {}, get: () => null }, {}, error => { forwarded = error; });
    assert.equal(forwarded.statusCode, 404);
  } finally {
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  }
});

test('every configured paid plan propagates to public config and persistence enums', () => {
  const config = getComplianceConfig();
  assert.deepEqual(Object.keys(config.plans).filter(key => key !== 'free'), [...PLAN_KEYS]);
  assert.deepEqual(SubscriptionModel.schema.path('plan').enumValues, [...PLAN_KEYS]);
  assert.deepEqual(PaymentModel.schema.path('plan').enumValues, [...PLAN_KEYS]);
  PLAN_KEYS.forEach((key, index) => {
    assert.equal(config.plans[key].rank, PLAN_RANK[key]);
    assert.equal(PLAN_RANK[key], PLANS[key].rank ?? index + 1);
  });
});

test('payment idempotency keys are validated and indexed per user', () => {
  assert.equal(PaymentService.validateIdempotencyKey('checkout:1234567890abcdef'), 'checkout:1234567890abcdef');
  assert.throws(() => PaymentService.validateIdempotencyKey('short'), /Invalid Idempotency-Key/);
  const index = PaymentModel.schema.indexes().find(([keys]) => keys.userId === 1 && keys.idempotencyKeyHash === 1);
  assert.ok(index);
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].partialFilterExpression, { idempotencyKeyHash: { $type: 'string' } });
  assert.equal(PaymentModel.schema.path('payosTransactionId').options.select, false);
  assert.equal(PaymentModel.schema.path('checkoutUrl').options.select, false);
});

test('payment endpoint guard refuses order creation while payments are disabled', async () => {
  const req = {
    body: { plan: 'pro', period: 'yearly' }, user: { _id: 'user-a', email: 'user@example.com' },
    get: () => 'checkout:1234567890abcdef', protocol: 'https',
  };
  let forwarded;
  await PaymentController.createPaymentLink(req, {}, error => { forwarded = error; });
  assert.equal(forwarded.statusCode, 503);
  assert.match(forwarded.message, /đang được hoàn thiện/);
});

test('payment service rejects unknown plans and periods before touching storage', async () => {
  await assert.rejects(
    PaymentService.createPaymentLink({ plan: 'enterprise', period: 'monthly' }),
    error => error.statusCode === 400 && /Invalid plan/.test(error.message),
  );
  await assert.rejects(
    PaymentService.createPaymentLink({ plan: 'pro', period: 'weekly' }),
    error => error.statusCode === 400 && /Invalid period/.test(error.message),
  );
});

test('payment history always scopes records to the authenticated user and omits provider internals', async () => {
  const originalFind = PaymentModel.find;
  const originalCount = PaymentModel.countDocuments;
  const observed = [];
  PaymentModel.find = filter => {
    observed.push(filter);
    return {
      select(value) { assert.doesNotMatch(value, /payosTransactionId|checkoutUrl/); return this; },
      sort() { return this; }, skip() { return this; }, limit() { return this; },
      lean: async () => [],
    };
  };
  PaymentModel.countDocuments = async filter => { observed.push(filter); return 0; };
  try {
    const result = await PaymentService.getHistory('user-a', { page: '1', limit: '10' });
    assert.deepEqual(observed, [{ userId: 'user-a' }, { userId: 'user-a' }]);
    assert.deepEqual(result.items, []);
  } finally {
    PaymentModel.find = originalFind;
    PaymentModel.countDocuments = originalCount;
  }
});

test('support input is validated, normalized and never reflects executable markup', () => {
  assert.equal(sanitizePlainText(' <b>hello</b>\u0000 ', 40), 'bhello/b');
  const result = validatePayload({
    name: 'Nguyen Van A', email: 'USER@example.com', type: 'payment', orderCode: '12345678',
    message: 'Tôi cần hỗ trợ giao dịch này.', accuracyConfirmed: true,
  });
  assert.equal(result.email, 'user@example.com');
  assert.throws(() => validatePayload({ name: 'A', email: 'bad', type: 'x', message: 'short' }), /Họ tên/);
});

test('checkout UI reviews an order before create and uses the shared plan API', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/portal/js/subscription.js'), 'utf8');
  assert.match(source, /fetch\('\/compliance\/public'/);
  assert.match(source, /Rà soát đơn hàng/);
  assert.match(source, /Idempotency-Key/);
  assert.match(source, /openCheckoutReview/);
  assert.match(source, /'\/payment\/create'/);
  assert.match(source, /'\/payment\/dev-activate'/);
  assert.match(source, /developmentBypass/);
  assert.ok(source.indexOf('openCheckoutReview') < source.lastIndexOf("'/payment/create'"));
});

test('landing pricing contains no duplicated paid price constants', () => {
  const landing = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.doesNotMatch(landing, /10\.000đ|29\.000đ|109\.000đ|189\.000đ/);
  assert.match(landing, /LumoraPublicConfig/);
  assert.match(landing, /Object\.entries\(plans\)/);
  assert.doesNotMatch(landing, /data-plan="plus"|data-plan="pro"/);
});

test('portal and public policy pricing render all configured plans instead of fixed plan keys', () => {
  const portal = fs.readFileSync(path.join(__dirname, '../public/portal/js/subscription.js'), 'utf8');
  const publicSite = fs.readFileSync(path.join(__dirname, '../public/shared/js/publicSite.js'), 'utf8');
  assert.match(portal, /Object\.entries\(plans\)/);
  assert.match(publicSite, /Object\.entries\(config\.plans \|\| \{\}\)/);
  assert.doesNotMatch(portal, /\['plus', 'pro'\]/);
  assert.doesNotMatch(publicSite, /\['plus', 'pro'\]/);
});

test('all compliance pages exist, load tracking and expose the required legal navigation', () => {
  const pages = ['owner-info', 'support', 'payment-policy', 'refund-policy'];
  for (const page of pages) {
    const source = fs.readFileSync(path.join(__dirname, `../public/${page}/index.html`), 'utf8');
    for (const script of ['activityApi.js', 'activityLogger.js', 'trackedFetch.js', 'activityAutoTracker.js', 'publicSite.js']) {
      assert.match(source, new RegExp(script.replace('.', '\\.')));
    }
  }
  const shared = fs.readFileSync(path.join(__dirname, '../public/shared/js/publicSite.js'), 'utf8');
  for (const href of ['/owner-info/', '/terms/', '/privacy/', '/payment-policy/', '/refund-policy/', '/support/']) {
    assert.match(shared, new RegExp(href.replaceAll('/', '\\/')));
  }
});

test('new public compliance pages provide Vietnamese and English copy through the shared translator', () => {
  const pages = ['owner-info', 'support', 'payment-policy', 'refund-policy'];
  for (const page of pages) {
    const source = fs.readFileSync(path.join(__dirname, `../public/${page}/index.html`), 'utf8');
    assert.match(source, /data-title-vi=/);
    assert.match(source, /data-title-en=/);
    assert.match(source, /data-vi=/);
    assert.match(source, /data-en=/);
  }
  const shared = fs.readFileSync(path.join(__dirname, '../public/shared/js/publicSite.js'), 'utf8');
  assert.match(shared, /LumoraPublicI18n/);
  assert.match(shared, /document\.documentElement\.lang = lang/);
  assert.match(shared, /\[data-vi\]\[data-en\]/);
});

test('portal account controls retain readable fallback copy and translations tolerate removed subscription loading state', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/portal/index.html'), 'utf8');
  assert.match(source, /id="btn-change-pw"[^>]*>Đổi mật khẩu<\/button>/);
  assert.match(source, /id="btn-delete-account">Xóa tài khoản<\/button>/);
  assert.match(source, /id="acc-current-pw" placeholder="Mật khẩu hiện tại"/);
  assert.match(source, /setText\('#sub-loading', t\.subLoading\)/);
  assert.doesNotMatch(source, /getElementById\('sub-loading'\)\.textContent/);
});

test('Fall universe is selectable in setup and protected by the backend capability', () => {
  const setup = fs.readFileSync(path.join(__dirname, '../public/portal/js/galaxy-setup.js'), 'utf8');
  const custom = fs.readFileSync(path.join(__dirname, '../public/portal/js/galaxy-custom.js'), 'utf8');
  const setupPage = fs.readFileSync(path.join(__dirname, '../public/portal/galaxy-setup.html'), 'utf8');
  const backend = fs.readFileSync(path.join(__dirname, '../services/galaxy.service.js'), 'utf8');
  assert.match(setup, /fall_universe/);
  assert.match(setup, /applyUniverse/);
  assert.match(setup, /requiredPlan: 'Pro'/);
  assert.match(setup, /leftLocked - rightLocked/);
  assert.doesNotMatch(setup, /localStorage.*role|isPrivileged/);
  assert.doesNotMatch(custom, /user\.role === ['"]admin['"]/);
  assert.match(custom, /fetch\(`\$\{API_BASE\}\/payment\/status`/);
  assert.doesNotMatch(setup, /tabId: 'tab-universe'.*feature: 'fall_universe'/);
  assert.ok(setupPage.indexOf('data-tab="photos"') < setupPage.indexOf('data-tab="universe"'));
  assert.match(setupPage, /\.universe-card\.locked/);
  assert.match(backend, /planHasFeature\(sub\.plan, 'fall_universe'\)/);
});

test('backend rejects Fall for Plus and accepts it for Pro', async () => {
  const originalGalaxyFind = GalaxyModel.findOne;
  const originalUpdate = GalaxyModel.findByIdAndUpdate;
  const originalSubFind = SubscriptionModel.findOne;
  GalaxyModel.findOne = async () => ({ _id: 'galaxy-a', userId: 'user-a', template: 'galaxy' });
  GalaxyModel.findByIdAndUpdate = async (id, update) => ({ _id: id, ...update });
  try {
    SubscriptionModel.findOne = async () => ({ plan: 'plus', status: 'active', expiredAt: new Date(Date.now() + 86400000) });
    await assert.rejects(
      GalaxyService.updateGalaxy({ galaxyId: 'galaxy-a', userId: 'user-a', user: { role: 'user' }, data: { template: 'fall' } }),
      error => error.statusCode === 403 && /Fall universe/.test(error.message),
    );
    SubscriptionModel.findOne = async () => ({ plan: 'pro', status: 'active', expiredAt: new Date(Date.now() + 86400000) });
    const updated = await GalaxyService.updateGalaxy({ galaxyId: 'galaxy-a', userId: 'user-a', user: { role: 'user' }, data: { template: 'fall', userId: 'attacker', status: 'inactive' } });
    assert.equal(updated.template, 'fall');
    assert.equal(updated.userId, undefined);
    assert.equal(updated.status, undefined);
  } finally {
    GalaxyModel.findOne = originalGalaxyFind;
    GalaxyModel.findByIdAndUpdate = originalUpdate;
    SubscriptionModel.findOne = originalSubFind;
  }
});

test('admin bypasses backend galaxy feature checks without a subscription lookup', async () => {
  const originalGalaxyFind = GalaxyModel.findOne;
  const originalUpdate = GalaxyModel.findByIdAndUpdate;
  const originalSubFind = SubscriptionModel.findOne;
  GalaxyModel.findOne = async () => ({ _id: 'galaxy-admin', userId: 'admin-a', template: 'galaxy' });
  GalaxyModel.findByIdAndUpdate = async (id, update) => ({ _id: id, ...update });
  SubscriptionModel.findOne = async () => { throw new Error('admin bypass must not query subscriptions'); };
  try {
    const updated = await GalaxyService.updateGalaxy({
      galaxyId: 'galaxy-admin', userId: 'admin-a', user: { role: 'admin' },
      data: { template: 'fall', caption: ['Admin preview'] },
    });
    assert.equal(updated.template, 'fall');
    assert.deepEqual(updated.caption, ['Admin preview']);
  } finally {
    GalaxyModel.findOne = originalGalaxyFind;
    GalaxyModel.findByIdAndUpdate = originalUpdate;
    SubscriptionModel.findOne = originalSubFind;
  }
});
