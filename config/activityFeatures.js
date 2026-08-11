const ACTIVITY_FEATURES = Object.freeze([
  'landing',
  'auth',
  'portal',
  'galaxy',
  'story',
  'viewer',
  'subscription',
  'payment',
  'support',
  'account',
  'share',
  'media',
  'legal',
  'reliability',
  'other',
]);

const ACTIVITY_LEVELS = Object.freeze(['info', 'warn', 'error', 'fatal']);

function deriveFeature(action = '') {
  const value = String(action).trim();
  if (!value) return 'other';

  if (/^(API|App|Resource|Network|XHR|Server)\b/.test(value)) return 'reliability';
  if (/^(Payment|PayOS|Checkout)\b/.test(value)) return 'payment';
  if (/^(Support|Complaint|Refund Request)\b/.test(value)) return 'support';
  if (/^(Subscription|Plan|Billing)\b/.test(value)) return 'subscription';
  if (/^(Auth|Login|Register|OTP|Password Reset)\b/.test(value)) return 'auth';
  if (/^Account\b/.test(value)) return 'account';
  if (/^(Story|Chapter)\b/.test(value)) return 'story';
  if (/^(Viewer|View Public)\b/.test(value)) return 'viewer';
  if (/^(Galaxy|Gallery|Photo|Theme|Music|Caption)\b/.test(value)) return 'galaxy';
  if (/^Portal\b/.test(value)) return 'portal';
  if (/^(Landing|View Landing)\b/.test(value)) return 'landing';
  if (/^Share\b/.test(value)) return 'share';
  if (/^(Media|SoundCloud)\b/.test(value)) return 'media';
  if (/^(Privacy|Terms|Legal|View Privacy|View Terms)\b/.test(value)) return 'legal';
  return 'other';
}

function deriveLevel({ explicitLevel, status, errorType } = {}) {
  if (ACTIVITY_LEVELS.includes(explicitLevel)) return explicitLevel;
  const meaningfulError = typeof errorType === 'string' && errorType && errorType !== 'unknown';
  return status === 0 || meaningfulError ? 'error' : 'info';
}

module.exports = { ACTIVITY_FEATURES, ACTIVITY_LEVELS, deriveFeature, deriveLevel };
