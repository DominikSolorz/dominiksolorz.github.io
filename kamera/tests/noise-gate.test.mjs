import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

// Execute the actual worklet processor in a small in-memory AudioWorklet host.
// No microphone access, browser session, or third-party audio data required.
const source = await readFile(new URL('../noise-gate.worklet.js', import.meta.url), 'utf8');
let NoiseGate;
runInNewContext(source, {
  AudioWorkletProcessor: class {
    constructor() { this.port = { onmessage: null }; }
  },
  registerProcessor: (name, Type) => {
    assert.equal(name, 'home-security-noise-gate');
    NoiseGate = Type;
  },
  sampleRate: 48000,
}, { timeout: 1000 });

function createGate(profile = 'clean') {
  const gate = new NoiseGate();
  gate.port.onmessage({ data: { profile } });
  return gate;
}

function render(gate, level, blocks = 1) {
  let result;
  for (let j = 0; j < blocks; j++) {
    const input = new Float32Array(128).fill(level);
    const output = new Float32Array(128);
    assert.equal(gate.process([[input]], [[output]]), true);
    result = output;
  }
  return result;
}

test('a stable hiss above the former fixed gate threshold is softly attenuated', () => {
  const gate = createGate('clean');
  const out = render(gate, 0.015, 260);
  const average = out.reduce((sum, x) => sum + Math.abs(x), 0) / out.length;
  assert.ok(average < 0.006, `remaining noise ${average}`);
  assert.ok(average > 0.001, 'quiet safety signals should not be hard-muted');
});

test('normal speech clearly opens the gate even after noise calibration', () => {
  const gate = createGate('clean');
  render(gate, 0.015, 260);
  const out = render(gate, 0.085, 30);
  assert.ok(out[64] > 0.07, `speech gain ${out[64]}`);
});

test('the gate closes gradually after speech so word tails are preserved', () => {
  const gate = createGate('clean');
  render(gate, 0.013, 200);
  render(gate, 0.075, 70);
  const early = render(gate, 0.013, 20);
  const later = render(gate, 0.013, 360);
  assert.ok(early[60] > later[60], `early ${early[60]} later ${later[60]}`);
  assert.ok(later[60] > 0, 'the track must not go silent');
});

test('loud sudden events are still audible and never clipped', () => {
  const gate = createGate('clean');
  render(gate, 0.011, 240);
  const event = render(gate, 0.75, 2);
  assert.ok(event[120] > 0.3, `event amplitude ${event[120]}`);
  assert.ok(event.every(value => Number.isFinite(value) && value <= 1 && value >= -1));
});

test('environment mode preserves original sample values without gating', () => {
  const gate = createGate('environment');
  const out = render(gate, 0.004, 400);
  assert.ok(Math.abs(out[64] - 0.004) < 1e-6);
});

test('missing microphone input produces silence without crashing', () => {
  const gate = createGate('clean');
  const channel = new Float32Array(128).fill(2);
  assert.equal(gate.process([], [[channel]]), true);
  assert.ok(channel.every(value => value === 0));
});
