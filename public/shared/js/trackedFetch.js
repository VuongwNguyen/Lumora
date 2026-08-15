(function (root) {
  'use strict';

  if (!root || typeof root.fetch !== 'function' || root.__lumoraTrackedFetchInstalled) return;
  root.__lumoraTrackedFetchInstalled = true;

  const nativeFetch = root.fetch.bind(root);
  const NativeXHR = root.XMLHttpRequest;
  const activity = function () { return root.LumoraActivity; };

  function uuid() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
      const random = Math.floor(Math.random() * 16);
      return (char === 'x' ? random : ((random & 3) | 8)).toString(16);
    });
  }

  function urlInfo(input) {
    const raw = typeof input === 'string' ? input : (input && input.url) || '';
    try {
      const url = new URL(raw, root.location.href);
      return { url: url, path: url.pathname, sameOrigin: url.origin === root.location.origin };
    } catch {
      return { url: null, path: String(raw).split(/[?#]/)[0], sameOrigin: false };
    }
  }

  function normalizedEndpoint(path) {
    return String(path || '')
      .replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id')
      .replace(/\/\d{5,}(?=\/|$)/g, '/:id')
      .slice(0, 500);
  }

  function operationFor(method, path) {
    const key = String(method || 'GET').toUpperCase() + ' ' + normalizedEndpoint(path);
    const rules = [
      [/^POST \/auth\/register$/, 'Auth Register'],
      [/^POST \/auth\/login$/, 'Auth Login'],
      [/^POST \/auth\/verify-otp$/, 'Auth OTP Verify'],
      [/^POST \/auth\/resend-otp$/, 'Auth OTP Resend'],
      [/^POST \/auth\/forgot-password$/, 'Auth Password Reset Request'],
      [/^POST \/auth\/verify-reset-otp$/, 'Auth Reset OTP Verify'],
      [/^POST \/auth\/reset-password$/, 'Auth Password Reset'],
      [/^PUT \/auth\/change-password$/, 'Account Password Change'],
      [/^DELETE \/auth\/account$/, 'Account Delete'],
      [/^POST \/auth\/logout$/, 'Portal Logout'],
      [/^POST \/auth\/logout-all$/, 'Account Logout All'],
      [/^DELETE \/auth\/sessions\//, 'Account Session Revoke'],
      [/^GET \/galaxies\/:id\/view$/, 'Viewer Load'],
      [/^POST \/galaxies\/?$/, 'Portal Galaxy Create'],
      [/^GET \/galaxies\/:id$/, 'Galaxy Setup Load'],
      [/^PUT \/galaxies\/:id$/, 'Galaxy Update'],
      [/^DELETE \/galaxies\/:id$/, 'Galaxy Delete'],
      [/^POST \/gallary\/upload$/, 'Galaxy Photo Upload'],
      [/^DELETE \/gallary\/items\/:id$/, 'Galaxy Photo Delete'],
      [/^GET \/media\/soundscapes$/, 'Soundscape Catalog Load'],
      [/^GET \/media\/soundscape-instruments$/, 'Soundscape Instrument Catalog Load'],
      [/^POST \/payment\/create$/, 'Payment Checkout'],
      [/^GET \/payment\/status$/, 'Subscription Status'],
      [/^GET \/payment\/history$/, 'Payment History'],
      [/^POST \/support\/requests$/, 'Support Request'],
      [/^POST \/media\/themes$/, 'Media Theme Create'],
      [/^POST \/media\/musics$/, 'Media Music Create'],
    ];
    for (let i = 0; i < rules.length; i += 1) {
      if (rules[i][0].test(key)) return rules[i][1];
    }
    return null;
  }

  function shouldIgnore(path) {
    return /^\/(activity|admin)(\/|$)/.test(String(path || ''));
  }

  function makeHeaders(input, init, requestId, sameOrigin) {
    const source = (init && init.headers) || (input && input.headers) || undefined;
    const headers = new Headers(source || {});
    if (sameOrigin) {
      headers.set('X-Request-Id', requestId);
      const logger = activity();
      if (logger) {
        headers.set('X-Activity-Session', logger.getSessionId());
        headers.set('X-Anonymous-Id', logger.getDeviceId());
      }
      try {
        if (root.localStorage && root.localStorage.getItem('lumora_tracking_opt_out') === 'true') {
          headers.set('X-Activity-Opt-Out', 'true');
        }
      } catch { /* storage is optional */ }
    }
    return headers;
  }

  function logApiFailure(kind, method, endpoint, startedAt, error, response, requestId) {
    const logger = activity();
    if (!logger) return;
    const durationMs = Date.now() - startedAt;
    const httpStatus = response ? response.status : null;
    const errorType = kind || logger.classifyApiError(httpStatus, error && error.message);
    logger.log({
      action: errorType === 'request_cancelled' ? 'API Request Cancelled' : 'API Error',
      feature: 'reliability',
      level: errorType === 'request_cancelled' ? 'warn' : 'error',
      requestId: requestId,
      description: {
        endpoint: endpoint,
        method: method,
        httpStatus: httpStatus,
        durationMs: durationMs,
        errorType: errorType,
        errorMsg: error && error.message,
      },
    });
  }

  function logOperationResult(operation, ok, method, endpoint, startedAt, response, error, requestId) {
    const logger = activity();
    if (!logger || !operation) return;
    logger.logResult(operation + ' Result', ok, {
      endpoint: endpoint,
      method: method,
      httpStatus: response ? response.status : null,
      durationMs: Date.now() - startedAt,
      requestId: requestId,
    }, error, { requestId: requestId });
  }

  root.fetch = async function trackedFetch(input, init) {
    init = init || {};
    const info = urlInfo(input);
    const method = String(init.method || (input && input.method) || 'GET').toUpperCase();
    if (shouldIgnore(info.path)) return nativeFetch(input, init);

    const endpoint = normalizedEndpoint(info.path);
    const operation = operationFor(method, info.path);
    const requestId = uuid();
    const startedAt = Date.now();
    const nextInit = Object.assign({}, init, { headers: makeHeaders(input, init, requestId, info.sameOrigin) });

    try {
      const response = await nativeFetch(input, nextInit);
      const responseRequestId = response.headers.get('x-request-id') || requestId;
      if (!response.ok) {
        const error = new Error('HTTP ' + response.status);
        error.status = response.status;
        logApiFailure(null, method, endpoint, startedAt, error, response, responseRequestId);
        logOperationResult(operation, false, method, endpoint, startedAt, response, error, responseRequestId);
      } else {
        logOperationResult(operation, true, method, endpoint, startedAt, response, null, responseRequestId);
      }
      return response;
    } catch (error) {
      const cancelled = error && error.name === 'AbortError';
      logApiFailure(cancelled ? 'request_cancelled' : null, method, endpoint, startedAt, error, null, requestId);
      logOperationResult(operation, false, method, endpoint, startedAt, null, error, requestId);
      throw error;
    }
  };

  if (typeof NativeXHR === 'function') {
    const originalOpen = NativeXHR.prototype.open;
    const originalSend = NativeXHR.prototype.send;

    NativeXHR.prototype.open = function trackedOpen(method, url) {
      this.__lumoraTrack = {
        method: String(method || 'GET').toUpperCase(),
        info: urlInfo(url),
        startedAt: 0,
        requestId: uuid(),
      };
      return originalOpen.apply(this, arguments);
    };

    NativeXHR.prototype.send = function trackedSend() {
      const ctx = this.__lumoraTrack;
      if (!ctx || shouldIgnore(ctx.info.path)) return originalSend.apply(this, arguments);
      ctx.startedAt = Date.now();
      ctx.endpoint = normalizedEndpoint(ctx.info.path);
      ctx.operation = operationFor(ctx.method, ctx.info.path);
      if (ctx.info.sameOrigin) {
        try {
          this.setRequestHeader('X-Request-Id', ctx.requestId);
          const logger = activity();
          if (logger) {
            this.setRequestHeader('X-Activity-Session', logger.getSessionId());
            this.setRequestHeader('X-Anonymous-Id', logger.getDeviceId());
          }
          try {
            if (root.localStorage && root.localStorage.getItem('lumora_tracking_opt_out') === 'true') {
              this.setRequestHeader('X-Activity-Opt-Out', 'true');
            }
          } catch { /* storage is optional */ }
        } catch { /* request headers may already be locked */ }
      }

      const finish = (kind) => {
        if (ctx.finished) return;
        ctx.finished = true;
        const response = { status: Number(this.status) || null };
        const responseRequestId = (() => {
          try { return this.getResponseHeader('x-request-id') || ctx.requestId; } catch { return ctx.requestId; }
        })();
        const ok = kind === 'load' && this.status >= 200 && this.status < 400;
        const error = ok ? null : new Error(kind === 'load' ? ('HTTP ' + this.status) : ('XHR ' + kind));
        if (!ok) {
          const errorType = kind === 'abort' ? 'request_cancelled' : (kind === 'timeout' ? 'timeout' : null);
          logApiFailure(errorType, ctx.method, ctx.endpoint, ctx.startedAt, error, response, responseRequestId);
        }
        logOperationResult(ctx.operation, ok, ctx.method, ctx.endpoint, ctx.startedAt, response, error, responseRequestId);
      };
      this.addEventListener('load', function () { finish('load'); }, { once: true });
      this.addEventListener('error', function () { finish('error'); }, { once: true });
      this.addEventListener('timeout', function () { finish('timeout'); }, { once: true });
      this.addEventListener('abort', function () { finish('abort'); }, { once: true });
      return originalSend.apply(this, arguments);
    };
  }

  if (root.Response && root.Response.prototype && typeof root.Response.prototype.json === 'function' && !root.Response.prototype.__lumoraJsonTracked) {
    const nativeJson = root.Response.prototype.json;
    Object.defineProperty(root.Response.prototype, '__lumoraJsonTracked', { value: true });
    root.Response.prototype.json = async function trackedJson() {
      try {
        return await nativeJson.apply(this, arguments);
      } catch (error) {
        const info = urlInfo(this.url || '');
        if (!shouldIgnore(info.path)) {
          const logger = activity();
          if (logger) logger.log({
            action: 'API Response Parse Error', feature: 'reliability', level: 'error',
            description: {
              endpoint: normalizedEndpoint(info.path), httpStatus: this.status || null,
              errorType: 'json_parse_error', errorMsg: error && error.message,
            },
          });
        }
        throw error;
      }
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
