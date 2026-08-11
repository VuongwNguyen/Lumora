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
const { getEntitlementBypassMode, getRoleEntitlementPlan, hasEntitlementBypass } = require('../config/runtime');
const { requireSubscription } = require('../middlewares/subscription');

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

test('role entitlements prioritize admin and grant partner a Pro-equivalent scope', () => {
  assert.equal(hasEntitlementBypass({ role: 'admin' }), true);
  assert.equal(hasEntitlementBypass({ role: 'partner' }), false);
  assert.equal(hasEntitlementBypass({ role: 'user' }), false);
  assert.equal(getEntitlementBypassMode({ role: 'admin' }), 'admin');
  assert.equal(getEntitlementBypassMode({ role: 'partner' }), null);
  assert.equal(getEntitlementBypassMode({ role: 'user' }), null);
  assert.equal(getRoleEntitlementPlan({ role: 'partner' }), 'pro');
  assert.equal(getRoleEntitlementPlan({ role: 'admin' }), null);
});

test('development mode grants a normal user no entitlement without an active subscription', async () => {
  const originalFind = SubscriptionModel.findOne;
  const originalEnv = process.env.NODE_ENV;
  SubscriptionModel.findOne = () => ({ sort: async () => null });
  process.env.NODE_ENV = 'development';
  try {
    assert.equal(await PaymentService.getStatus('user-a', 'user'), null);
  } finally {
    SubscriptionModel.findOne = originalFind;
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  }
});

test('partner API receives Pro Galaxy entitlements without admin payment privileges', async () => {
  const originalFind = SubscriptionModel.findOne;
  SubscriptionModel.findOne = () => ({ sort: async () => null });
  try {
    const status = await PaymentService.getStatus('partner-a', 'partner');
    assert.equal(status.plan, 'pro');
    assert.equal(status.effectivePlan, 'pro');
    assert.equal(status.accessMode, 'partner');
    assert.equal(status.privilegedBypass, true);
    assert.equal(status.paymentSimulationAllowed, false);
    assert.equal(status.maxGalaxies, PLANS.pro.maxGalaxies);
    assert.deepEqual(status.features, PLANS.pro.features);

    const req = { user: { role: 'partner' } };
    let forwarded;
    await requireSubscription('pro')(req, {}, error => { forwarded = error; });
    assert.equal(forwarded, undefined);
    assert.equal(req.subscription.plan, 'pro');
    assert.equal(req.subscription.grantedByRole, true);
  } finally {
    SubscriptionModel.findOne = originalFind;
  }
});

test('admin API grants all entitlements and payment simulation without a subscription', async () => {
  const originalFind = SubscriptionModel.findOne;
  const originalEnv = process.env.NODE_ENV;
  SubscriptionModel.findOne = () => ({ sort: async () => null });
  process.env.NODE_ENV = 'development';
  try {
    const status = await PaymentService.getStatus('admin-a', 'admin');
    assert.equal(status.plan, 'admin');
    assert.equal(status.accessMode, 'admin');
    assert.equal(status.privilegedBypass, true);
    assert.equal(status.paymentSimulationAllowed, true);
    assert.equal(status.maxGalaxies, Number.MAX_SAFE_INTEGER);
    assert.ok(status.features.includes('fall_universe'));
    assert.equal(Object.hasOwn(status, 'developmentBypass'), false);
  } finally {
    SubscriptionModel.findOne = originalFind;
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  }
});

