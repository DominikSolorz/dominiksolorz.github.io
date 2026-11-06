import test from 'node:test';
import assert from 'node:assert/strict';
import { rmsDbfs, createAudioLevelHistory } from '../audio-meter.mjs';

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
