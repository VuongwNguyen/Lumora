(function (root) {
  'use strict';

  if (!root || !root.document || root.__lumoraAutoTrackerInstalled) return;
  root.__lumoraAutoTrackerInstalled = true;
  if (/^\/admin(?:\/|$)/.test(root.location.pathname)) return;

  const doc = root.document;
  const logger = root.LumoraActivity;
  if (!logger || !logger.shouldTrack()) return;

  const path = root.location.pathname;
  const page = detectPage(path);
  const startedAt = Date.now();
  const blockedAt = new WeakMap();
  let offlineAt = null;
  let left = false;

  const PAGE_CONFIG = {
    landing: ['View Landing Page', 'Landing Leave', 'landing'],
    auth: ['View Auth Page', 'Auth Leave', 'auth'],
    portal: ['View Portal Page', 'Portal Leave', 'portal'],
    galaxy_setup: ['View Galaxy Setup Page', 'Galaxy Setup Leave', 'galaxy'],
    story_setup: ['View Story Setup Page', 'Story Setup Leave', 'story'],
    viewer_story: ['Viewer Load Submit', 'Viewer Leave', 'viewer'],
    viewer_fall: ['Viewer Load Submit', 'Viewer Leave', 'viewer'],
    viewer_aurora: ['Viewer Load Submit', 'Viewer Leave', 'viewer'],
    viewer_galaxy: ['Viewer Load Submit', 'Viewer Leave', 'viewer'],
    galaxy_legacy: ['View Galaxy Setup Page', 'Galaxy Setup Leave', 'galaxy'],
    privacy: ['View Privacy Page', 'Privacy Leave', 'legal'],
    terms: ['View Terms Page', 'Terms Leave', 'legal'],
    unknown: ['View Unknown Page', 'App Page Leave', 'other'],
  };

  function detectPage(value) {
    if (value === '/' || value === '/index.html') return 'landing';
    if (/^\/auth(?:\/|$)/.test(value)) return 'auth';
    if (/^\/portal\/galaxy-setup/.test(value)) return 'galaxy_setup';
    if (/^\/portal\/story-setup/.test(value)) return 'story_setup';
    if (/^\/portal\/galaxy(?:\.html)?/.test(value)) return 'galaxy_legacy';
    if (/^\/portal(?:\/|$)/.test(value)) return 'portal';
    if (/^\/story(?:\/|$)/.test(value)) return 'viewer_story';
    if (/^\/fall(?:\/|$)/.test(value)) return 'viewer_fall';
    if (/^\/aurora(?:\/|$)/.test(value)) return 'viewer_aurora';
    if (/^\/(view|galaxy-moon)(?:\/|$)/.test(value)) return 'viewer_galaxy';
    if (/^\/privacy(?:\/|$)/.test(value)) return 'privacy';
    if (/^\/terms(?:\/|$)/.test(value)) return 'terms';
    return 'unknown';
  }

  function templateName() {
    const declared = doc.querySelector('[data-lumora-template]')?.getAttribute('data-lumora-template');
    if (declared && /^(story|fall|aurora|galaxy)$/.test(declared)) return declared;
    if (page === 'viewer_story') return 'story';
    if (page === 'viewer_fall') return 'fall';
    if (page === 'viewer_aurora') return 'aurora';
    if (page === 'viewer_galaxy') return 'galaxy';
    return null;
  }

  function queryContext() {
    const params = new URLSearchParams(root.location.search);
    const galaxyId = params.get('galaxyId');
    const metadata = {};
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (key) {
      const value = params.get(key);
      if (value) metadata[key] = value.slice(0, 200);
    });
    const template = templateName();
    if (template) metadata.template = template;
    return { galaxyId: /^[0-9a-f]{24}$/i.test(galaxyId || '') ? galaxyId : null, metadata: metadata };
  }

  function referrerHost() {
    if (!doc.referrer) return '';
    try { return new URL(doc.referrer).hostname; } catch { return ''; }
  }

  function safeId(element) {
    if (!element) return 'control';
    return (element.getAttribute('data-track-id') || element.id || element.getAttribute('name') || element.getAttribute('role') || element.tagName || 'control')
      .toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'control';
  }

  function title(value) {
    return String(value || '').split(/[-_\s]+/).filter(Boolean).map(function (part) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');
  }

  function pagePrefix() {
    if (page === 'galaxy_setup' || page === 'galaxy_legacy') return 'Galaxy';
    if (page === 'story_setup') return 'Story';
    if (page.indexOf('viewer_') === 0) return 'Viewer';
    return title(page);
  }

  function matches(element, selector) {
    try { return element.matches(selector); } catch { return false; }
  }

  function explicitAction(element, kind) {
    const direct = element.getAttribute('data-track-action');
    if (direct) return direct;
    const id = element.id;
    const tab = element.getAttribute('data-tab');

    if (page === 'landing') {
      if (matches(element, 'a[href="#features"]')) return 'Landing Features Nav Click';
      if (matches(element, 'a[href="#pricing"]')) return 'Landing Pricing Nav Click';
      if (matches(element, 'a[href="/auth/"]') && element.closest('nav')) return 'Landing Header Start Click';
      if (matches(element, '.hero-cta .btn-primary')) return 'Landing Hero Start Click';
      if (matches(element, '.hero-cta .btn-ghost')) return 'Landing Demo Click';
      if (id === 'demoOverlay') return 'Landing Demo Started';
      if (matches(element, '.price-card:nth-of-type(1) .btn-plan')) return 'Landing Plan CTA Click';
      if (matches(element, '.price-card:nth-of-type(2) .btn-plan')) return 'Landing Plan CTA Click';
      if (matches(element, '.price-card:nth-of-type(3) .btn-plan')) return 'Landing Plan CTA Click';
      if (matches(element, '.cta-section .btn-primary')) return 'Landing Bottom Start Click';
      if (matches(element, 'a[href^="/terms"],a[href^="/privacy"]')) return 'Landing Legal Link Click';
      if (matches(element, 'a[href^="/auth"]')) return 'Landing Login Click';
    }

    if (page === 'auth') {
      const authMap = {
        'tab-login': 'Auth Mode Select', 'tab-register': 'Auth Mode Select',
        'toggle-password': 'Auth Password Visibility Toggle', 'toggle-new-password': 'Auth Password Visibility Toggle',
        'btn-forgot': 'Auth Forgot Password Click', 'back-btn': 'Auth Back Click',
        'back-from-forgot': 'Auth Back Click', 'back-from-reset': 'Auth Back Click',
        'btn-resend': 'Auth OTP Resend Click', 'btn-resend-reset': 'Auth Reset OTP Resend Click',
        'legal-terms': 'Auth Legal Link Click', 'legal-privacy': 'Auth Legal Link Click',
      };
      if (authMap[id]) return authMap[id];
    }

    if (page === 'portal') {
      const portalMap = {
        'btn-settings': 'Portal Settings Toggle', 'btn-goto-account': 'Portal Account Click',
        'btn-logout': 'Portal Logout Click', 'btn-open-modal': 'Portal Galaxy Create Open',
        'btn-cancel': 'Portal Galaxy Create Cancel', 'btn-create': 'Portal Galaxy Create Submit',
        'btn-change-pw': 'Account Password Change Submit', 'btn-logout-all': 'Account Logout All Click',
        'btn-delete-account': 'Account Delete Click',
      };
      if (portalMap[id]) return portalMap[id];
      if (tab) return tab === 'subscription' ? 'Subscription View' : 'Portal Tab Select';
      if (matches(element, '[data-plan]')) return 'Subscription Checkout Click';
      if (matches(element, '.galaxy-card')) return 'Portal Galaxy Card Click';
      if (matches(element, '[data-action="view"],.btn-view')) return 'Portal Galaxy Quick View Click';
      if (matches(element, '[data-action="manage"],.btn-manage')) return 'Portal Galaxy Manage Click';
      if (matches(element, '[data-action="copy"],.btn-copy')) return 'Portal Galaxy Copy Link Click';
    }

    if (page === 'galaxy_setup' || page === 'galaxy_legacy') {
      const galaxyMap = {
        'panel-toggle': 'Galaxy Setup Panel Toggle', 'back-link': 'Galaxy Setup Back Click',
        'galaxy-name-button': 'Galaxy Rename Open', 'delete-galaxy-btn': 'Galaxy Delete Click',
        'upload-zone': 'Galaxy Photo Picker Open', 'uploadZone': 'Galaxy Photo Picker Open',
        'caption-add-btn': 'Galaxy Caption Add Click', 'addCaptionBtn': 'Galaxy Caption Add Click',
        'story-setup-btn': 'Galaxy Story Setup Click', 'share-btn': 'Galaxy Share Click',
        'copyLinkBtn': 'Galaxy Share Click', 'deleteGalaxyBtn': 'Galaxy Delete Click',
        'uploadBtn': 'Galaxy Photo Upload Submit', 'btn-story-add': 'Galaxy Story Setup Click',
        'btn-story-dismiss': 'Galaxy Story Setup Cancel', 'btn-story-reset': 'Story Wizard Retry Click',
        'lightbox-close': 'Galaxy Photo Close',
      };
      if (galaxyMap[id]) return galaxyMap[id];
      if (tab) return 'Galaxy Setup Tab Select';
      if (matches(element, '.theme-card,[data-theme-id]')) return 'Galaxy Theme Select';
      if (matches(element, '.music-card,[data-music-id]')) return 'Galaxy Music Select';
      if (matches(element, '.gallery-item,.gallery-thumb')) return 'Galaxy Photo Open';
    }

    if (page === 'story_setup') {
      const storyMap = {
        'panel-toggle': 'Story Panel Toggle', 'back-link': 'Story Back Click',
        'galaxy-name-button': 'Story Rename Open',
      };
      if (storyMap[id]) return storyMap[id];
      if (matches(element, '[data-story-type]')) return 'Story Type Select';
      if (matches(element, '[data-occasion]')) return 'Story Occasion Select';
      if (matches(element, '.choice-btn,[data-choice]')) return 'Story Wizard Choice Select';
      if (matches(element, '.retry-btn')) return 'Story Wizard Retry Click';
      if (matches(element, '.next-btn')) return 'Story Wizard Next Click';
      if (matches(element, 'input[type="file"]')) return 'Story Chapter Photo Picker Open';
    }

    if (page.indexOf('viewer_') === 0) {
      if (id === 'btn-audio' || id === 'toggle-audio') return 'Viewer Audio Toggle';
      if (id === 'lightbox-close' || matches(element, '#lightbox')) return 'Viewer Photo Close';
      if (id === 'intro' || id === 'se-intro') return 'Viewer Start Click';
      if (matches(element, 'img,.photo,.memory-photo,[data-photo-index]')) return 'Viewer Photo Open';
    }

    if (kind === 'submit') return pagePrefix() + ' Form Submit';
    return null;
  }

  function metadataFor(element) {
    const data = { controlId: safeId(element), controlType: String(element.tagName || '').toLowerCase() };
    const tab = element.getAttribute('data-tab');
    if (tab) data.tab = tab.slice(0, 40);
    const plan = element.getAttribute('data-plan');
    if (plan && /^(free|plus|pro)$/.test(plan)) data.plan = plan;
    if (page.indexOf('viewer_') === 0) data.template = templateName();
    if (page === 'landing' && matches(element, '.price-card .btn-plan')) {
      const card = element.closest('.price-card');
      const index = Array.from(doc.querySelectorAll('.price-card')).indexOf(card);
      data.plan = ['free', 'plus', 'pro'][index] || 'unknown';
    }
    if (element.getAttribute('href')) {
      try { data.destinationPath = new URL(element.href, root.location.href).pathname; } catch { /* ignore */ }
    }
    return data;
  }

  function genericAction(element, suffix) {
    return pagePrefix() + ' ' + title(safeId(element)) + ' ' + suffix;
  }

  function interactiveTarget(target) {
    return target && target.closest && target.closest('button,a,input[type="button"],input[type="submit"],input[type="file"],[role="button"],[data-track-action],.galaxy-card,.theme-card,.music-card,.gallery-item,.check-item,#intro,#se-intro,#demoOverlay');
  }

  doc.addEventListener('click', function (event) {
    const element = interactiveTarget(event.target);
    if (!element || element.hasAttribute('data-track-ignore')) return;
    if (matches(element, 'button[type="submit"],input[type="submit"]') && element.form) return;
    const action = explicitAction(element, 'click') || genericAction(element, 'Click');
    logger.logClick(action, metadataFor(element), queryContext());
  }, true);

  doc.addEventListener('submit', function (event) {
    const form = event.target;
    if (!form || form.hasAttribute('data-track-ignore')) return;
    let action = explicitAction(form, 'submit');
    if (page === 'auth') {
      const formMap = {
        'form-auth': doc.getElementById('tab-register') && doc.getElementById('tab-register').classList.contains('active') ? 'Auth Register Submit' : 'Auth Login Submit',
        'form-otp': 'Auth OTP Verify Submit', 'form-forgot': 'Auth Password Reset Request Submit',
        'form-reset': 'Auth Password Reset Submit',
      };
      action = formMap[form.id] || action;
    }
    logger.logClick(action || genericAction(form, 'Submit'), { formId: safeId(form) }, queryContext());
  }, true);

  doc.addEventListener('invalid', function (event) {
    const form = event.target && event.target.form;
    if (!form) return;
    const last = blockedAt.get(form) || 0;
    if (Date.now() - last < 2000) return;
    blockedAt.set(form, Date.now());
    logger.logBlocked(pagePrefix() + ' Submit Blocked', 'invalid_input', {
      formId: safeId(form), field: safeId(event.target),
    }, queryContext());
  }, true);

  doc.addEventListener('change', function (event) {
    const element = event.target;
    if (!element || element.hasAttribute('data-track-ignore')) return;
    const type = String(element.type || '').toLowerCase();
    if (!['file', 'checkbox', 'radio'].includes(type) && element.tagName !== 'SELECT') return;
    let action = explicitAction(element, 'change') || genericAction(element, 'Change');
    const metadata = metadataFor(element);
    if (type === 'file') {
      const files = Array.from(element.files || []);
      metadata.count = files.length;
      metadata.totalBytes = files.reduce(function (sum, file) { return sum + (file.size || 0); }, 0);
      if (page === 'galaxy_setup' || page === 'galaxy_legacy') action = 'Galaxy Photo Files Selected';
      if (page === 'story_setup') action = 'Story Chapter Photo Upload Submit';
    } else if (type === 'checkbox' || type === 'radio') {
      metadata.checked = Boolean(element.checked);
    } else {
      metadata.selectedIndex = element.selectedIndex;
    }
    logger.logClick(action, metadata, queryContext());
  }, true);

  doc.addEventListener('pointerdown', function (event) {
    const element = interactiveTarget(event.target);
    if (!element || (!element.disabled && element.getAttribute('aria-disabled') !== 'true')) return;
    const last = blockedAt.get(element) || 0;
    if (Date.now() - last < 2000) return;
    blockedAt.set(element, Date.now());
    const base = explicitAction(element, 'click') || genericAction(element, 'Click');
    logger.logBlocked(base.replace(/ (Click|Submit)$/, ' Blocked'), element.dataset.blockedReason || 'operation_in_progress', metadataFor(element), queryContext());
  }, true);

  function resourceMeta(target) {
    const raw = target.currentSrc || target.src || target.href || '';
    let resource = '';
    try {
      const url = new URL(raw, root.location.href);
      resource = url.origin === root.location.origin ? url.pathname : url.hostname;
    } catch { resource = String(raw).split(/[?#]/)[0].slice(0, 500); }
    return { resourceType: String(target.tagName || '').toLowerCase(), resource: resource, errorType: 'resource_load_fail' };
  }

  root.addEventListener('error', function (event) {
    const target = event.target;
    if (target && target !== root && /^(IMG|SCRIPT|LINK|AUDIO|VIDEO|IFRAME)$/.test(target.tagName || '')) {
      logger.log({ action: 'Resource Load Error', feature: 'reliability', level: 'error', description: resourceMeta(target) });
      return;
    }
    logger.log({
      action: 'App JavaScript Error', feature: 'reliability', level: 'error',
      description: {
        errorType: 'javascript_error', errorMsg: event.message,
        stack: event.error && event.error.stack, filename: event.filename,
        line: event.lineno, column: event.colno,
      },
    });
  }, true);

  root.addEventListener('unhandledrejection', function (event) {
    const reason = event.reason;
    logger.log({
      action: 'App Unhandled Rejection', feature: 'reliability', level: 'error',
      description: {
        errorType: 'unhandled_rejection', errorMsg: reason && reason.message || String(reason || 'Unknown rejection'),
        stack: reason && reason.stack,
      },
    });
  });

  doc.addEventListener('webglcontextlost', function (event) {
    logger.log({
      action: 'Viewer WebGL Error', feature: 'viewer', level: 'error',
      description: { errorType: 'viewer_webgl_fail', template: templateName(), statusMessage: event.statusMessage || 'context_lost' },
    });
  }, true);

  if (root.HTMLMediaElement && root.HTMLMediaElement.prototype && typeof root.HTMLMediaElement.prototype.play === 'function') {
    const mediaPrototype = root.HTMLMediaElement.prototype;
    if (!mediaPrototype.__lumoraPlayTracked) {
      const nativePlay = mediaPrototype.play;
      Object.defineProperty(mediaPrototype, '__lumoraPlayTracked', { value: true });
      mediaPrototype.play = function trackedMediaPlay() {
        let result;
        try { result = nativePlay.apply(this, arguments); }
        catch (error) {
          logger.log({
            action: 'Viewer Audio Error', feature: page.indexOf('viewer_') === 0 ? 'viewer' : 'media', level: 'error',
            description: { errorType: 'viewer_audio_fail', errorMsg: error.message, template: templateName() },
          });
          throw error;
        }
        if (result && typeof result.catch === 'function') {
          return result.catch(function (error) {
            const blocked = error && error.name === 'NotAllowedError';
            logger.log({
              action: blocked ? 'Viewer Audio Blocked' : 'Viewer Audio Error',
              feature: page.indexOf('viewer_') === 0 ? 'viewer' : 'media',
              level: blocked ? 'warn' : 'error',
              description: {
                reason: blocked ? 'autoplay_denied' : 'play_failed',
                errorType: blocked ? 'request_cancelled' : 'viewer_audio_fail',
                errorMsg: error && error.message, template: templateName(),
              },
            });
            throw error;
          });
        }
        return result;
      };
    }
  }

  try {
    const clipboard = root.navigator && root.navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function' && !clipboard.__lumoraTracked) {
      const nativeWriteText = clipboard.writeText.bind(clipboard);
      Object.defineProperty(clipboard, '__lumoraTracked', { value: true });
      clipboard.writeText = function trackedClipboardWrite() {
        const operationStartedAt = Date.now();
        return nativeWriteText.apply(clipboard, arguments).then(function (result) {
          logger.logResult('Share Clipboard Result', true, { durationMs: Date.now() - operationStartedAt });
          return result;
        }).catch(function (error) {
          logger.logResult('Share Clipboard Result', false, {
            durationMs: Date.now() - operationStartedAt, errorType: 'clipboard_fail',
          }, error);
          throw error;
        });
      };
    }
  } catch { /* clipboard properties can be read-only */ }

  root.addEventListener('offline', function () {
    offlineAt = Date.now();
    logger.log({ action: 'App Offline', feature: 'reliability', level: 'warn', description: { page: page } });
  });
  root.addEventListener('online', function () {
    logger.log({ action: 'App Online', feature: 'reliability', description: { offlineDurationMs: offlineAt ? Date.now() - offlineAt : null } });
    offlineAt = null;
  });
  doc.addEventListener('visibilitychange', function () {
    logger.log({ action: 'App Visibility Changed', feature: 'reliability', description: { to: doc.visibilityState } });
  });

  function leave(exitVia) {
    if (left) return;
    left = true;
    const config = PAGE_CONFIG[page] || PAGE_CONFIG.unknown;
    const context = queryContext();
    logger.log({
      action: config[1], feature: config[2], page: page, galaxyId: context.galaxyId,
      description: Object.assign({ durationMs: Date.now() - startedAt, exitVia: exitVia }, context.metadata),
      startedAt: new Date(startedAt).toISOString(), endedAt: new Date().toISOString(),
    }, { keepalive: true });
  }
  root.addEventListener('pagehide', function () { leave('pagehide'); });
  root.addEventListener('beforeunload', function () { leave('beforeunload'); });

  function observeOnce(selector, action) {
    const element = doc.querySelector(selector);
    if (!element || typeof root.IntersectionObserver !== 'function') return;
    const observer = new root.IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; })) {
        logger.log({ action: action, description: { section: selector.replace('#', '') } });
        observer.disconnect();
      }
    }, { threshold: 0.35 });
    observer.observe(element);
  }

  const context = queryContext();
  const config = PAGE_CONFIG[page] || PAGE_CONFIG.unknown;
  let sessionStarted = false;
  try {
    const sessionKey = 'lumora_activity_started_' + logger.getSessionId();
    sessionStarted = root.sessionStorage.getItem(sessionKey) === 'true';
    if (!sessionStarted) root.sessionStorage.setItem(sessionKey, 'true');
  } catch { /* session storage is optional */ }
  if (!sessionStarted) {
    logger.log({
      action: 'App Session Started', feature: 'reliability', page: page,
      description: Object.assign({ referrerHost: referrerHost() }, context.metadata),
    });
  }
  logger.log({
    action: config[0], feature: config[2], page: page, galaxyId: context.galaxyId,
    status: page.indexOf('viewer_') === 0 ? undefined : 1,
    description: context.metadata, startedAt: new Date(startedAt).toISOString(),
  });
  if (page === 'landing') {
    observeOnce('#pricing', 'Landing Pricing Viewed');
    observeOnce('#demo', 'Landing Demo Viewed');
  }
})(typeof window !== 'undefined' ? window : globalThis);