test('admin payment simulation creates isolated local records and never needs PayOS', async () => {
  const originals = {
    paymentFindOne: PaymentModel.findOne,
    paymentCreate: PaymentModel.create,
    paymentUpdate: PaymentModel.findByIdAndUpdate,
    subscriptionFindOne: SubscriptionModel.findOne,
    subscriptionCreate: SubscriptionModel.create,
  };
  const paymentUpdates = [];
  let createdPayment;
  let createdSubscription;
  PaymentModel.findOne = async () => null;
  PaymentModel.create = async value => { createdPayment = value; return { ...value, _id: 'payment-admin-sim-1' }; };
  PaymentModel.findByIdAndUpdate = async (id, update) => { paymentUpdates.push({ id, update }); return { _id: id, ...update }; };
  SubscriptionModel.findOne = async () => null;
  SubscriptionModel.create = async value => { createdSubscription = value; return { ...value, _id: 'subscription-admin-sim-1' }; };
  try {
    const result = await PaymentService.adminSimulate({
      userId: 'admin-a', userEmail: 'admin@example.com', userRole: 'admin', plan: 'pro', period: 'monthly',
      idempotencyKey: 'checkout:admin-test-123456',
    });
    assert.equal(result.status, 'paid');
    assert.equal(result.simulated, true);
    assert.equal(result.paymentId, 'payment-admin-sim-1');
    assert.equal(createdPayment.isSimulation, true);
    assert.equal(createdSubscription.isSimulation, true);
    assert.equal(paymentUpdates.at(-1).update.status, 'paid');
    assert.match(paymentUpdates.at(-1).update.payosTransactionId, /^ADMIN-SIM-/);
  } finally {
    PaymentModel.findOne = originals.paymentFindOne;
    PaymentModel.create = originals.paymentCreate;
    PaymentModel.findByIdAndUpdate = originals.paymentUpdate;
    SubscriptionModel.findOne = originals.subscriptionFindOne;
    SubscriptionModel.create = originals.subscriptionCreate;
  }
});

