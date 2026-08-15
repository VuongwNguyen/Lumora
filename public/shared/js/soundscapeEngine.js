(function (root) {
  'use strict';

  const AudioContextClass = root.AudioContext || root.webkitAudioContext;
  const AUDIO_RESUME_TIMEOUT_MS = 1600;
  const ACOUSTIC_ENVIRONMENTS = Object.freeze({
    neutral: Object.freeze({
      clarityGain: 3.2, delayWetScale: 1, reverbWetScale: 1,
      stereoWidthScale: 1, outputScale: 1,
    }),
    open_space: Object.freeze({
      clarityGain: 4.1, delayWetScale: 1.18, reverbWetScale: 1.28,
      stereoWidthScale: 1.12, outputScale: 0.98,
    }),
    memory_focus: Object.freeze({
      clarityGain: 5.4, delayWetScale: 0.48, reverbWetScale: 0.56,
      stereoWidthScale: 0.62, outputScale: 1.08,
    }),
  });
  const RECIPES = Object.freeze({
    deep_focus: {
      root: 220, ratios: [1, 1.2599, 1.4983], wave: 'sine', filter: 5200, highpass: 220, noise: 0,
      tempo: 76, melody: [0, 4, 7, 11, 7, 4, 2, 7], octave: 1, padGain: 0.022, noteGain: 0.068, noteLength: 1.25,
      chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [7, 11, 14, 19]],
      chordPattern: [0, 2, 1, 3, 2, 1, 0, 2], chordEvery: 8,
      instrument: 'soft_keys', noteAttack: 0.025, noteSpacing: 1.9, motionSpacing: 0.45, panWidth: 0.42,
      instrumentVariants: ['soft_keys', 'soft_keys', 'celesta', 'nylon'],
      counterInstrument: 'harp', counterEvery: 2, counterOffset: 1, counterStep: 1,
      counterGain: 0.027, counterOctave: 1, counterDelay: 0.34, counterLength: 0.78,
      accentInstrument: 'celesta', accentEvery: 8, accentOffset: 4, accentStep: 2,
      accentGain: 0.024, accentOctave: 2, accentDelay: 0.08, accentLength: 0.72,
      delayTime: 0.18, delayWet: 0.07, delayFeedback: 0.035,
      reverbSeconds: 1.65, reverbDecay: 3.4, reverbGain: 0.065,
    },
    cosmic_drift: {
      root: 146.83, ratios: [1, 1.1225, 1.4983], wave: 'sine', filter: 3600, highpass: 135, noise: 0.002,
      tempo: 58, melody: [0, 7, 11, 14, 11, 7], octave: 1, padGain: 0.032, noteGain: 0.048, noteLength: 2.15,
      chords: [[0, 2, 7, 9], [-3, 0, 4, 7], [5, 7, 12, 16], [2, 7, 9, 14]],
      chordPattern: [0, 2, 3, 1, 2, 0], chordEvery: 6,
      instrument: 'glass', noteAttack: 0.075, noteSpacing: 3, motionSpacing: 0.65, panWidth: 0.82,
      instrumentVariants: ['glass', 'glass', 'airy_voice', 'glass'],
      counterInstrument: 'flute', counterEvery: 3, counterOffset: 2, counterStep: 2,
      counterGain: 0.018, counterOctave: 1, counterDelay: 0.62, counterLength: 2.3,
      accentInstrument: 'celesta', accentEvery: 6, accentOffset: 3, accentStep: 1,
      accentGain: 0.017, accentOctave: 2, accentDelay: 0.18, accentLength: 0.9,
      delayTime: 0.32, delayWet: 0.08, delayFeedback: 0.05,
      reverbSeconds: 2.6, reverbDecay: 3.2, reverbGain: 0.085,
    },
    aurora_bloom: {
      root: 174.61, ratios: [1, 1.2599, 1.4983], wave: 'sine', filter: 6200, highpass: 225, noise: 0,
      tempo: 88, melody: [0, 4, 7, 9, 12, 9, 7, 4], octave: 1, padGain: 0.016, noteGain: 0.072, noteLength: 0.82,
      chords: [[0, 4, 7, 14], [5, 9, 12, 16], [9, 12, 16, 19], [7, 11, 14, 18]],
      chordPattern: [0, 1, 2, 3, 2, 1, 3, 1], chordEvery: 8,
      instrument: 'glass', noteAttack: 0.012, noteSpacing: 1.25, motionSpacing: 0.28, panWidth: 0.68,
      instrumentVariants: ['glass', 'celesta', 'glass', 'bell'],
      counterInstrument: 'harp', counterEvery: 2, counterOffset: 0, counterStep: 2,
      counterGain: 0.031, counterOctave: 1, counterDelay: 0.22, counterLength: 0.52,
      accentInstrument: 'kalimba', accentEvery: 4, accentOffset: 2, accentStep: 1,
      accentGain: 0.026, accentOctave: 2, accentDelay: 0.11, accentLength: 0.46,
      delayTime: 0.2, delayWet: 0.055, delayFeedback: 0.03,
      reverbSeconds: 1.5, reverbDecay: 3.8, reverbGain: 0.055,
    },
    memory_glow: {
      root: 164.81, ratios: [1, 1.2599, 1.4983], wave: 'sine', filter: 4200, highpass: 165, noise: 0,
      tempo: 68, melody: [0, 4, 7, 11, 9, 7, 4, 2], octave: 1, padGain: 0.027, noteGain: 0.057, noteLength: 1.65,
      chords: [[0, 4, 7, 9], [-3, 0, 4, 7], [5, 9, 12, 16], [7, 11, 14, 21]],
      chordPattern: [0, 1, 2, 1, 3, 2, 1, 0], chordEvery: 8,
      instrument: 'soft_keys', noteAttack: 0.04, noteSpacing: 2.25, motionSpacing: 0.5, panWidth: 0.34,
      instrumentVariants: ['soft_keys', 'nylon', 'soft_keys', 'soft_keys'],
      counterInstrument: 'flute', counterEvery: 4, counterOffset: 3, counterStep: 2,
      counterGain: 0.016, counterOctave: 1, counterDelay: 0.5, counterLength: 2,
      accentInstrument: 'nylon', accentEvery: 4, accentOffset: 1, accentStep: 1,
      accentGain: 0.022, accentOctave: 1, accentDelay: 0.2, accentLength: 0.88,
      delayTime: 0.24, delayWet: 0.045, delayFeedback: 0.025,
      reverbSeconds: 1.9, reverbDecay: 3.5, reverbGain: 0.06,
    },
    falling_stars: {
      root: 196, ratios: [1, 1.2599, 1.4983], wave: 'sine', filter: 6800, highpass: 245, noise: 0.001,
      tempo: 94, melody: [0, 7, 12, 16, 14, 12, 7, 4], octave: 1, padGain: 0.012, noteGain: 0.076, noteLength: 0.7,
      chords: [[0, 7, 12, 16], [2, 9, 14, 17], [5, 12, 16, 19], [7, 14, 18, 21]],
      chordPattern: [0, 2, 3, 1, 3, 2, 0, 3], chordEvery: 8,
      instrument: 'bell', noteAttack: 0.008, noteSpacing: 1, motionSpacing: 0.22, panWidth: 0.92,
      instrumentVariants: ['bell', 'kalimba', 'bell', 'celesta'],
      counterInstrument: 'harp', counterEvery: 2, counterOffset: 1, counterStep: 1,
      counterGain: 0.036, counterOctave: 1, counterDelay: 0.16, counterLength: 0.42,
      accentInstrument: 'marimba', accentEvery: 4, accentOffset: 0, accentStep: 2,
      accentGain: 0.028, accentOctave: 1, accentDelay: 0.08, accentLength: 0.5,
      delayTime: 0.14, delayWet: 0.05, delayFeedback: 0.025,
      reverbSeconds: 1.25, reverbDecay: 4, reverbGain: 0.045,
    },
  });

  const INSTRUMENTS = Object.freeze({
    soft_keys: Object.freeze({
      wave: 'triangle', harmonicRatio: 2, harmonicMix: 0.11,
      cutoff: 4700, attack: 0.025,
    }),
    glass: Object.freeze({
      wave: 'sine', harmonicRatio: 2.01, harmonicMix: 0.34,
      cutoff: 7600, attack: 0.008,
    }),
    harp: Object.freeze({
      wave: 'triangle', harmonicRatio: 2, harmonicMix: 0.09,
      cutoff: 6200, attack: 0.006,
    }),
    flute: Object.freeze({
      wave: 'sine', harmonicRatio: 2, harmonicMix: 0.035,
      cutoff: 3400, attack: 0.08, vibrato: 4.8, vibratoDepth: 7,
    }),
    bell: Object.freeze({
      wave: 'sine', harmonicRatio: 3.01, harmonicMix: 0.3,
      cutoff: 8200, attack: 0.004,
    }),
    celesta: Object.freeze({
      wave: 'sine', harmonicRatio: 3.01, harmonicMix: 0.2,
      cutoff: 8800, attack: 0.006,
    }),
    kalimba: Object.freeze({
      wave: 'triangle', harmonicRatio: 2.75, harmonicMix: 0.13,
      cutoff: 5700, attack: 0.004,
    }),
    nylon: Object.freeze({
      wave: 'triangle', harmonicRatio: 2, harmonicMix: 0.05,
      cutoff: 3800, attack: 0.012,
    }),
    marimba: Object.freeze({
      wave: 'sine', harmonicRatio: 4, harmonicMix: 0.085,
      cutoff: 4300, attack: 0.005,
    }),
    airy_voice: Object.freeze({
      wave: 'sine', harmonicRatio: 1.5, harmonicMix: 0.04,
      cutoff: 3100, attack: 0.16, vibrato: 4.2, vibratoDepth: 4,
    }),
  });

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  }

  function seedHash(value) {
    const input = String(value || 'lumora');
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let state = seed || 1;
    return function random() {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createPanNode(context) {
    if (typeof context.createStereoPanner === 'function') return context.createStereoPanner();
    return context.createGain();
  }

  function setPan(node, value) {
    if (node.pan) node.pan.value = value;
  }

  function smoothAudioParam(param, target, context, durationSeconds) {
    if (!param || !context) return;
    const now = context.currentTime;
    const duration = clamp(durationSeconds, 0, 8, 1.8);
    if (typeof param.cancelAndHoldAtTime === 'function') {
      param.cancelAndHoldAtTime(now);
    } else {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
    }
    if (duration === 0) {
      param.setValueAtTime(target, now);
    } else if (typeof param.linearRampToValueAtTime === 'function') {
      param.linearRampToValueAtTime(target, now + duration);
    } else {
      param.setTargetAtTime(target, now, Math.max(0.01, duration / 3));
    }
  }

  function configurePlaybackAudioSession() {
    try {
      if (root.navigator?.audioSession) root.navigator.audioSession.type = 'playback';
    } catch {}
  }

  function normalizedConfig(value) {
    const input = value && typeof value === 'object' ? value : {};
    const preset = RECIPES[input.preset] ? input.preset : 'none';
    const recipe = RECIPES[preset];
    const instrument = input.instrument === 'auto' || INSTRUMENTS[input.instrument]
      ? input.instrument
      : 'auto';
    return {
      preset,
      intensity: preset === 'none' ? 0 : clamp(input.intensity, 0, 100, 50),
      warmth: clamp(input.warmth, 0, 100, 50),
      motion: preset === 'none' ? 0 : clamp(input.motion, 0, 100, 40),
      instrument,
      tempo: clamp(input.tempo, 40, 140, recipe?.tempo ?? 76),
      space: clamp(input.space, 0, 100, 50),
      variation: clamp(input.variation, 0, 100, 50),
      seed: String(input.seed || preset || 'lumora'),
    };
  }

  class LumoraSoundscapeAudio {
    constructor(config) {
      this.config = normalizedConfig(config);
      this.paused = true;
      this.loop = true;
      this.preload = 'none';
      this.onplay = null;
      this.onpause = null;
      this.oncanplay = null;
      this.onloadeddata = null;
      this.onloadedmetadata = null;
      this.onended = null;
      this.onerror = null;
      this._volume = 0.98;
      this._muted = false;
      this._context = null;
      this._master = null;
      this._nodes = [];
      this._chimeTimer = null;
      this._pauseTimer = null;
      this._random = seededRandom(seedHash(this.config.seed));
      this._melodyStep = 0;
      this._melodyDelay = null;
      this._melodyReverb = null;
      this._padOscillators = [];
      this._acousticEnvironment = 'neutral';
      this._acousticNodes = null;
      this._stereoWidthScale = 1;
      this._phraseState = null;
      this._phraseNumber = 0;
      this._lastVariation = -1;
      this._lastInversion = -1;
      this._destroyed = false;
    }

    get volume() { return this._volume; }
    set volume(value) {
      this._volume = clamp(value, 0, 1, 0.7);
      this._applyMasterGain();
    }

    get muted() { return this._muted; }
    set muted(value) {
      this._muted = Boolean(value);
      this._applyMasterGain();
    }

    _targetGain() {
      if (this.paused || this._muted) return 0.0001;
      const intensity = this.config.intensity / 100;
      return Math.max(0.0001, this._volume * (0.12 + intensity * 0.28));
    }

    _applyMasterGain() {
      if (!this._context || !this._master) return;
      const now = this._context.currentTime;
      this._master.gain.cancelScheduledValues(now);
      this._master.gain.setTargetAtTime(this._targetGain(), now, 0.18);
    }

    setEnvironment(name, options) {
      const environment = ACOUSTIC_ENVIRONMENTS[name];
      if (!environment) return false;
      this._acousticEnvironment = name;
      this._stereoWidthScale = environment.stereoWidthScale;
      if (!this._context || !this._acousticNodes) return true;

      const transitionSeconds = clamp(options?.transitionSeconds, 0, 8, 1.8);
      const nodes = this._acousticNodes;
      smoothAudioParam(nodes.clarity.gain, environment.clarityGain, this._context, transitionSeconds);
      smoothAudioParam(
        nodes.delayWetGain.gain,
        nodes.baseDelayWet * environment.delayWetScale,
        this._context,
        transitionSeconds,
      );
      smoothAudioParam(
        nodes.reverbGain.gain,
        nodes.baseReverbWet * environment.reverbWetScale,
        this._context,
        transitionSeconds,
      );
      smoothAudioParam(
        nodes.environmentGain.gain,
        environment.outputScale,
        this._context,
        transitionSeconds,
      );
      nodes.padPanners.forEach(({ node, basePan }) => {
        smoothAudioParam(
          node.pan,
          basePan * environment.stereoWidthScale,
          this._context,
          transitionSeconds,
        );
      });
      return true;
    }

    _createNoiseBuffer(seconds) {
      const length = Math.max(1, Math.floor(this._context.sampleRate * seconds));
      const buffer = this._context.createBuffer(1, length, this._context.sampleRate);
      const channel = buffer.getChannelData(0);
      let brown = 0;
      for (let index = 0; index < length; index += 1) {
        const white = this._random() * 2 - 1;
        brown = (brown + 0.018 * white) / 1.018;
        channel[index] = brown * 2.8;
      }
      return buffer;
    }

    _createImpulseBuffer(seconds, decay) {
      const length = Math.max(1, Math.floor(this._context.sampleRate * seconds));
      const buffer = this._context.createBuffer(2, length, this._context.sampleRate);
      for (let channelIndex = 0; channelIndex < 2; channelIndex += 1) {
        const channel = buffer.getChannelData(channelIndex);
        for (let index = 0; index < length; index += 1) {
          const envelope = (1 - index / length) ** decay;
          channel[index] = (this._random() * 2 - 1) * envelope;
        }
      }
      return buffer;
    }

    _ensureContext() {
      if (this._context || this.config.preset === 'none') return;
      if (!AudioContextClass) throw new Error('Web Audio API is not supported');
      this._context = new AudioContextClass();
    }

    _resumeContextFromGesture() {
      configurePlaybackAudioSession();
      this._ensureContext();
      const context = this._context;
      if (!context || context.state === 'running') return Promise.resolve();

      // Older iOS Safari may require a source to start inside the same user
      // gesture that resumes AudioContext. A one-frame silent buffer unlocks
      // the context without producing audible output.
      try {
        const source = context.createBufferSource();
        source.buffer = context.createBuffer(1, 1, context.sampleRate);
        source.connect(context.destination);
        source.onended = () => { try { source.disconnect(); } catch {} };
        source.start(0);
      } catch {}

      let timeoutId;
      const timeout = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error('AudioContext resume timed out')), AUDIO_RESUME_TIMEOUT_MS);
      });
      return Promise.race([Promise.resolve(context.resume()), timeout])
        .then(() => {
          if (context.state && context.state !== 'running') {
            throw new Error(`AudioContext could not start (${context.state})`);
          }
        })
        .finally(() => clearTimeout(timeoutId));
    }

    _buildGraph() {
      if (this._master || this.config.preset === 'none') return;
      this._ensureContext();

      const recipe = RECIPES[this.config.preset];
      const context = this._context;
      const master = context.createGain();
      const lowCut = context.createBiquadFilter();
      const clarity = context.createBiquadFilter();
      const compressor = context.createDynamicsCompressor();
      const environmentGain = context.createGain();
      const outputGain = context.createGain();
      master.gain.value = 0.0001;
      lowCut.type = 'highpass';
      lowCut.frequency.value = recipe.highpass;
      lowCut.Q.value = 0.65;
      clarity.type = 'highshelf';
      clarity.frequency.value = 1800;
      clarity.gain.value = 3.2;
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.02;
      compressor.release.value = 0.3;
      environmentGain.gain.value = 1;
      outputGain.gain.value = 1.8;
      master.connect(lowCut);
      lowCut.connect(clarity);
      clarity.connect(compressor);
      compressor.connect(environmentGain);
      environmentGain.connect(outputGain);
      outputGain.connect(context.destination);

      this._master = master;
      this._nodes.push(master, lowCut, clarity, compressor, environmentGain, outputGain);

      const warmth = this.config.warmth / 100;
      const motion = this.config.motion / 100;
      const space = this.config.space / 100;
      const detuneBase = (this._random() - 0.5) * 7;
      const padPanners = [];

      const padOffsets = recipe.chords?.[0]
        || recipe.ratios.map(ratio => 12 * Math.log2(ratio));
      padOffsets.forEach((semitone, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const panner = createPanNode(context);
        const lfo = context.createOscillator();
        const lfoDepth = context.createGain();

        oscillator.type = recipe.wave;
        oscillator.frequency.value = recipe.root * (2 ** (semitone / 12));
        oscillator.detune.value = detuneBase + (index - 1) * 2.5;
        gain.gain.value = recipe.padGain / (1 + index * 0.45);
        const basePan = padOffsets.length === 1
          ? 0
          : ((index / (padOffsets.length - 1)) - 0.5) * 0.72;
        setPan(panner, basePan);
        padPanners.push({ node: panner, basePan });
        lfo.type = 'sine';
        lfo.frequency.value = 0.025 + motion * 0.075 + index * 0.011;
        lfoDepth.gain.value = 0.018 + motion * 0.025;

        oscillator.connect(gain);
        gain.connect(panner);
        panner.connect(master);
        lfo.connect(lfoDepth);
        lfoDepth.connect(gain.gain);
        oscillator.start();
        lfo.start();
        this._padOscillators.push(oscillator);
        this._nodes.push(oscillator, gain, panner, lfo, lfoDepth);
      });

      const melodyDelay = context.createDelay(1);
      const delayFilter = context.createBiquadFilter();
      const delayWetGain = context.createGain();
      const delayFeedback = context.createGain();
      melodyDelay.delayTime.value = ((recipe.delayTime ?? 0.24) + motion * 0.08) * (0.72 + space * 0.56);
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 2800 + warmth * 2500;
      delayWetGain.gain.value = (recipe.delayWet ?? 0.12) * (0.55 + space * 0.9);
      delayFeedback.gain.value = Math.min(
        0.34,
        (recipe.delayFeedback ?? (0.08 + motion * 0.05)) + space * 0.06,
      );
      melodyDelay.connect(delayFilter);
      delayFilter.connect(delayWetGain);
      delayWetGain.connect(master);
      delayFilter.connect(delayFeedback);
      delayFeedback.connect(melodyDelay);
      this._melodyDelay = melodyDelay;
      this._nodes.push(melodyDelay, delayFilter, delayWetGain, delayFeedback);

      const melodyReverb = context.createConvolver();
      const reverbFilter = context.createBiquadFilter();
      const reverbGain = context.createGain();
      melodyReverb.buffer = this._createImpulseBuffer(
        (recipe.reverbSeconds ?? 2.8) * (0.58 + space * 0.84),
        recipe.reverbDecay ?? 2.6,
      );
      reverbFilter.type = 'highpass';
      reverbFilter.frequency.value = 260;
      reverbGain.gain.value = (recipe.reverbGain ?? (0.13 + motion * 0.05)) * (0.42 + space * 1.16);
      melodyReverb.connect(reverbFilter);
      reverbFilter.connect(reverbGain);
      reverbGain.connect(master);
      this._melodyReverb = melodyReverb;
      this._nodes.push(melodyReverb, reverbFilter, reverbGain);

      this._acousticNodes = {
        clarity,
        delayWetGain,
        reverbGain,
        environmentGain,
        padPanners,
        baseDelayWet: delayWetGain.gain.value,
        baseReverbWet: reverbGain.gain.value,
      };
      this.setEnvironment(this._acousticEnvironment, { transitionSeconds: 0 });

      if (recipe.noise > 0) {
        const noise = context.createBufferSource();
        const noiseFilter = context.createBiquadFilter();
        const noiseGain = context.createGain();
        const noisePanner = createPanNode(context);
        noise.buffer = this._createNoiseBuffer(5);
        noise.loop = true;
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = recipe.filter * (0.65 + warmth * 0.75);
        noiseFilter.Q.value = 0.7;
        noiseGain.gain.value = recipe.noise;
        setPan(noisePanner, (this._random() - 0.5) * 0.4);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(noisePanner);
        noisePanner.connect(master);
        noise.start();
        this._nodes.push(noise, noiseFilter, noiseGain, noisePanner);
      }
    }

    _scheduleChime() {
      clearTimeout(this._chimeTimer);
      if (this.paused || !this._context) return;
      const recipe = RECIPES[this.config.preset];
      const motion = this.config.motion / 100;
      const beatMs = 60000 / this.config.tempo;
      const baseDelay = beatMs * (
        (recipe.noteSpacing ?? 2.25) - motion * (recipe.motionSpacing ?? 0.75)
      );
      const humanize = this._phraseState?.timingHumanize ?? 0.035;
      const delay = baseDelay * (1 + (this._random() * 2 - 1) * humanize);
      this._chimeTimer = setTimeout(() => {
        if (!this.paused && this._context?.state === 'running') this._playChime();
        this._scheduleChime();
      }, delay);
    }

    _playChime() {
      const recipe = RECIPES[this.config.preset];
      const step = this._melodyStep;
      // A phrase is one chord-sized musical thought, not the entire four-chord
      // progression. Variations therefore become audible after 6-8 notes.
      const phraseSteps = recipe.phraseSteps ?? recipe.chordEvery;
      if (!this._phraseState || step % phraseSteps === 0) {
        this._preparePhrase(recipe, phraseSteps);
      }
      const phraseStep = step % phraseSteps;
      let semitone;
      let activeChord = null;
      let chordNoteIndex = 0;
      if (recipe.chords) {
        const chordIndex = Math.floor(step / recipe.chordEvery) % recipe.chords.length;
        activeChord = this._voiceChord(recipe.chords[chordIndex]);
        const patternIndex = this._variationPatternIndex(
          phraseStep,
          recipe.chordPattern.length,
          this._phraseState.variation,
        );
        chordNoteIndex = recipe.chordPattern[patternIndex] % activeChord.length;
        semitone = activeChord[chordNoteIndex];
        if (step % recipe.chordEvery === 0) this._setPadChord(chordIndex);
      } else {
        semitone = recipe.melody[step % recipe.melody.length];
      }
      this._melodyStep += 1;
      if (this._phraseState.restSteps.has(phraseStep)) return;

      const octaveLift = phraseStep % this._phraseState.octaveLiftEvery
        === this._phraseState.octaveLiftOffset ? 1 : 0;
      const octave = recipe.octave + this._phraseState.octaveShift + octaveLift;
      const frequency = recipe.root * (2 ** ((octave * 12 + semitone) / 12));
      const warmth = this.config.warmth / 100;
      const intensity = this.config.intensity / 100;
      const duration = recipe.noteLength * (0.85 + warmth * 0.35);
      const pan = Math.sin(this._melodyStep * 1.7)
        * (recipe.panWidth ?? 0.48)
        * this._stereoWidthScale;
      const noteVelocity = this._phraseState.velocity * (0.94 + this._random() * 0.12);
      this._playInstrumentNote({
        frequency,
        instrument: this._phraseState.instrument,
        gain: recipe.noteGain * (0.75 + intensity * 0.45) * noteVelocity,
        duration,
        pan,
        attack: this._phraseState.instrument === recipe.instrument ? recipe.noteAttack : undefined,
      });

      if (
        activeChord
        && recipe.counterInstrument
        && step % recipe.counterEvery === recipe.counterOffset
        && this._random() < this._phraseState.counterChance
      ) {
        const counterIndex = (chordNoteIndex + recipe.counterStep) % activeChord.length;
        const counterSemitone = activeChord[counterIndex];
        const counterFrequency = recipe.root * (
          2 ** (((recipe.counterOctave ?? recipe.octave) * 12 + counterSemitone) / 12)
        );
        this._playInstrumentNote({
          frequency: counterFrequency,
          instrument: recipe.counterInstrument,
          gain: recipe.counterGain * (0.8 + intensity * 0.35),
          duration: recipe.counterLength,
          pan: -pan * 0.85,
          startDelay: recipe.counterDelay,
        });
      }

      if (
        activeChord
        && recipe.accentInstrument
        && step % recipe.accentEvery === recipe.accentOffset
        && this._random() < this._phraseState.accentChance
      ) {
        const accentIndex = (chordNoteIndex + recipe.accentStep) % activeChord.length;
        const accentSemitone = activeChord[accentIndex];
        const accentFrequency = recipe.root * (
          2 ** (((recipe.accentOctave ?? recipe.octave) * 12 + accentSemitone) / 12)
        );
        this._playInstrumentNote({
          frequency: accentFrequency,
          instrument: recipe.accentInstrument,
          gain: recipe.accentGain * (0.78 + intensity * 0.32),
          duration: recipe.accentLength,
          pan: pan === 0 ? 0.28 : -Math.sign(pan) * Math.min(0.82, Math.abs(pan) + 0.2),
          startDelay: recipe.accentDelay,
        });
      }
    }

    _preparePhrase(recipe, phraseSteps) {
      const motion = this.config.motion / 100;
      const variationAmount = this.config.variation / 100;
      let variation = this._phraseNumber === 0 || this._random() > variationAmount
        ? 0
        : 1 + Math.floor(this._random() * 3);
      if (variation !== 0 && variation === this._lastVariation) {
        variation = 1 + (variation + Math.floor(this._random() * 2)) % 3;
      }

      let inversion = this._phraseNumber === 0 || this._random() > variationAmount
        ? 0
        : Math.floor(this._random() * 3);
      if (inversion !== 0 && inversion === this._lastInversion) {
        inversion = 1 + (inversion % 2);
      }
      const octaveShift = this._phraseNumber > 0 && this._random() < variationAmount * 0.28 ? -1 : 0;
      const hasOctaveLift = this._random() < variationAmount;
      const octaveLiftEvery = hasOctaveLift
        ? 3 + Math.floor(this._random() * 3)
        : phraseSteps + 1;
      const octaveLiftOffset = hasOctaveLift
        ? 1 + Math.floor(this._random() * (octaveLiftEvery - 1))
        : phraseSteps;
      const restSteps = new Set();
      const restCount = this._phraseNumber === 0 || this._random() > variationAmount
        ? 0
        : 1 + (this._random() > motion ? 1 : 0);
      let attempts = 0;
      while (restSteps.size < restCount && attempts < phraseSteps * 3) {
        attempts += 1;
        const candidate = 1 + Math.floor(this._random() * (phraseSteps - 1));
        if (candidate % recipe.chordEvery !== 0) restSteps.add(candidate);
      }
      let phraseInstrument = this.config.instrument;
      if (phraseInstrument === 'auto') {
        phraseInstrument = recipe.instrument;
        if (recipe.instrumentVariants && this._random() < variationAmount) {
          phraseInstrument = recipe.instrumentVariants[
            Math.floor(this._random() * recipe.instrumentVariants.length)
          ];
        }
      }

      this._phraseState = {
        variation,
        inversion,
        octaveShift,
        octaveLiftEvery,
        octaveLiftOffset,
        restSteps,
        instrument: phraseInstrument,
        velocity: 0.92 + this._random() * 0.16,
        counterChance: 0.42 + motion * 0.24 + variationAmount * 0.18,
        accentChance: 0.36 + motion * 0.27 + variationAmount * 0.2,
        timingHumanize: 0.015 + variationAmount * 0.045,
      };
      this._lastVariation = variation;
      this._lastInversion = inversion;
      this._phraseNumber += 1;
    }

    _variationPatternIndex(step, length, variation) {
      const local = step % length;
      if (variation === 1) return (local + 2) % length;
      if (variation === 2) return length - 1 - local;
      if (variation === 3) return (local * 5) % length;
      return local;
    }

    _voiceChord(chord) {
      const inversion = this._phraseState?.inversion || 0;
      return chord.map((semitone, index) => index < inversion ? semitone + 12 : semitone)
        .sort((left, right) => left - right);
    }

    _playInstrumentNote(options) {
      const context = this._context;
      const profile = INSTRUMENTS[options.instrument] || INSTRUMENTS.glass;
      const oscillator = context.createOscillator();
      const harmonic = context.createOscillator();
      const gain = context.createGain();
      const harmonicGain = context.createGain();
      const filter = context.createBiquadFilter();
      const panner = createPanNode(context);
      const now = context.currentTime + (options.startDelay || 0);
      const attack = options.attack ?? profile.attack;
      const stopAt = now + options.duration;
      const warmth = this.config.warmth / 100;

      oscillator.type = profile.wave;
      oscillator.frequency.value = options.frequency;
      harmonic.type = 'sine';
      harmonic.frequency.value = options.frequency * profile.harmonicRatio;
      harmonic.detune.value = (this._random() - 0.5) * 4;
      harmonicGain.gain.value = profile.harmonicMix;
      filter.type = 'lowpass';
      filter.frequency.value = profile.cutoff * (0.78 + warmth * 0.32);
      filter.Q.value = 0.4;
      setPan(panner, options.pan || 0);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(options.gain, now + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      oscillator.connect(filter);
      harmonic.connect(harmonicGain);
      harmonicGain.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this._master);
      if (this._melodyDelay) panner.connect(this._melodyDelay);
      if (this._melodyReverb) panner.connect(this._melodyReverb);

      let vibrato = null;
      let vibratoDepth = null;
      if (profile.vibrato) {
        vibrato = context.createOscillator();
        vibratoDepth = context.createGain();
        vibrato.frequency.value = profile.vibrato;
        vibratoDepth.gain.value = profile.vibratoDepth;
        vibrato.connect(vibratoDepth);
        vibratoDepth.connect(oscillator.detune);
        vibrato.start(now);
        vibrato.stop(stopAt + 0.05);
      }

      oscillator.start(now);
      harmonic.start(now);
      oscillator.stop(stopAt + 0.05);
      harmonic.stop(stopAt + 0.05);
    }

    _setPadChord(chordIndex) {
      const recipe = RECIPES[this.config.preset];
      const rawChord = recipe.chords?.[chordIndex];
      const chord = rawChord ? this._voiceChord(rawChord) : null;
      if (!chord || !this._context) return;
      const now = this._context.currentTime;
      this._padOscillators.forEach((oscillator, index) => {
        const semitone = chord[index % chord.length];
        const target = recipe.root * (2 ** (semitone / 12));
        oscillator.frequency.cancelScheduledValues(now);
        oscillator.frequency.setTargetAtTime(target, now, 0.08);
      });
    }

    async play() {
      if (this.config.preset === 'none') return;
      if (this._destroyed) throw new Error('Soundscape has been destroyed');
      try {
        clearTimeout(this._pauseTimer);
        // resume() is invoked before the first await so mobile browsers still
        // recognize the originating tap as an active user gesture.
        await this._resumeContextFromGesture();
        if (this._destroyed) return;
        this._buildGraph();
        this.paused = false;
        this._applyMasterGain();
        this._scheduleChime();
        if (typeof this.onplay === 'function') this.onplay();
      } catch (error) {
        this.paused = true;
        if (!this._master && this._context) {
          const failedContext = this._context;
          this._context = null;
          if (failedContext.state !== 'closed') {
            try { Promise.resolve(failedContext.close()).catch(() => {}); } catch {}
          }
        }
        if (typeof this.onerror === 'function') this.onerror(error);
        throw error;
      }
    }

    pause() {
      if (!this._context || this.paused) return;
      this.paused = true;
      clearTimeout(this._chimeTimer);
      this._applyMasterGain();
      clearTimeout(this._pauseTimer);
      this._pauseTimer = setTimeout(() => {
        if (this.paused && this._context?.state === 'running') this._context.suspend().catch(() => {});
      }, 450);
      if (typeof this.onpause === 'function') this.onpause();
    }

    destroy() {
      clearTimeout(this._chimeTimer);
      clearTimeout(this._pauseTimer);
      this.paused = true;
      this._destroyed = true;
      this._nodes.forEach((node) => {
        try { if (typeof node.stop === 'function') node.stop(); } catch {}
        try { if (typeof node.disconnect === 'function') node.disconnect(); } catch {}
      });
      this._nodes = [];
      if (this._context && this._context.state !== 'closed') this._context.close().catch(() => {});
      this._context = null;
      this._master = null;
      this._melodyDelay = null;
      this._melodyReverb = null;
      this._padOscillators = [];
      this._acousticNodes = null;
      this._stereoWidthScale = 1;
      this._phraseState = null;
    }
  }

  function createManager(options) {
    const settings = options || {};
    const manager = {
      audio: null,
      isPlaying: false,
      _initialized: false,
      _button: null,

      init(config) {
        if (this._initialized) return;
        this._initialized = true;
        this._button = settings.buttonId ? document.getElementById(settings.buttonId) : null;
        const normalized = normalizedConfig(config);
        if (normalized.preset === 'none') {
          if (this._button) {
            if (settings.hiddenClass) this._button.classList.add(settings.hiddenClass);
            else this._button.hidden = true;
          }
          return;
        }
        this.audio = new LumoraSoundscapeAudio(normalized);
        this.audio.onplay = () => {
          this.isPlaying = true;
          this.updateUI();
          root.LumoraActivity?.log?.({
            action: 'Soundscape Playback Started', feature: 'galaxy', status: 1,
            description: { preset: normalized.preset },
          });
        };
        this.audio.onpause = () => {
          this.isPlaying = false;
          this.updateUI();
          root.LumoraActivity?.log?.({
            action: 'Soundscape Muted', feature: 'galaxy', status: 1,
            description: { preset: normalized.preset },
          });
        };
        this.audio.onerror = (error) => {
          root.LumoraActivity?.logResult?.('Soundscape Init Failed', false, {
            errorType: 'soundscape_init_fail', preset: normalized.preset,
          }, error);
        };
        if (this._button) {
          this._button.hidden = false;
          if (settings.hiddenClass) this._button.classList.remove(settings.hiddenClass);
          this._button.addEventListener('click', () => this.toggle());
        }
        this.updateUI();
      },

      play() {
        if (!this.audio) return Promise.reject(new Error('Soundscape not initialized'));
        return this.audio.play();
      },

      pause() { this.audio?.pause(); },

      setEnvironment(name, options) {
        return this.audio?.setEnvironment(name, options) ?? false;
      },

      toggle() {
        if (!this.audio) return;
        if (this.audio.paused) this.play().catch(() => {});
        else this.pause();
      },

      togglePlayback() { this.toggle(); },

      updateUI() {
        if (typeof settings.updateButton === 'function') {
          settings.updateButton(this._button, this.isPlaying);
        } else if (this._button) {
          this._button.textContent = this.isPlaying ? '🔊' : '🔇';
        }
      },

      destroy() {
        this.audio?.destroy();
        this.audio = null;
        this.isPlaying = false;
      },
    };
    root.addEventListener('pagehide', (event) => {
      if (event.persisted) manager.pause();
      else manager.destroy();
    });
    root.document?.addEventListener('visibilitychange', () => {
      if (root.document.hidden) manager.pause();
    });
    return manager;
  }

  root.LumoraSoundscape = Object.freeze({
    create: (config) => new LumoraSoundscapeAudio(config),
    createManager,
    normalize: normalizedConfig,
  });
})(window);
