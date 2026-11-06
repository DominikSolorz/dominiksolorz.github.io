// Lightweight noise gate in the audio render thread: no network, no microphone uploads.
class HomeSecurityNoiseGate extends AudioWorkletProcessor {
  constructor() {
    super();
    this.profile = 'clean';
    this.level = 0;
    this.noiseFloor = null;
    this.gain = 1;
    this.holdSamples = 0;
    this.port.onmessage = event => {
      if (['clean', 'voice', 'environment'].includes(event.data?.profile)) this.profile = event.data.profile;
    };
  }
  process(inputs, outputs) {
    const channels = inputs[0] || [];
    const output = outputs[0] || [];
    const frames = output[0]?.length || 0;
    if (!frames) return true;
    if (!channels.length) {
      for (const channel of output) channel.fill(0);
      return true;
    }
    let power = 0, count = 0;
    for (const channel of channels) for (let i = 0; i < frames; i++) {
      const sample = channel[i] || 0;
      power += sample * sample;
      count++;
    }
    const rms = Math.sqrt(power / Math.max(1, count));
    this.level += (rms > this.level ? 0.55 : 0.08) * (rms - this.level);

    // Follow persistent background sound instead of a single fixed threshold.
    // Track downward changes quickly, upward changes slowly; short speech bursts
    // must not train the estimated noise floor into being treated as noise.
    if (this.noiseFloor === null) this.noiseFloor = rms;
    else this.noiseFloor += (rms < this.noiseFloor ? 0.20 : 0.003) * (rms - this.noiseFloor);
    // Bounded threshold prevents a loud room from silencing ordinary speech.
    const base = this.profile === 'voice' ? 0.003 : 0.005;
    const threshold = Math.min(0.028, Math.max(base, this.noiseFloor * 1.65));
    if (this.level > threshold) this.holdSamples = Math.round(sampleRate * 0.45);
    else this.holdSamples = Math.max(0, this.holdSamples - frames);
    const quiet = this.level < threshold * 0.8 && this.holdSamples === 0;
    // Reduce steady background hiss; never hard-mute quiet safety-critical cues.
    const desired = this.profile === 'environment' || !quiet ? 1 : 0.20;
    const smoothing = desired > this.gain ? 0.55 : 0.035;
    const start = this.gain;
    this.gain += (desired - this.gain) * smoothing;
    for (let c = 0; c < output.length; c++) {
      const input = channels[Math.min(c, channels.length - 1)];
      const target = output[c];
      for (let i = 0; i < frames; i++) {
        const fraction = (i + 1) / frames;
        const sample = input[i] || 0;
        const processed = sample * (start + (this.gain - start) * fraction);
        target[i] = Number.isFinite(processed) ? Math.max(-1, Math.min(1, processed)) : 0;
      }
    }
    return true;
  }
}
registerProcessor('home-security-noise-gate', HomeSecurityNoiseGate);
