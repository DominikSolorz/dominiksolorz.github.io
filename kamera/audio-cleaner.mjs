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
  const fallback = { stream: captured, sourceTrack, filtered: false, setProfile() {}, close() {} };
  if (!sourceTrack || sourceTrack.readyState !== 'live') return fallback;
  const Context = environment.AudioContext || environment.webkitAudioContext;
  const Worklet = environment.AudioWorkletNode;
  const Media = environment.MediaStream;
  if (!Context || !Worklet || !Media) return fallback;
  let context, destination;
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
    source.connect(high);
    high.connect(low);
    low.connect(gate);
    gate.connect(cleanLevel);
    cleanLevel.connect(destination);
    source.connect(rawLevel);
    rawLevel.connect(destination);
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
    const stream = new Media([...captured.getVideoTracks(), outputTrack]);
    const onEnded = () => outputTrack.stop();
    sourceTrack.addEventListener?.('ended', onEnded);
    let closed = false;
    return {
      stream, sourceTrack, filtered: true, setProfile,
      close() {
        if (closed) return;
        closed = true;
        sourceTrack.removeEventListener?.('ended', onEnded);
        gate.port.close?.();
        outputTrack.stop();
        sourceTrack.stop();
        context.close().catch(() => {});
      },
    };
  } catch (_) {
    destination?.stream.getAudioTracks().forEach(track => track.stop());
    context?.close().catch(() => {});
    return fallback;
  }
}
