import test from 'node:test';
import assert from 'node:assert/strict';
import { rmsDbfs, createAudioLevelHistory, spectralToneHints } from '../audio-meter.mjs';

test('converts full-scale and quiet input samples into RMS dBFS', () => {
  assert.equal(rmsDbfs(Float32Array.from([0.1, -0.1, 0.1, -0.1])), -20);
  assert.equal(rmsDbfs(Float32Array.from([0.01, -0.01])), -40);
  assert.equal(rmsDbfs(new Float32Array(128)), -120);
  assert.equal(rmsDbfs(Float32Array.from([1, -1])), 0);
});

test('rejects unavailable and malformed samples instead of inventing levels', () => {
  assert.equal(rmsDbfs(null), null);
  assert.equal(rmsDbfs([]), null);
  assert.equal(rmsDbfs([NaN]), null);
  assert.equal(rmsDbfs([Infinity]), null);
});

test('tracks input and processed levels without retaining raw audio buffers', () => {
  const tracker = createAudioLevelHistory();
  const before = new Float32Array(2048).fill(0.02);
  const after = new Float32Array(2048).fill(0.005);
  const reading = tracker.observe(before, after, 1000);
  assert.deepEqual(reading, {
    beforeDb: -34, afterDb: -46, quietBeforeDb: -34,
    quietAfterDb: -46, sampleCount: 1,
  });
  before.fill(1);
  after.fill(1);
  assert.equal(tracker.snapshot().beforeDb, -34, 'must not keep raw sample buffers');
  assert.equal(tracker.snapshot().afterDb, -46);
});

test('estimates quiet-window levels from recent samples, not instantaneous speech', () => {
  const tracker = createAudioLevelHistory(5000);
  const sample = amplitude => new Float32Array(128).fill(amplitude);
  tracker.observe(sample(0.01), sample(0.001), 1000);
  tracker.observe(sample(0.012), sample(0.003), 2000);
  tracker.observe(sample(0.5), sample(0.4), 3000);
  const current = tracker.observe(sample(0.08), sample(0.06), 4000);
  assert.equal(current.beforeDb, -21.9);
  assert.equal(current.quietBeforeDb, -40);
  assert.equal(current.quietAfterDb, -60);
  assert.equal(current.sampleCount, 4);
  const later = tracker.observe(sample(0.02), sample(0.01), 10001);
  assert.equal(later.sampleCount, 1, 'expired samples must not affect the baseline');
});

test('does not report measurements until first real sample and supports cleanup', () => {
  const tracker = createAudioLevelHistory();
  assert.equal(tracker.snapshot(), null);
  assert.equal(tracker.observe([], [], 1), null);
  tracker.observe([0.02], [0.01], 2);
  tracker.clear();
  assert.equal(tracker.snapshot(), null);
});

test('detects narrow 100 Hz, 200 Hz and 3800 Hz tones above their nearby spectrum', () => {
  const sampleRate = 48000;
  const fftSize = 8192;
  const spectrum = new Float32Array(fftSize / 2).fill(-96);
  for (const [hz, db] of [[100, -58], [200, -61], [3800, -55]]) {
    spectrum[Math.round(hz * fftSize / sampleRate)] = db;
  }
  const hints = spectralToneHints(spectrum, sampleRate, fftSize);
  assert.deepEqual(hints.map(hint => hint.hz), [100, 200, 3800]);
  assert.ok(hints.every(hint => hint.excessDb >= 12));
});

test('does not misclassify broad noise, silence or invalid sample rates as narrow tones', () => {
  const fftSize = 8192;
  assert.deepEqual(spectralToneHints(new Float32Array(fftSize / 2).fill(-60), 48000, fftSize), []);
  assert.deepEqual(spectralToneHints(new Float32Array(fftSize / 2).fill(-Infinity), 48000, fftSize), []);
  assert.deepEqual(spectralToneHints(new Float32Array(fftSize / 2).fill(-60), 0, fftSize), []);
  assert.deepEqual(spectralToneHints(null, 48000, fftSize), []);
  const tooQuiet = new Float32Array(fftSize / 2).fill(-140);
  tooQuiet[Math.round(100 * fftSize / 48000)] = -110;
  assert.deepEqual(spectralToneHints(tooQuiet, 48000, fftSize), []);
});

test('only reports recurring tones after at least three observations and clears old hints', () => {
  const history = createAudioLevelHistory();
  const sound = Float32Array.from([0.01, -0.01, 0.01]);
  const peak = [{ hz: 100, excessDb: 19.5 }];
  history.observe(sound, sound, 1000, { inputTones: peak, outputTones: [] });
  history.observe(sound, sound, 2000, { inputTones: peak, outputTones: [] });
  assert.deepEqual(history.snapshot().inputTones, []);
  history.observe(sound, sound, 3000, { inputTones: peak, outputTones: [] });
  assert.deepEqual(history.snapshot().inputTones, peak);
  assert.deepEqual(history.snapshot().outputTones, []);
  const copy = history.snapshot();
  copy.inputTones[0].hz = 9876;
  copy.inputTones.push({hz:999,excessDb:99});
  assert.deepEqual(history.snapshot().inputTones, peak, 'snapshot is defensively copied');

  for (let k = 0; k < 5; k++) {
    history.observe(sound, sound, 4000 + 1000*k, {inputTones:[],outputTones:[]});
  }
  assert.deepEqual(history.snapshot().inputTones, [], 'a vanished tone must be removed');
});

test('brief acoustic events do not trigger persistent electronic tone hints', () => {
  const history = createAudioLevelHistory();
  const audio = Float32Array.from([0.01]);
  const event = [{ hz: 3800, excessDb: 23 }];
  history.observe(audio, audio, 100, {inputTones: [], outputTones: []});
  history.observe(audio, audio, 200, {inputTones: event, outputTones: []});
  history.observe(audio, audio, 300, {inputTones: [], outputTones: []});
  history.observe(audio, audio, 400, {inputTones: [], outputTones: []});
  assert.deepEqual(history.snapshot().inputTones, []);
});
