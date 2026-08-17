(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LumoraExperienceTransition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  const TRANSITION_TYPE = 'memory_dissolve';
  const TRANSITION_TTL_MS = 60 * 1000;
  const DEFAULT_ACCENT = '#a78bfa';
  const STYLE_ID = 'lumora-experience-transition-style';

  function transitionKey(galaxyId) {
    return `lumora:experience-transition:${String(galaxyId || '')}`;
  }

  function normalizeAccent(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
      ? value.toLowerCase()
      : DEFAULT_ACCENT;
  }

  function saveTransition(storage, galaxyId, value = {}, now = Date.now()) {
    if (!storage || !galaxyId) return false;
    const payload = {
      version: VERSION,
      type: TRANSITION_TYPE,
      accent: normalizeAccent(value.accent),
      createdAt: now,
    };
    try {
      storage.setItem(transitionKey(galaxyId), JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  function consumeTransition(storage, galaxyId, now = Date.now()) {
    if (!storage || !galaxyId) return null;
    const key = transitionKey(galaxyId);
    try {
      const raw = storage.getItem(key);
      storage.removeItem(key);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
      if (payload.version !== VERSION || payload.type !== TRANSITION_TYPE) return null;
      if (!Number.isFinite(payload.createdAt)) return null;
      const age = now - payload.createdAt;
      if (age < 0 || age > TRANSITION_TTL_MS) return null;
      return {
        version: VERSION,
        type: TRANSITION_TYPE,
        accent: normalizeAccent(payload.accent),
      };
    } catch {
      return null;
    }
  }

  function ensureStyles(doc) {
    if (!doc?.head || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .lumora-experience-transition {
        --lumora-transition-accent: ${DEFAULT_ACCENT};
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        overflow: hidden;
        pointer-events: auto;
        opacity: 0;
        background: #060610;
        background:
          radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--lumora-transition-accent) 28%, transparent) 0%, transparent 26%),
          radial-gradient(circle at 50% 50%, #101020 0%, #060610 54%, #020207 100%);
        transition: opacity var(--lumora-transition-duration, 900ms) cubic-bezier(.4, 0, .2, 1);
      }
      .lumora-experience-transition::before,
      .lumora-experience-transition::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: min(74vmin, 680px);
        aspect-ratio: 1;
        border-radius: 50%;
        transform: translate(-50%, -50%) scale(.58);
        border: 1px solid color-mix(in srgb, var(--lumora-transition-accent) 52%, transparent);
        box-shadow: 0 0 90px color-mix(in srgb, var(--lumora-transition-accent) 22%, transparent);
        opacity: .16;
        transition:
          transform var(--lumora-transition-duration, 900ms) cubic-bezier(.2, .7, .2, 1),
          opacity var(--lumora-transition-duration, 900ms) ease;
      }
      .lumora-experience-transition::after {
        width: min(46vmin, 430px);
        transform: translate(-50%, -50%) scale(.34);
        opacity: .28;
      }
      .lumora-experience-transition.is-covering,
      .lumora-experience-transition.is-covered { opacity: 1; }
      .lumora-experience-transition.is-covering::before,
      .lumora-experience-transition.is-covering::after,
      .lumora-experience-transition.is-covered::before,
      .lumora-experience-transition.is-covered::after {
        transform: translate(-50%, -50%) scale(1);
        opacity: .5;
      }
      .lumora-experience-transition.is-revealing {
        opacity: 0;
        pointer-events: none;
      }
      .lumora-experience-transition.is-revealing::before {
        transform: translate(-50%, -50%) scale(1.42);
        opacity: 0;
      }
      .lumora-experience-transition.is-revealing::after {
        transform: translate(-50%, -50%) scale(.72);
        opacity: 0;
      }
      @media (prefers-reduced-motion: reduce) {
        .lumora-experience-transition,
        .lumora-experience-transition::before,
        .lumora-experience-transition::after { transition-duration: 180ms !important; }
      }
    `;
    doc.head.appendChild(style);
  }

  function createVeil(doc, accent) {
    if (!doc?.documentElement) return null;
    ensureStyles(doc);
    const veil = doc.createElement('div');
    veil.className = 'lumora-experience-transition';
    veil.setAttribute('aria-hidden', 'true');
    veil.style.setProperty('--lumora-transition-accent', normalizeAccent(accent));
    doc.documentElement.appendChild(veil);
    return veil;
  }

  function wait(view, duration) {
    return new Promise(resolve => {
      if (view?.setTimeout) view.setTimeout(resolve, duration);
      else setTimeout(resolve, duration);
    });
  }

  function nextPaint(view) {
    return new Promise(resolve => {
      const schedule = callback => {
        if (view?.requestAnimationFrame) view.requestAnimationFrame(callback);
        else setTimeout(callback, 16);
      };
      schedule(() => schedule(resolve));
    });
  }

  async function beginDeparture(options = {}) {
    const {
      storage,
      galaxyId,
      accent,
      document: doc = typeof document !== 'undefined' ? document : null,
      now = Date.now(),
      duration = 900,
    } = options;
    const saved = saveTransition(storage, galaxyId, { accent }, now);
    const veil = createVeil(doc, accent);
    if (!veil) return { saved, reveal: () => Promise.resolve(false) };
    const view = doc.defaultView;
    veil.style.setProperty('--lumora-transition-duration', `${Math.max(0, duration)}ms`);
    await nextPaint(view);
    veil.classList.add('is-covering');
    await wait(view, Math.max(0, duration));
    let released = false;
    return {
      saved,
      async reveal({ duration: revealDuration = 900 } = {}) {
        if (released) return false;
        released = true;
        veil.style.setProperty('--lumora-transition-duration', `${Math.max(0, revealDuration)}ms`);
        await nextPaint(view);
        veil.classList.add('is-revealing');
        await wait(view, Math.max(0, revealDuration));
        veil.remove();
        return true;
      },
    };
  }

  function bootstrapArrival(options = {}) {
    const {
      storage,
      galaxyId,
      document: doc = typeof document !== 'undefined' ? document : null,
      now = Date.now(),
    } = options;
    const payload = consumeTransition(storage, galaxyId, now);
    if (!payload) return null;
    const veil = createVeil(doc, payload.accent);
    if (!veil) return { payload, reveal: () => Promise.resolve(false) };
    veil.classList.add('is-covered');
    let released = false;
    const view = doc.defaultView;
    const safetyTimer = view?.setTimeout?.(() => {
      if (!released) reveal({ duration: 240 });
    }, 12000);
    async function reveal({ duration = 1300 } = {}) {
      if (released) return false;
      released = true;
      if (safetyTimer) view?.clearTimeout?.(safetyTimer);
      veil.style.setProperty('--lumora-transition-duration', `${Math.max(0, duration)}ms`);
      await nextPaint(view);
      veil.classList.add('is-revealing');
      await wait(view, Math.max(0, duration));
      veil.remove();
      return true;
    }
    return {
      payload,
      reveal,
    };
  }

  return Object.freeze({
    TRANSITION_TYPE,
    TRANSITION_TTL_MS,
    beginDeparture,
    bootstrapArrival,
    consumeTransition,
    saveTransition,
  });
});
