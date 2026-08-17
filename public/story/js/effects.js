const EFFECT_NAMES = Object.freeze(['none', 'stardust', 'firefly', 'aurora']);

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function resizeCanvas(canvas) {
  const parent = canvas.parentElement;
  if (!parent) return;
  canvas.width = parent.clientWidth || window.innerWidth;
  canvas.height = parent.clientHeight || window.innerHeight;
}

function clearCanvas(canvas) {
  const context = canvas?.getContext?.('2d');
  if (context) context.clearRect(0, 0, canvas.width, canvas.height);
}

function bindResize(canvas, resize) {
  if (typeof window === 'undefined') return () => {};
  let frameId = null;
  const onResize = () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(() => {
      frameId = null;
      resizeCanvas(canvas);
      resize();
    });
  };
  window.addEventListener('resize', onResize, { passive: true });
  return () => {
    window.removeEventListener('resize', onResize);
    if (frameId !== null) cancelAnimationFrame(frameId);
  };
}

function runStardust(canvas, runtime) {
  resizeCanvas(canvas);
  const context = canvas.getContext('2d');
  let width = canvas.width;
  let height = canvas.height;
  const particleCount = 130;
  const particles = Array.from({ length: particleCount }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.2 + 0.3,
    vx: (Math.random() - 0.5) * 0.18,
    vy: -(Math.random() * 0.38 + 0.08),
    alpha: Math.random() * 0.55 + 0.2,
    flicker: Math.random() * Math.PI * 2,
  }));
  const unbindResize = bindResize(canvas, () => {
    width = canvas.width;
    height = canvas.height;
  });
  let frameId;
  function draw() {
    context.clearRect(0, 0, width, height);
    const density = runtime.reducedMotion ? 0.35 : 1;
    const movement = runtime.reducedMotion ? 0.35 : 1;
    const visibleCount = Math.round(particles.length * density * runtime.intensity);
    for (let index = 0; index < visibleCount; index++) {
      const particle = particles[index];
      particle.x += particle.vx * movement;
      particle.y += particle.vy * movement;
      particle.flicker += 0.04 * movement;
      if (particle.y < -4) {
        particle.y = height + 4;
        particle.x = Math.random() * width;
      }
      const alpha = particle.alpha * (0.55 + 0.45 * Math.sin(particle.flicker));
      context.beginPath();
      context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      context.fillStyle = `rgba(255,240,220,${alpha})`;
      context.fill();
    }
    frameId = requestAnimationFrame(draw);
  }
  draw();
  return () => {
    cancelAnimationFrame(frameId);
    unbindResize();
    context.clearRect(0, 0, width, height);
  };
}

function runFirefly(canvas, runtime) {
  resizeCanvas(canvas);
  const context = canvas.getContext('2d');
  let width = canvas.width;
  let height = canvas.height;
  const flyCount = 22;
  const flies = Array.from({ length: flyCount }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 3.5 + 2.5,
    vx: (Math.random() - 0.5) * 0.28,
    vy: (Math.random() - 0.5) * 0.28,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.012 + 0.006,
    warm: Math.random() < 0.5,
  }));
  const unbindResize = bindResize(canvas, () => {
    width = canvas.width;
    height = canvas.height;
  });
  let frameId;
  function draw() {
    context.clearRect(0, 0, width, height);
    const time = Date.now();
    const density = runtime.reducedMotion ? 0.4 : 1;
    const movement = runtime.reducedMotion ? 0.3 : 1;
    const visibleCount = Math.round(flies.length * density * runtime.intensity);
    for (let index = 0; index < visibleCount; index++) {
      const fly = flies[index];
      fly.x += (fly.vx + Math.sin(time * 0.0007 + fly.phase) * 0.38) * movement;
      fly.y += (fly.vy + Math.cos(time * 0.0008 + fly.phase) * 0.32) * movement;
      if (fly.x < -30) fly.x = width + 30;
      if (fly.x > width + 30) fly.x = -30;
      if (fly.y < -30) fly.y = height + 30;
      if (fly.y > height + 30) fly.y = -30;
      const pulse = 0.45 + 0.55 * Math.sin(time * fly.speed * 1000 + fly.phase);
      const color = fly.warm ? '255,210,110' : '190,150,255';
      const gradient = context.createRadialGradient(fly.x, fly.y, 0, fly.x, fly.y, fly.r * 3.8);
      gradient.addColorStop(0, `rgba(${color},${(pulse * 0.85).toFixed(2)})`);
      gradient.addColorStop(0.4, `rgba(${color},${(pulse * 0.28).toFixed(2)})`);
      gradient.addColorStop(1, `rgba(${color},0)`);
      context.beginPath();
      context.arc(fly.x, fly.y, fly.r * 3.8, 0, Math.PI * 2);
      context.fillStyle = gradient;
      context.fill();
    }
    frameId = requestAnimationFrame(draw);
  }
  draw();
  return () => {
    cancelAnimationFrame(frameId);
    unbindResize();
    context.clearRect(0, 0, width, height);
  };
}