test('non-admin cannot call payment simulation at the service or route layer', async () => {
  await assert.rejects(
    PaymentService.adminSimulate({ userRole: 'user' }),
    error => error.statusCode === 403 && /Forbidden/.test(error.message),
  );
  const routes = fs.readFileSync(path.join(__dirname, '../routes/payment.routes.js'), 'utf8');
  assert.match(routes, /post\('\/admin-simulate', requireAdmin/);
});

test('admin simulations are excluded from real revenue and subscription metrics', () => {
  const admin = fs.readFileSync(path.join(__dirname, '../controllers/admin.controller.js'), 'utf8');
  const payment = fs.readFileSync(path.join(__dirname, '../services/payment.service.js'), 'utf8');
  assert.match(admin, /status: 'paid', isSimulation: \{ \$ne: true \}/);
  assert.match(admin, /status: 'active', isSimulation: \{ \$ne: true \}/);
  assert.match(admin, /isSimulation paidAt createdAt/);
  assert.match(payment, /payosOrderCode: orderCode,\s+isSimulation: \{ \$ne: true \}/);
  assert.match(payment, /userId: claimedPayment\.userId,\s+status: 'active',\s+isSimulation: \{ \$ne: true \}/);
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
  assert.equal(PaymentModel.schema.path('isSimulation').options.default, false);
  assert.equal(SubscriptionModel.schema.path('isSimulation').options.default, false);
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

test('admin can create a real PayOS checkout while public payments remain disabled', async () => {
  const originalCreatePaymentLink = PaymentService.createPaymentLink;
  const originalTracking = process.env.ACTIVITY_TRACKING_ENABLED;
  const originalCredentials = {
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY,
  };
  let observed;
  let responseBody;
  let forwarded;

  process.env.ACTIVITY_TRACKING_ENABLED = 'false';
  process.env.PAYOS_CLIENT_ID = 'admin-test-client';
  process.env.PAYOS_API_KEY = 'admin-test-api';
  process.env.PAYOS_CHECKSUM_KEY = 'admin-test-checksum';
  PaymentService.createPaymentLink = async input => {
    observed = input;
    return {
      checkoutUrl: 'https://pay.payos.vn/web/admin-test',
      orderCode: 1234567890,
      reused: false,
    };
  };

  const req = {
    body: { plan: 'pro', period: 'monthly' },
    user: { _id: 'admin-a', email: 'admin@example.com', role: 'admin' },
    protocol: 'https',
    get(name) {
      if (name === 'Idempotency-Key') return 'checkout:admin-payos-123456';
      if (name === 'host') return 'lumora.example.com';
      return null;
    },
  };
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { responseBody = body; return body; },
  };

  try {
    await PaymentController.createPaymentLink(req, res, error => { forwarded = error; });
    assert.equal(forwarded, undefined);
    assert.equal(observed.userId, 'admin-a');
    assert.equal(observed.plan, 'pro');
    assert.equal(observed.period, 'monthly');
    assert.equal(observed.returnUrl, 'https://lumora.example.com/portal/?payment=success');
    assert.equal(responseBody.meta.checkoutUrl, 'https://pay.payos.vn/web/admin-test');
  } finally {
    PaymentService.createPaymentLink = originalCreatePaymentLink;
    if (originalTracking === undefined) delete process.env.ACTIVITY_TRACKING_ENABLED;
    else process.env.ACTIVITY_TRACKING_ENABLED = originalTracking;
    if (originalCredentials.clientId === undefined) delete process.env.PAYOS_CLIENT_ID;
    else process.env.PAYOS_CLIENT_ID = originalCredentials.clientId;
    if (originalCredentials.apiKey === undefined) delete process.env.PAYOS_API_KEY;
    else process.env.PAYOS_API_KEY = originalCredentials.apiKey;
    if (originalCredentials.checksumKey === undefined) delete process.env.PAYOS_CHECKSUM_KEY;
    else process.env.PAYOS_CHECKSUM_KEY = originalCredentials.checksumKey;
  }
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
  const portal = fs.readFileSync(path.join(__dirname, '../public/portal/index.html'), 'utf8');
  assert.match(source, /fetch\('\/compliance\/public'/);
  assert.match(source, /Rà soát đơn hàng/);
  assert.match(source, /Idempotency-Key/);
  assert.match(source, /openCheckoutReview/);
  assert.match(source, /'\/payment\/create'/);
  assert.match(source, /'\/payment\/admin-simulate'/);
  assert.match(source, /paymentSimulationAllowed/);
  assert.match(source, /ADMIN · Mở PayOS/);
  assert.match(source, /Mô phỏng kích hoạt/);
  assert.match(source, /checkoutState\.simulated/);
  assert.match(source, /entitlementAccessMode === 'admin' \|\| entitlementAccessMode === 'partner'/);
  assert.match(portal, /class="user-meta"/);
  assert.match(portal, /id="user-email"/);
  assert.match(portal, /id="plan-badge-header" hidden/);
  assert.match(portal, /\.plan-badge\[hidden\] \{ display: none; \}/);
  assert.doesNotMatch(source, /developmentBypass|dev-activate|dev-bypass/);
  assert.ok(source.indexOf('openCheckoutReview') < source.lastIndexOf("'/payment/create'"));
});

test('landing pricing contains no duplicated paid price constants', () => {
  const landing = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.doesNotMatch(landing, /10\.000đ|29\.000đ|109\.000đ|189\.000đ/);
  assert.match(landing, /LumoraPublicConfig/);
  assert.match(landing, /Object\.entries\(plans\)/);
  assert.doesNotMatch(landing, /data-plan="plus"|data-plan="pro"/);
});

test('landing page uses the responsive Lumora showcase and shared monthly/yearly plans', () => {
  const landing = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const i18n = fs.readFileSync(path.join(__dirname, '../public/shared/js/i18n.js'), 'utf8');

  assert.match(landing, /Lumora public experience redesign/);
  assert.match(landing, /<body class="landing-page">/);
  assert.match(landing, /class="landing-nav"/);
  assert.match(landing, /class="hero-inner"/);
  assert.match(landing, /class="memory-card"/);
  assert.match(landing, /class="demo-shell"/);
  assert.match(landing, /class="section-heading"/);
  assert.match(landing, /class="billing-toggle" role="group"/);
  assert.match(landing, /data-period="monthly"/);
  assert.match(landing, /data-period="yearly"/);
  assert.match(landing, /plan\[billingPeriod\]/);
  assert.match(landing, /Object\.entries\(plans\)/);
  assert.match(landing, /createPriceCard\(\{ key, plan, free: key === 'free' \}\)/);
  assert.match(landing, /Landing Billing Period Select/);
  assert.match(landing, /className = 'shooting-star'/);
  assert.match(landing, /function initLandingMotion\(\)/);
  assert.match(landing, /function createDemoBurst\(\)/);
  assert.match(landing, /const basePositions = positions\.slice\(\)/);
  assert.match(landing, /const gravityTarget = new THREE\.Vector3/);
  assert.match(landing, /distanceSq < radiusSq/);
  assert.match(landing, /const COUNT = compactMotion \? 2600 : 6000/);
  assert.match(landing, /--page-progress/);
  assert.match(landing, /motion-reveal/);
  assert.match(landing, /hero\.addEventListener\('pointermove'/);
  assert.match(landing, /@media \(max-width: 980px\)/);
  assert.match(landing, /@media \(max-width: 680px\)/);
  assert.match(landing, /prefers-reduced-motion: reduce/);
  assert.match(i18n, /landingMonthly: 'Theo tháng'/);
  assert.match(i18n, /landingYearly: 'Theo năm'/);
  assert.match(i18n, /landingMonthly: 'Monthly'/);
  assert.match(i18n, /landingYearly: 'Yearly'/);
  assert.match(i18n, /landingHeroMemoryTitle: 'Ký ức không chỉ để xem\.'/);
  assert.match(i18n, /landingHeroMemoryTitle: 'Memories are more than something to see\.'/);
});

test('landing footer translates every public navigation label through one locale', () => {
  const landing = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const footer = landing.match(/<footer class="lumora-legal-footer">([\s\S]*?)<\/footer>/)?.[1] || '';
  for (const href of ['/owner-info/', '/terms/', '/privacy/', '/payment-policy/', '/refund-policy/', '/support/', '/auth/']) {
    const escapedHref = href.replaceAll('/', '\\/');
    assert.match(footer, new RegExp(`<a href="${escapedHref}" data-vi="[^"]+" data-en="[^"]+">`));
  }
  assert.match(footer, /class="copy" data-vi="[^"]+" data-en="[^"]+"/);
  assert.match(landing, /footer \.links \{ display: flex; flex-wrap: wrap;/);
});

test('auth interface keeps every workflow while using the responsive Lumora split layout', () => {
  const auth = fs.readFileSync(path.join(__dirname, '../public/auth/index.html'), 'utf8');
  const authScript = fs.readFileSync(path.join(__dirname, '../public/auth/js/main.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(__dirname, '../public/shared/js/i18n.js'), 'utf8');

  for (const id of ['screen-auth', 'screen-otp', 'screen-forgot', 'screen-reset']) {
    assert.match(auth, new RegExp(`id="${id}"`));
  }
  for (const id of ['form-auth', 'form-otp', 'form-forgot', 'form-reset']) {
    assert.match(auth, new RegExp(`id="${id}"`));
  }
  assert.match(auth, /class="auth-shell"/);
  assert.match(auth, /class="auth-story"/);
  assert.match(auth, /class="memory-stage"/);
  assert.match(auth, /class="auth-access"/);
  assert.match(auth, /@media \(max-width: 980px\)/);
  assert.match(auth, /@media \(max-width: 560px\)/);
  assert.match(auth, /autocomplete="email"/);
  assert.match(auth, /autocomplete="current-password"/);
  assert.match(auth, /aria-live="polite"/);
  assert.doesNotMatch(auth, /tabindex="-1"/);
  assert.match(authScript, /syncAuthModeContent/);
  assert.match(authScript, /aria-selected/);
  assert.match(i18n, /authLoginHeading: 'Tiếp tục câu chuyện của bạn'/);
  assert.match(i18n, /authLoginHeading: 'Continue your story'/);
  assert.match(i18n, /authRegisterHeading: 'Tạo không gian đầu tiên'/);
  assert.match(i18n, /authRegisterHeading: 'Create your first space'/);
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
  assert.match(source, /id="acc-current-pw"[^>]*placeholder="Mật khẩu hiện tại"/);
  assert.match(source, /setText\('#sub-loading', t\.subLoading\)/);
  assert.doesNotMatch(source, /getElementById\('sub-loading'\)\.textContent/);
});

test('portal uses the responsive memory workspace without dropping existing workflows', () => {
  const portal = fs.readFileSync(path.join(__dirname, '../public/portal/index.html'), 'utf8');
  const portalScript = fs.readFileSync(path.join(__dirname, '../public/portal/js/main.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(__dirname, '../public/shared/js/i18n.js'), 'utf8');

  assert.match(portal, /<body class="portal-page">/);
  assert.match(portal, /class="portal-layout"/);
  assert.match(portal, /class="portal-sidebar"/);
  assert.match(portal, /class="portal-main"/);
  assert.match(portal, /class="panel-hero"/);
  assert.match(portal, /class="account-grid"/);
  for (const tab of ['galaxies', 'subscription', 'account']) {
    assert.match(portal, new RegExp(`class="tab-btn(?: active)?"[^>]*data-tab="${tab}"`));
    assert.match(portal, new RegExp(`id="panel-${tab}"`));
  }
  assert.match(portal, /@media \(max-width: 900px\)/);
  assert.match(portal, /@media \(max-width: 620px\)/);
  assert.match(portal, /aria-expanded="false"/);
  assert.match(portal, /aria-modal="true"/);
  assert.equal((portal.match(/id="sessions-card"/g) || []).length, 1);
  assert.doesNotMatch(portal, /setText\('\[data-tab=/);
  assert.match(portalScript, /className = 'galaxy-card-visual'/);
  assert.match(portalScript, /portalGalaxyCount/);
  assert.match(portalScript, /aria-selected/);
  assert.match(i18n, /portalGalaxiesTitle: 'Không gian của bạn'/);
  assert.match(i18n, /portalGalaxiesTitle: 'Your space'/);
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
  assert.match(backend, /planHasFeature\(effectivePlan, 'fall_universe'\)/);
});

test('galaxy setup uses the responsive Lumora workspace while retaining every setup surface', () => {
  const setupPage = fs.readFileSync(path.join(__dirname, '../public/portal/galaxy-setup.html'), 'utf8');
  const setupScript = fs.readFileSync(path.join(__dirname, '../public/portal/js/galaxy-setup.js'), 'utf8');

  assert.match(setupPage, /Lumora workspace redesign/);
  assert.match(setupPage, /class="preview-topbar"/);
  assert.match(setupPage, /\.preview-topbar \{[\s\S]*?right: auto;[\s\S]*?justify-content: flex-start;/);
  assert.match(setupPage, /class="checklist-grid"/);
  assert.match(setupPage, /class="tab-heading"/);
  assert.match(setupPage, /role="progressbar"/);
  assert.match(setupPage, /role="tablist"/);
  assert.match(setupPage, /aria-expanded="true"/);
  assert.match(setupPage, /height: 100dvh/);
  assert.match(setupPage, /@media \(max-width: 640px\)/);
  for (const tab of ['story', 'photos', 'theme', 'universe', 'music', 'caption']) {
    assert.match(setupPage, new RegExp(`class="tab-btn[^\"]*"[^>]*type="button"[^>]*data-tab="${tab}"`));
    assert.match(setupPage, new RegExp(`id="tab-${tab}"`));
  }
  assert.match(setupScript, /feature-lock-state/);
  assert.doesNotMatch(setupScript, /overlay\.innerHTML/);
  assert.match(setupScript, /setAttribute\('aria-selected'/);
  assert.match(setupScript, /setAttribute\('aria-expanded'/);
  assert.match(setupScript, /zone\.onkeydown/);
});

test('galaxy setup translates both static and dynamic interface copy', () => {
  const setupPage = fs.readFileSync(path.join(__dirname, '../public/portal/galaxy-setup.html'), 'utf8');
  const setupScript = fs.readFileSync(path.join(__dirname, '../public/portal/js/galaxy-setup.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(__dirname, '../public/shared/js/i18n.js'), 'utf8');

  assert.match(setupPage, /src="\/shared\/js\/i18n\.js"/);
  assert.ok(setupPage.indexOf('/shared/js/i18n.js') < setupPage.indexOf('js/galaxy-setup.js'));
  assert.match(setupPage, /data-i18n="setupPreviewLabel"/);
  assert.match(setupPage, /data-i18n="setupTabUniverse"/);
  assert.match(setupPage, /data-i18n-placeholder="setupCaptionPlaceholder"/);
  assert.match(setupPage, /data-i18n-label="setupPanelHide"/);
  assert.match(setupScript, /function tr\(key, \.\.\.args\)/);
  assert.match(setupScript, /tr\('setupDeleteConfirm'\)/);
  assert.match(setupScript, /tr\('setupUniverseChanged'\)/);
  assert.doesNotMatch(setupScript, /'[^'\n]*[\u00c0-\u1ef9][^'\n]*'/);
  assert.match(i18n, /setupPageTitle: 'Thiết lập vũ trụ — Lumora'/);
  assert.match(i18n, /setupPageTitle: 'Set up your universe — Lumora'/);
  assert.match(i18n, /setupStoryRecommendationCopy: ' Story Experience tạo cảm xúc/);
  assert.match(i18n, /setupStoryRecommendationCopy: ' Story Experience creates an emotional introduction/);
});

test('Story Experience uses a responsive, localized and accessible guided workspace', () => {
  const storyPage = fs.readFileSync(path.join(__dirname, '../public/portal/story-setup.html'), 'utf8');
  const storyScript = fs.readFileSync(path.join(__dirname, '../public/portal/js/story-setup.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(__dirname, '../public/shared/js/i18n.js'), 'utf8');

  assert.match(storyPage, /Lumora Story workspace redesign/);
  assert.match(storyPage, /class="story-preview-bar"/);
  assert.match(storyPage, /class="story-panel-nav"/);
  assert.match(storyPage, /class="chat-intro"/);
  assert.match(storyPage, /height: 100dvh/);
  assert.match(storyPage, /@media \(max-width: 640px\)/);
  assert.match(storyPage, /data-i18n="storySetupIntro"/);
  assert.match(storyPage, /data-i18n-label="storySetupPanelHide"/);
  assert.ok(storyPage.indexOf('/shared/js/i18n.js') < storyPage.indexOf('js/story-setup.js'));
  assert.match(storyPage, /id="panel-toggle" type="button"/);

  assert.match(storyScript, /function tr\(key, \.\.\.args\)/);
  assert.match(storyScript, /function occasionLabel\(id, config\)/);
  assert.match(storyScript, /function chapterPrompt\(chapter\)/);
  assert.match(storyScript, /document\.createElement\('button'\)/);
  assert.match(storyScript, /tr\('storySetupExisting', occLabel\)/);
  assert.match(storyScript, /tr\('storySetupOccasionQuestion'\)/);
  assert.doesNotMatch(storyScript, /'[^'\n]*[\u00c0-\u1ef9][^'\n]*'/);

  assert.match(i18n, /storySetupIntro: 'Lumora sẽ dẫn bạn qua từng bước/);
  assert.match(i18n, /storySetupIntro: 'Lumora will guide you step by step/);
  assert.match(i18n, /storySetupOccasionLabel: \(id, fallback\)/);
  assert.match(i18n, /storySetupChapterLabel: \(id, fallback\)/);
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

test('partner receives Pro Galaxy features and the Pro galaxy-count limit without a subscription', async () => {
  const originals = {
    galaxyFindOne: GalaxyModel.findOne,
    galaxyUpdate: GalaxyModel.findByIdAndUpdate,
    galaxyCount: GalaxyModel.countDocuments,
    galaxyCreate: GalaxyModel.create,
    subscriptionFindOne: SubscriptionModel.findOne,
  };
  let activeCount = PLANS.pro.maxGalaxies - 1;
  GalaxyModel.findOne = async filter => filter.name ? null : ({ _id: 'galaxy-partner', userId: 'partner-a', template: 'galaxy' });
  GalaxyModel.findByIdAndUpdate = async (id, update) => ({ _id: id, ...update });
  GalaxyModel.countDocuments = async () => activeCount;
  GalaxyModel.create = async value => ({ _id: 'galaxy-partner-new', ...value });
  SubscriptionModel.findOne = async () => { throw new Error('partner role entitlement must not query subscriptions'); };
  try {
    const updated = await GalaxyService.updateGalaxy({
      galaxyId: 'galaxy-partner', userId: 'partner-a', user: { role: 'partner' },
      data: { template: 'fall', caption: ['Partner preview'], backgroundMusicId: 'music-a', themeId: 'theme-a' },
    });
    assert.equal(updated.template, 'fall');
    assert.deepEqual(updated.caption, ['Partner preview']);

    const created = await GalaxyService.createGalaxy({ userId: 'partner-a', name: 'Partner galaxy', userRole: 'partner' });
    assert.equal(created.name, 'Partner galaxy');

    activeCount = PLANS.pro.maxGalaxies;
    await assert.rejects(
      GalaxyService.createGalaxy({ userId: 'partner-a', name: 'Over limit', userRole: 'partner' }),
      error => error.statusCode === 403 && error.message.includes(String(PLANS.pro.maxGalaxies)),
    );
  } finally {
    GalaxyModel.findOne = originals.galaxyFindOne;
    GalaxyModel.findByIdAndUpdate = originals.galaxyUpdate;
    GalaxyModel.countDocuments = originals.galaxyCount;
    GalaxyModel.create = originals.galaxyCreate;
    SubscriptionModel.findOne = originals.subscriptionFindOne;
  }
});
