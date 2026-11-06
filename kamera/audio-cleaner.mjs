import { createAudioLevelHistory } from './audio-meter.mjs?v=1';

// Captured microphone -> filters -> worklet noise gate -> one shared output track.
// The same processed track is used for live WebRTC and recordings; never play it locally.
const MODES = Object.freeze({
  clean: { highpass: 110, lowpass: 7600 },
  voice: { highpass: 130, lowpass: 6800 },
  environment: { highpass: 110, lowpass: 7600 },
});
export async function createCleanAudioStream(captured, profile = 'clean', environment = globalThis) {
  if (!Object.hasOwn(MODES, profile)) throw new Error('Nieprawidłowy tryb mikrofonu.');
  const sourceTrack = captured.getAudioTracks()[0] || null;
  const fallback = { stream: captured, sourceTrack, filtered: false, setProfile() {}, getLevels() { return null; }, close() {} };
  if (!sourceTrack || sourceTrack.readyState !== 'live') return fallback;
  const Context = environment.AudioContext || environment.webkitAudioContext;
  const Worklet = environment.AudioWorkletNode;
  const Media = environment.MediaStream;
  if (!Context || !Worklet || !Media) return fallback;
  let context, destination, levelTimer = null;
  try {
    context = new Context({ latencyHint: 'interactive' });
    if (!context.audioWorklet?.addModule) throw new Error('AudioWorklet unavailable');
    await context.audioWorklet.addModule(new URL('./noise-gate.worklet.js?v=2', import.meta.url).href);
    const source = context.createMediaStreamSource(new Media([sourceTrack]));
    const high = context.createBiquadFilter();
    high.type = 'highpass';
    const low = context.createBiquadFilter();
    low.type = 'lowpass';
    const gate = new Worklet(context, 'home-security-noise-gate');
    const cleanLevel = context.createGain();
    const rawLevel = context.createGain();
    destination = context.createMediaStreamDestination();
    let inputMeter = null, outputMeter = null, levelHistory = null;
    try {
      // These analysers are transparent: one is on the original microphone path
      // and the other is after the filtered/raw branches have been mixed.
      inputMeter = context.createAnalyser();
      outputMeter = context.createAnalyser();
      inputMeter.fftSize = 2048;
      outputMeter.fftSize = 2048;
      levelHistory = createAudioLevelHistory();
    } catch {
      // Older embedded browsers continue recording with the normal audio graph.
      inputMeter = null;
      outputMeter = null;
    }
    if (inputMeter && outputMeter) {
      source.connect(inputMeter);
      inputMeter.connect(high);
      inputMeter.connect(rawLevel);
    } else {
      source.connect(high);
      source.connect(rawLevel);
    }
    high.connect(low);
    low.connect(gate);
    gate.connect(cleanLevel);
    if (inputMeter && outputMeter) {
      const mix = context.createGain();
      cleanLevel.connect(mix);
      rawLevel.connect(mix);
      mix.connect(outputMeter);
      outputMeter.connect(destination);
    } else {
      cleanLevel.connect(destination);
      rawLevel.connect(destination);
    }
    const outputTrack = destination.stream.getAudioTracks()[0];
    if (!outputTrack) throw new Error('No processed audio track');
    function setProfile(next) {
      if (!Object.hasOwn(MODES, next)) throw new Error('Nieprawidłowy tryb mikrofonu.');
      high.frequency.setTargetAtTime(MODES[next].highpass, context.currentTime, 0.04);
      low.frequency.setTargetAtTime(MODES[next].lowpass, context.currentTime, 0.04);
      gate.port.postMessage({ profile: next });
      cleanLevel.gain.setTargetAtTime(next === 'environment' ? 0 : 1, context.currentTime, 0.025);
      rawLevel.gain.setTargetAtTime(next === 'environment' ? 1 : 0, context.currentTime, 0.025);
    }
    // Avoid an accidental doubled signal during initial gain ramps.
    cleanLevel.gain.value = profile === 'environment' ? 0 : 1;
    rawLevel.gain.value = profile === 'environment' ? 1 : 0;
    setProfile(profile);
    // Some embedded browsers disallow automatic audio context activation. Fail open
    // to the original microphone rather than sending a silent recording.
    if (context.state !== 'running') {
      await Promise.race([
        context.resume(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Audio context suspended')), 850)),
      ]);
      if (context.state !== 'running') throw new Error('Audio context is not running');
    }
    // Periodic, numeric-only snapshots. No sound data is stored or sent anywhere.
    if (inputMeter && outputMeter && typeof environment.setInterval === 'function') {
      const before = new Float32Array(inputMeter.fftSize);
      const after = new Float32Array(outputMeter.fftSize);
      const sampleLevel = () => {
        if (context.state !== 'running') return;
        try {
          inputMeter.getFloatTimeDomainData(before);
          outputMeter.getFloatTimeDomainData(after);
          levelHistory.observe(before, after);
        } catch { /* Diagnostics must never interrupt audio capture. */ }
      };
      levelTimer = environment.setInterval(sampleLevel, 1000);
    }
    const stream = new Media([...captured.getVideoTracks(), outputTrack]);
    const onEnded = () => outputTrack.stop();
    sourceTrack.addEventListener?.('ended', onEnded);
    let closed = false;
    return {
      stream, sourceTrack, filtered: true, setProfile,
      getLevels() { return levelHistory?.snapshot() || null; },
      close() {
        if (closed) return;
        closed = true;
        if (levelTimer !== null) { environment.clearInterval?.(levelTimer); levelTimer = null; }
        levelHistory?.clear();
        sourceTrack.removeEventListener?.('ended', onEnded);
        gate.port.close?.();
        outputTrack.stop();
        sourceTrack.stop();
        context.close().catch(() => {});
      },
    };
  } catch (_) {
    if (levelTimer !== null) environment.clearInterval?.(levelTimer);
    destination?.stream.getAudioTracks().forEach(track => track.stop());
    context?.close().catch(() => {});
    return fallback;
  }
}
