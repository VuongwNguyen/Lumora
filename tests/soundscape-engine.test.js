const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function audioParam(value = 0) {
  return {
    value,
    cancelScheduledValues() {},
    exponentialRampToValueAtTime(next) { this.value = next; },
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
  class FakeAudioContext {
    constructor() {
      this.state = 'suspended';
      this.sampleRate = 8000;
      this.currentTime = 0;
      this.destination = audioNode();
    }

    createGain() { calls.push('createGain'); return audioNode(); }
    createBiquadFilter() { return audioNode(); }
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
  return { calls, engine: root.LumoraSoundscape, root };
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
