(function (root, factory) {
  let transport = root.LumoraActivityApi;
  if (!transport && typeof module === 'object' && module.exports) {
    transport = require('./activityApi');
  }
  const logger = factory(root, transport);
  if (typeof module === 'object' && module.exports) module.exports = logger;
  else root.LumoraActivity = logger;
})(typeof window !== 'undefined' ? window : globalThis, function (root, transport) {
  'use strict';

  const DEVICE_KEY = 'lumora_device_id';
  const SESSION_KEY = 'lumora_activity_session';
  const OPT_OUT_KEY = 'lumora_tracking_opt_out';
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const LEVELS = ['info', 'warn', 'error', 'fatal'];
  let memoryDeviceId = null;
  let memorySession = null;
  const pageStarts = Object.create(null);

  const ERROR_DESCRIPTIONS = {
    auth_unauthorized: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
    auth_forbidden: 'Tài khoản không có quyền thực hiện thao tác.',
    not_found: 'Tài nguyên hoặc API không tồn tại.',
    validation_error: 'Dữ liệu đầu vào không hợp lệ.',
    rate_limited: 'Có quá nhiều yêu cầu trong một khoảng thời gian ngắn.',
    server_error: 'Máy chủ xử lý yêu cầu thất bại.',
    client_error: 'Yêu cầu từ trình duyệt không hợp lệ.',
    timeout: 'Thao tác quá thời gian chờ.',
    network_drop: 'Kết nối mạng bị gián đoạn.',
    request_cancelled: 'Yêu cầu đã bị huỷ trước khi hoàn tất.',
    json_parse_error: 'Phản hồi không phải JSON hợp lệ.',
    javascript_error: 'JavaScript phát sinh lỗi khi chạy.',
    unhandled_rejection: 'Promise bị reject nhưng không được xử lý.',
    resource_load_fail: 'Trình duyệt không tải được tài nguyên.',
    storage_unavailable: 'Không thể đọc hoặc ghi browser storage.',
    clipboard_fail: 'Không thể sao chép dữ liệu vào clipboard.',
    unknown: 'Chưa phân loại được nguyên nhân lỗi.',
  };

  const SENSITIVE_KEY_RE = /(password|passphrase|otp|token|authorization|cookie|secret|checksum|api[-_]?key|signature|credential)/i;

  function uuidV4() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
      const random = Math.floor(Math.random() * 16);
      const value = char === 'x' ? random : ((random & 0x3) | 0x8);
      return value.toString(16);
    });
  }

  function storageGet(key) {
    try {
      return root.localStorage ? root.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      if (root.localStorage) root.localStorage.setItem(key, value);
    } catch {
      // Storage is optional; memory fallback keeps the logger non-blocking.
    }
  }

  function getDeviceId() {
    if (memoryDeviceId) return memoryDeviceId;
    const stored = storageGet(DEVICE_KEY);
    memoryDeviceId = stored || uuidV4();
    if (!stored) storageSet(DEVICE_KEY, memoryDeviceId);
    return memoryDeviceId;
  }

  function getSessionId() {
    const now = Date.now();
    let session = memorySession;
    if (!session) {
      try { session = JSON.parse(storageGet(SESSION_KEY) || 'null'); } catch { session = null; }
    }
    if (!session || !session.id || !session.lastActivityAt || now - session.lastActivityAt > SESSION_TIMEOUT_MS) {
      session = { id: uuidV4(), lastActivityAt: now };
    } else {
      session.lastActivityAt = now;
    }
    memorySession = session;
    storageSet(SESSION_KEY, JSON.stringify(session));
    return session.id;
  }

  function redactString(value, maxLength) {
    maxLength = maxLength == null ? 2000 : maxLength;
    let output = String(value)
      .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer ***')
      .replace(/(password|otp|token|code|key|signature|checksum)=([^&\s]+)/gi, '$1=***')
      .replace(/(Authorization\s*:\s*)[^\r\n]+/gi, '$1***')
      .replace(/([?&](?:password|otp|token|code|key|signature|checksum)=)[^&#\s]+/gi, '$1***')
      .replace(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi, '***@$1');
    if (output.length > maxLength) output = output.slice(0, maxLength) + '…[truncated]';
    return output;
  }

  function redactCredential(value, maxLength, depth, state) {
    maxLength = maxLength == null ? 2000 : maxLength;
    depth = depth || 0;
    state = state || { keys: 0 };
    if (value == null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
    if (typeof value === 'string') return redactString(value, maxLength);
    if (depth >= 5) return '[max_depth]';
    if (Array.isArray(value)) {
      return value.slice(0, 50).map(function (item) {
        return redactCredential(item, maxLength, depth + 1, state);
      });
    }
    if (typeof value !== 'object') return redactString(value, maxLength);

    const output = {};
    Object.keys(value).some(function (rawKey) {
      if (state.keys >= 50) return true;
      if (rawKey === '__proto__' || rawKey === 'prototype' || rawKey === 'constructor') return false;
      const key = redactString(rawKey, 100);
      state.keys += 1;
      output[key] = SENSITIVE_KEY_RE.test(key)
        ? '[REDACTED]'
        : redactCredential(value[rawKey], maxLength, depth + 1, state);
      return false;
    });
    return output;
  }

  function deriveFeature(action) {
    const value = String(action || '').trim();
    if (!value) return 'other';
    if (/^(API|App|Resource|Network|XHR|Server)\b/.test(value)) return 'reliability';
    if (/^(Payment|PayOS|Checkout)\b/.test(value)) return 'payment';
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

  function deriveLevel(explicitLevel, status, errorType) {
    if (LEVELS.indexOf(explicitLevel) >= 0) return explicitLevel;
    const hasError = typeof errorType === 'string' && errorType && errorType !== 'unknown';
    return status === 0 || hasError ? 'error' : 'info';
  }

  function classifyApiError(httpStatus, message) {
    if (httpStatus === 401) return 'auth_unauthorized';
    if (httpStatus === 403) return 'auth_forbidden';
    if (httpStatus === 404) return 'not_found';
    if (httpStatus === 422 || httpStatus === 400) return 'validation_error';
    if (httpStatus === 429) return 'rate_limited';
    if (httpStatus >= 500) return 'server_error';
    if (httpStatus >= 400) return 'client_error';
    const text = String(message || '').toLowerCase();
    if (/abort|cancel/.test(text)) return 'request_cancelled';
    if (/timeout|timed out|etimedout/.test(text)) return 'timeout';
    if (/network|failed to fetch|econnrefused|econnreset|offline/.test(text)) return 'network_drop';
    return 'unknown';
  }

  function getApiErrorMeta(error, request) {
    request = request || {};
    const status = error && (error.status || (error.response && error.response.status));
    const responseData = error && (error.data || (error.response && error.response.data));
    const message = error && (error.message || error.error) || 'Unknown API error';
    return redactCredential({
      endpoint: normalizePath(request.url || request.endpoint || ''),
      method: String(request.method || 'GET').toUpperCase(),
      httpStatus: status || null,
      errorType: classifyApiError(status, message),
      errorMsg: message,
      beResponse: responseData || null,
      durationMs: request.durationMs,
      requestId: request.requestId,
    });
  }

  function normalizePath(value) {
    if (!value) return '';
    try { return new URL(String(value), 'https://lumora.local').pathname.slice(0, 500); }
    catch { return String(value).split(/[?#]/)[0].slice(0, 500); }
  }

  function detectPage() {
    const path = root.location && root.location.pathname ? root.location.pathname : '';
    if (path === '/' || path === '/index.html') return 'landing';
    if (path.indexOf('/auth') === 0) return 'auth';
    if (path.indexOf('/portal/story-setup') === 0) return 'story_setup';
    if (path.indexOf('/portal/galaxy-setup') === 0) return 'galaxy_setup';
    if (path.indexOf('/portal') === 0) return 'portal';
    if (/^\/(view|story|fall|aurora|galaxy-moon)/.test(path)) return 'public_view';
    if (path.indexOf('/privacy') === 0) return 'privacy';
    if (path.indexOf('/terms') === 0) return 'terms';
    if (path.indexOf('/admin') === 0) return 'admin';
    return 'unknown';
  }

  function browserName() {
    const userAgent = root.navigator && root.navigator.userAgent || '';
    if (/Edg\//.test(userAgent)) return 'edge';
    if (/Firefox\//.test(userAgent)) return 'firefox';
    if (/Chrome\//.test(userAgent)) return 'chrome';
    if (/Safari\//.test(userAgent)) return 'safari';
    return 'unknown';
  }

  function shouldTrack() {
    const path = root.location && root.location.pathname || '';
    if (path.indexOf('/admin') === 0) return false;
    return storageGet(OPT_OUT_KEY) !== 'true';
  }

  function buildActivity(activity) {
    if (!activity || typeof activity.action !== 'string' || !activity.action.trim()) return null;
    const sessionId = getSessionId();
    const deviceId = getDeviceId();
    let description = null;
    let metadata = {};
    if (typeof activity.description === 'string') description = redactString(activity.description, 2000);
    else if (activity.description && typeof activity.description === 'object') metadata = Object.assign({}, activity.description);
    if (activity.metadata && typeof activity.metadata === 'object') metadata = Object.assign(metadata, activity.metadata);
    if (activity.status === 0 || activity.status === 1) metadata.status = activity.status;
    metadata.sessionId = sessionId;
    metadata.language = root.navigator && root.navigator.language || 'unknown';
    metadata.browser = browserName();
    metadata.viewport = root.innerWidth && root.innerHeight ? root.innerWidth + 'x' + root.innerHeight : 'unknown';
    metadata = redactCredential(metadata);
    const errorType = typeof metadata.errorType === 'string' ? metadata.errorType : null;
    if (errorType && !metadata.errorTypeDescription) {
      // Only enrich types known by the lightweight browser catalog. The server
      // owns the complete catalog and will enrich domain-specific error types.
      if (ERROR_DESCRIPTIONS[errorType]) metadata.errorTypeDescription = ERROR_DESCRIPTIONS[errorType];
    }
    return {
      action: activity.action.trim(),
      feature: activity.feature || deriveFeature(activity.action),
      level: deriveLevel(activity.level, activity.status, errorType),
      anonymousId: deviceId,
      deviceId: deviceId,
      sessionId: sessionId,
      requestId: activity.requestId || null,
      galaxyId: activity.galaxyId || null,
      paymentId: activity.paymentId || null,
      page: activity.page || detectPage(),
      path: normalizePath(activity.path || (root.location && root.location.pathname) || ''),
      description: description,
      metadata: metadata,
      startedAt: activity.startedAt || null,
      endedAt: activity.endedAt || null,
    };
  }

  function log(activity, options) {
    if (!shouldTrack()) return;
    try {
      const body = buildActivity(activity);
      if (!body || !transport || typeof transport.send !== 'function') return;
      Promise.resolve(transport.send(body, options || {})).catch(function (error) {
        if (root.location && /localhost|127\.0\.0\.1/.test(root.location.hostname || '')) {
          if (root.console && root.console.warn) root.console.warn('[activity] send failed:', error && error.message || error);
        }
      });
    } catch {
      // Best-effort activity logging must never throw into the product flow.
    }
  }

  function logClick(action, metadata, extra) {
    log(Object.assign({}, extra || {}, { action: action, description: metadata || {} }));
  }

  function logResult(action, ok, metadata, error, extra) {
    const description = Object.assign({}, metadata || {});
    if (!ok && error) Object.assign(description, getApiErrorMeta(error));
    log(Object.assign({}, extra || {}, {
      action: action,
      status: ok ? 1 : 0,
      description: description,
    }));
  }

  function logBlocked(action, reason, metadata, extra) {
    log(Object.assign({}, extra || {}, {
      action: action,
      level: 'warn',
      description: Object.assign({ reason: reason || 'unknown' }, metadata || {}),
    }));
  }

  function logPageView(page, metadata) {
    const now = Date.now();
    pageStarts[page] = now;
    log({ action: 'View ' + titleCase(page) + ' Page', page: page, description: metadata || {}, startedAt: new Date(now).toISOString() });
  }

  function logPageLeave(page, metadata, options) {
    const now = Date.now();
    const started = pageStarts[page] || now;
    log({
      action: titleCase(page) + ' Leave',
      page: page,
      description: Object.assign({ durationMs: Math.max(0, now - started) }, metadata || {}),
      startedAt: new Date(started).toISOString(),
      endedAt: new Date(now).toISOString(),
    }, options || { keepalive: true });
  }

  function titleCase(value) {
    return String(value || 'Unknown').split(/[_-]+/).map(function (part) {
      return part ? part.charAt(0).toUpperCase() + part.slice(1) : '';
    }).join(' ');
  }

  return {
    log: log,
    logClick: logClick,
    logResult: logResult,
    logBlocked: logBlocked,
    logPageView: logPageView,
    logPageLeave: logPageLeave,
    buildActivity: buildActivity,
    getDeviceId: getDeviceId,
    getSessionId: getSessionId,
    deriveFeature: deriveFeature,
    classifyApiError: classifyApiError,
    getApiErrorMeta: getApiErrorMeta,
    redactCredential: redactCredential,
    shouldTrack: shouldTrack,
  };
});
