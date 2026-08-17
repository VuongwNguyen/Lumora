const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function audioParam(value = 0, ramps = []) {
  return {
    value,
    cancelScheduledValues() {},
    cancelAndHoldAtTime() {},
    exponentialRampToValueAtTime(next) { this.value = next; },
    linearRampToValueAtTime(next, endTime) {
      ramps.push({ next, endTime });
      this.value = next;
    },
    setTargetAtTime(next) { this.value = next; },
    setValueAtTime(next) { this.value = next; },
  };
}

function audioNode() {
  return {
    gain: audioParam(1),
    frequency: audioParam(),
    detune: audioParam(),
    delayTime: audioParam(),
    Q: audioParam(),
    threshold: audioParam(),
    knee: audioParam(),
    ratio: audioParam(),
    attack: audioParam(),
    release: audioParam(),
    connect() {},
    disconnect() {},
    start() {},
    stop() {},
  };
}

function loadEngine() {
  const calls = [];
  const ramps = [];
  class FakeAudioContext {
    constructor() {
      this.state = 'suspended';
      this.sampleRate = 8000;
      this.currentTime = 0;
      this.destination = audioNode();
    }

    createGain() { calls.push('createGain'); const node = audioNode(); node.gain = audioParam(1, ramps); return node; }
    createBiquadFilter() { const node = audioNode(); node.gain = audioParam(0, ramps); return node; }
    createDynamicsCompressor() { calls.push('createDynamicsCompressor'); return audioNode(); }
    createOscillator() { return audioNode(); }
    createDelay() { return audioNode(); }
    createConvolver() { return audioNode(); }
    createBufferSource() { calls.push('createBufferSource'); return audioNode(); }
    createBuffer(channels, length) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { getChannelData: index => data[index] };
    }
    resume() { calls.push('resume'); this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }

  const root = {
    AudioContext: FakeAudioContext,
    addEventListener() {},
    document: { addEventListener() {}, hidden: false },
    navigator: { audioSession: { type: 'ambient' } },
  };
  const source = fs.readFileSync(path.join(__dirname, '../public/shared/js/soundscapeEngine.js'), 'utf8');
  vm.runInNewContext(source, {
    window: root,
    clearTimeout,
    console,
    setTimeout,
  });
  return { calls, ramps, engine: root.LumoraSoundscape, root };
}

test('mobile playback resumes AudioContext before building the graph and tolerates missing StereoPanner', async () => {
  const { calls, engine, root } = loadEngine();
  const soundscape = engine.create({
    preset: 'cosmic_drift',
    intensity: 50,
    warmth: 50,
    motion: 40,
    seed: 'mobile-regression',
  });

  await soundscape.play();
  try {
    assert.equal(soundscape.paused, false);
    assert.equal(root.navigator.audioSession.type, 'playback');
    assert.ok(calls.indexOf('resume') >= 0);
    assert.ok(calls.indexOf('resume') < calls.indexOf('createDynamicsCompressor'));
  } finally {
    soundscape.destroy();
  }
});

test('semantic acoustic environments transition smoothly without rebuilding the graph', async () => {
  const { calls, ramps, engine } = loadEngine();
  const soundscape = engine.create({
    preset: 'memory_glow',
    intensity: 55,
    warmth: 60,
    motion: 35,
    space: 50,
    seed: 'dynamic-space-regression',
  });

  await soundscape.play();
  try {
    const graphGainCount = calls.filter(call => call === 'createGain').length;
    const baseReverbWet = soundscape._acousticNodes.baseReverbWet;
    assert.equal(soundscape.setEnvironment('memory_focus', { transitionSeconds: 1.4 }), true);
    assert.equal(soundscape._acousticEnvironment, 'memory_focus');
    assert.equal(soundscape._acousticNodes.clarity.gain.value, 5.4);
    assert.equal(soundscape._acousticNodes.reverbGain.gain.value, baseReverbWet * 0.56);
    assert.equal(soundscape._acousticNodes.environmentGain.gain.value, 1.08);
    assert.ok(ramps.some(ramp => ramp.endTime === 1.4));
    assert.equal(calls.filter(call => call === 'createGain').length, graphGainCount);

    assert.equal(soundscape.setEnvironment('open_space', { transitionSeconds: 3.2 }), true);
    assert.equal(soundscape._acousticNodes.reverbGain.gain.value, baseReverbWet * 1.28);
    assert.ok(ramps.some(ramp => ramp.endTime === 3.2));

    assert.equal(soundscape.setEnvironment('custom_nodes', { transitionSeconds: 1 }), false);
    assert.equal(soundscape._acousticEnvironment, 'open_space');
  } finally {
    soundscape.destroy();
  }
});

test('semantic volume fades reuse the existing master graph and can be cancelled', async () => {
  const { calls, ramps, engine } = loadEngine();
  const soundscape = engine.create({
    preset: 'deep_focus',
    intensity: 50,
    seed: 'volume-transition-regression',
  });

  await soundscape.play();
  try {
    const graphGainCount = calls.filter(call => call === 'createGain').length;
    assert.equal(soundscape.fadeTo(0.35, 1200), 0.35);
    assert.equal(soundscape.volume, 0.35);
    assert.ok(ramps.some(ramp => ramp.endTime === 1.2));
    assert.equal(calls.filter(call => call === 'createGain').length, graphGainCount);
    assert.equal(soundscape.cancelVolumeTransition(), true);
  } finally {
    soundscape.destroy();
  }
});