function runAurora(canvas, runtime) {
  resizeCanvas(canvas);
  const context = canvas.getContext('2d');
  let width = canvas.width;
  let height = canvas.height;
  const bands = [
    { alpha: 0.22, hue: 260, hue2: 280, offset: 0 },
    { alpha: 0.30, hue: 300, hue2: 320, offset: 1.2 },
    { alpha: 0.18, hue: 210, hue2: 240, offset: 2.5 },
  ];
  const unbindResize = bindResize(canvas, () => {
    width = canvas.width;
    height = canvas.height;
  });
  let frameId;
  function draw() {
    context.clearRect(0, 0, width, height);
    const movement = runtime.reducedMotion ? 0.25 : 1;
    const time = Date.now() / 3000 * movement;
    bands.forEach((band) => {
      const alpha = band.alpha * runtime.intensity * (runtime.reducedMotion ? 0.55 : 1);
      const y1 = height * (0.22 + 0.14 * Math.sin(time + band.offset));
      const y2 = height * (0.50 + 0.10 * Math.sin(time * 1.3 + band.offset + 1));
      const gradient = context.createLinearGradient(0, y1, 0, y2);
      gradient.addColorStop(0, `hsla(${band.hue},75%,65%,0)`);
      gradient.addColorStop(0.3, `hsla(${band.hue},75%,65%,${alpha})`);
      gradient.addColorStop(0.7, `hsla(${band.hue2},70%,62%,${(alpha * 0.55).toFixed(2)})`);
      gradient.addColorStop(1, `hsla(${band.hue},75%,65%,0)`);
      context.save();
      context.beginPath();
      context.moveTo(0, y1);
      for (let x = 0; x <= width; x += 6) {
        const wave = Math.sin(x / width * Math.PI * 2.8 + time * 2.2 + band.offset) * height * 0.06
          + Math.sin(x / width * Math.PI * 4.5 + time * 1.5 + band.offset) * height * 0.03;
        context.lineTo(x, y1 + wave);
      }
      context.lineTo(width, y2);
      context.lineTo(0, y2);
      context.closePath();
      context.fillStyle = gradient;
      context.fill();
      context.restore();
    });
    frameId = requestAnimationFrame(draw);
  }
  draw();
  return () => {
    cancelAnimationFrame(frameId);
    unbindResize();
    context.clearRect(0, 0, width, height);
  };
}

const EFFECT_RUNNERS = Object.freeze({
  stardust: runStardust,
  firefly: runFirefly,
  aurora: runAurora,
});

export function createEffect(name, canvas, options = {}) {
  const effectName = EFFECT_NAMES.includes(name) ? name : 'none';
  const runtime = {
    intensity: clamp(options.intensity, 0, 1, 1),
    reducedMotion: options.reducedMotion ?? prefersReducedMotion(),
  };
  let running = false;
  let destroyed = false;
  let fadedOut = false;
  let stopRunner = () => {};

  function setOpacity(value, duration = 0) {
    if (!canvas) return;
    canvas.style.transition = duration > 0 ? `opacity ${duration}ms ease` : '';
    canvas.style.opacity = String(value);
  }

  const controller = {
    name: effectName,
    get running() { return running; },
    get destroyed() { return destroyed; },
    get intensity() { return runtime.intensity; },
    get reducedMotion() { return runtime.reducedMotion; },

    start() {
      if (destroyed || running || !canvas || effectName === 'none') return false;
      const runner = EFFECT_RUNNERS[effectName];
      stopRunner = runner(canvas, runtime);
      running = true;
      setOpacity(fadedOut ? 0 : runtime.intensity);
      return true;
    },

    stop() {
      if (!running) return false;
      stopRunner();
      stopRunner = () => {};
      running = false;
      clearCanvas(canvas);
      return true;
    },

    setIntensity(value) {
      runtime.intensity = clamp(value, 0, 1, runtime.intensity);
      if (!fadedOut) setOpacity(runtime.intensity);
      return runtime.intensity;
    },

    fadeIn(duration = 0) {
      fadedOut = false;
      if (!running) controller.start();
      setOpacity(runtime.intensity, clamp(duration, 0, 30000, 0));
    },

    fadeOut(duration = 0) {
      fadedOut = true;
      setOpacity(0, clamp(duration, 0, 30000, 0));
    },

    destroy() {
      if (destroyed) return;
      controller.stop();
      if (canvas) {
        canvas.style.transition = '';
        canvas.style.opacity = '';
      }
      destroyed = true;
    },
  };

  return controller;
}

export function initEffect(name, canvas) {
  const effect = createEffect(name, canvas);
  effect.start();
  const cleanup = () => effect.destroy();
  cleanup.effect = effect;
  return cleanup;
}

export { EFFECT_NAMES };
