import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanAudioStream } from '../audio-cleaner.mjs';

class MockNode {
  constructor(name) {
    this.name = name;
    this.targets = [];
    this.gain = { value: 0, setTargetAtTime() {} };
    this.frequency = { setTargetAtTime() {} };
    this.port = { postMessage() {}, close() {} };
  }
  connect(target) { this.targets.push(target); return target; }
}

class MockStream {
  constructor(tracks) { this.tracks = tracks; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
}

class MockContext {
  static latest;
  constructor() {
    MockContext.latest = this;
    this.currentTime = 0;
    this.state = 'running';
    this.closed = false;
    this.analyserCount = 0;
    this.audioWorklet = { addModule: async () => {} };
  }
  createMediaStreamSource() { return new MockNode('source'); }
  createBiquadFilter() { return new MockNode('filter'); }
  createGain() { return new MockNode('gain'); }
  createMediaStreamDestination() {
    const node = new MockNode('destination');
    node.stream = new MockStream([{ kind: 'audio', readyState: 'live', stop() { this.stopped = true; } }]);
    return node;
  }
  createAnalyser() {
    const number = ++this.analyserCount;
    const analyser = new MockNode(number === 1 ? 'input-meter' : 'output-meter');
    analyser.fftSize = 2048;
    analyser.getFloatTimeDomainData = buffer => buffer.fill(number === 1 ? 0.1 : 0.025);
    return analyser;
  }
  close() { this.closed = true; return Promise.resolve(); }
}

class MockWorklet extends MockNode {
  constructor() { super('worklet'); }
}

function makeCapture() {
  const microphone = {
    kind: 'audio', readyState: 'live', stopped: false,
    stop() { this.stopped = true; },
    addEventListener() {}, removeEventListener() {},
  };
  const video = { kind: 'video', readyState: 'live', stop() {} };
  return { microphone, video, captured: new MockStream([video, microphone]) };
}

test('diagnostics use transparent analysers and preserve the output track', async () => {
  let polling = null;
  let intervalCleared = null;
  const environment = {
    AudioContext: MockContext,
    AudioWorkletNode: MockWorklet,
    MediaStream: MockStream,
    setInterval(fn, ms) { assert.equal(ms, 1000); polling = fn; return 7; },
    clearInterval(id) { intervalCleared = id; },
  };
  const { captured, microphone, video } = makeCapture();
  const pipeline = await createCleanAudioStream(captured, 'clean', environment);
  assert.equal(pipeline.filtered, true);
  assert.equal(pipeline.sourceTrack, microphone);
  assert.equal(pipeline.stream.getVideoTracks()[0], video);
  assert.equal(pipeline.stream.getAudioTracks().length, 1);
  assert.equal(pipeline.getLevels(), null, 'no made-up readings before the first sample');
  assert.equal(typeof polling, 'function');
  polling();
  const reading = pipeline.getLevels();
  assert.equal(reading.beforeDb, -20);
  assert.equal(reading.afterDb, -32);
  assert.equal(reading.sampleCount, 1);
  pipeline.close();
  assert.equal(intervalCleared, 7);
  assert.equal(pipeline.getLevels(), null);
  assert.equal(microphone.stopped, true);
  assert.equal(MockContext.latest.closed, true);
});

test('audio remains available if this embedded browser does not support analysers', async () => {
  class ContextWithoutMeters extends MockContext {
    createAnalyser() { throw new Error('Unsupported'); }
  }
  const { captured } = makeCapture();
  let intervalCount = 0;
  const pipeline = await createCleanAudioStream(captured, 'clean', {
    AudioContext: ContextWithoutMeters,
    AudioWorkletNode: MockWorklet,
    MediaStream: MockStream,
    setInterval() { intervalCount++; return 1; },
    clearInterval() {},
  });
  assert.equal(pipeline.filtered, true);
  assert.equal(pipeline.getLevels(), null);
  assert.equal(intervalCount, 0);
  assert.equal(pipeline.stream.getAudioTracks().length, 1);
  pipeline.close();
});

test('absence of WebAudio returns original recording stream without diagnostic claim', async () => {
  const { captured } = makeCapture();
  const pipeline = await createCleanAudioStream(captured, 'clean', {});
  assert.equal(pipeline.stream, captured);
  assert.equal(pipeline.filtered, false);
  assert.equal(pipeline.getLevels(), null);
});

test('WebAudio reports recurring tonal peaks separately before and after processing', async () => {
  class ContextWithSpectrum extends MockContext {
    constructor() { super(); this.sampleRate = 48000; }
    createAnalyser() {
      const analyser = super.createAnalyser();
      analyser.getFloatFrequencyData = data => {
        assert.equal(data.length, 4096, '8192-point FFT needed for low-frequency tones');
        data.fill(-98);
        if (analyser.name === 'input-meter') {
          data[Math.round(100 * 8192 / 48000)] = -57;
          data[Math.round(3800 * 8192 / 48000)] = -63;
        }
      };
      return analyser;
    }
  }
  let sample;
  let stopped = false;
  const captured = makeCapture();
  const pipe = await createCleanAudioStream(captured.captured, 'clean', {
    AudioContext: ContextWithSpectrum,
    AudioWorkletNode: MockWorklet,
    MediaStream: MockStream,
    setInterval(fn) { sample = fn; return 17; },
    clearInterval(id) { assert.equal(id, 17); stopped = true; },
  });
  assert.equal(pipe.filtered, true);
  assert.equal(pipe.getLevels(), null);
  sample();
  sample();
  sample();
  const levels = pipe.getLevels();
  assert.deepEqual(levels.inputTones.map(t => t.hz), [100, 3800]);
  assert.deepEqual(levels.outputTones, [], 'processed stream should be inspected separately');
  assert.equal(levels.beforeDb, -20);
  assert.equal(levels.afterDb, -32);
  assert.equal(pipe.stream.getVideoTracks()[0], captured.video);
  pipe.close();
  assert.equal(stopped, true);
});

test('spectrum measurement failure never stops RMS diagnostics or the recording', async () => {
  class ContextWithBrokenSpectrum extends MockContext {
    constructor() { super(); this.sampleRate = 48000; }
    createAnalyser() {
      const node = super.createAnalyser();
      node.getFloatFrequencyData = () => { throw new Error('Spectrum unavailable'); };
      return node;
    }
  }
  let poll;
  const { captured } = makeCapture();
  const pipe = await createCleanAudioStream(captured, 'clean', {
    AudioContext: ContextWithBrokenSpectrum,
    AudioWorkletNode: MockWorklet,
    MediaStream: MockStream,
    setInterval(fn) { poll = fn; return 3; },
    clearInterval() {},
  });
  poll();
  const levels = pipe.getLevels();
  assert.equal(levels.beforeDb, -20);
  assert.equal(levels.afterDb, -32);
  assert.equal(levels.inputTones, undefined);
  assert.equal(pipe.stream.getAudioTracks().length, 1);
  pipe.close();
});
