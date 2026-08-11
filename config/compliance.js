const { PLANS, PLAN_RANK, FREE_MAX_GALAXIES } = require('./plans');
const { isDevelopmentBypass } = require('./runtime');

const OWNER_FIELDS = [
  'OWNER_NAME',
  'OWNER_TAX_ID',
  'OWNER_ADDRESS',
  'SUPPORT_EMAIL',
  'SUPPORT_PHONE',
];

function isTrue(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function clean(value, maxLength = 500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function safeHttpsUrl(value) {
  const input = clean(value, 1000);
  if (!input) return '';
  try {
    const url = new URL(input);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function publicPlans() {
  return {
    free: { label: 'Free', rank: 0, monthly: 0, yearly: 0, maxGalaxies: FREE_MAX_GALAXIES, features: [] },
    ...Object.fromEntries(Object.entries(PLANS).map(([key, plan]) => [key, {
    label: plan.label,
    rank: PLAN_RANK[key],
    monthly: plan.monthly,
    yearly: plan.yearly,
    maxGalaxies: plan.maxGalaxies,
    features: [...plan.features],
    featured: Boolean(plan.featured),
    }])),
  };
}

function getComplianceConfig(env = process.env) {
  const values = Object.fromEntries(OWNER_FIELDS.map(key => [key, clean(env[key])]));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.SUPPORT_EMAIL)) values.SUPPORT_EMAIL = '';
  if (!/^\+?[0-9 ().-]{8,25}$/.test(values.SUPPORT_PHONE)) values.SUPPORT_PHONE = '';
  const taxNotice = clean(env.PAYMENT_TAX_NOTICE, 1000);
  const taxNoticeEn = clean(env.PAYMENT_TAX_NOTICE_EN, 1000);
  const supportResponseNotice = clean(env.SUPPORT_RESPONSE_NOTICE, 1000);
  const supportResponseNoticeEn = clean(env.SUPPORT_RESPONSE_NOTICE_EN, 1000);
  const refundTimelineNotice = clean(env.REFUND_TIMELINE_NOTICE, 1000);
  const refundTimelineNoticeEn = clean(env.REFUND_TIMELINE_NOTICE_EN, 1000);
  const refundMethodNotice = clean(env.REFUND_METHOD_NOTICE, 1000);
  const refundMethodNoticeEn = clean(env.REFUND_METHOD_NOTICE_EN, 1000);
  const missingOwnerFields = OWNER_FIELDS.filter(key => !values[key]);
  const legalContentApproved = isTrue(env.LEGAL_CONTENT_APPROVED);
  const providerConfigured = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY']
    .every(key => Boolean(clean(env[key])));
  const requested = isTrue(env.PAYMENTS_ENABLED);
  const configurationComplete = missingOwnerFields.length === 0
    && Boolean(taxNotice)
    && Boolean(taxNoticeEn)
    && Boolean(supportResponseNotice)
    && Boolean(supportResponseNoticeEn)
    && Boolean(refundTimelineNotice)
    && Boolean(refundTimelineNoticeEn)
    && Boolean(refundMethodNotice)
    && Boolean(refundMethodNoticeEn)
    && legalContentApproved
    && providerConfigured;

  return {
    productName: 'Lumora',
    domain: 'https://lumora.nguyenvuongw.id.vn/',
    owner: {
      name: values.OWNER_NAME,
      taxId: values.OWNER_TAX_ID,
      address: values.OWNER_ADDRESS,
      supportEmail: values.SUPPORT_EMAIL,
      supportPhone: values.SUPPORT_PHONE,
    },
    taxNotice,
    legalNotices: { supportResponseNotice, refundTimelineNotice, refundMethodNotice },
    translations: {
      en: {
        taxNotice: taxNoticeEn,
        legalNotices: {
          supportResponseNotice: supportResponseNoticeEn,
          refundTimelineNotice: refundTimelineNoticeEn,
          refundMethodNotice: refundMethodNoticeEn,
        },
      },
    },
    moitNotificationUrl: safeHttpsUrl(env.MOIT_NOTIFICATION_URL),
    payments: {
      enabled: requested && configurationComplete,
      requested,
      configurationComplete,
    },
    development: { bypassLocks: isDevelopmentBypass(env) },
    plans: publicPlans(),
  };
}

module.exports = { OWNER_FIELDS, clean, getComplianceConfig, isTrue, safeHttpsUrl };
