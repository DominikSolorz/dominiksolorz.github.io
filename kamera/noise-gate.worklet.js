// Lightweight noise gate in the audio render thread: no network, no microphone uploads.
class HomeSecurityNoiseGate extends AudioWorkletProcessor {
  constructor() {
    super();
    this.profile = 'clean';
    this.level = 0;
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
    const threshold = this.profile === 'voice' ? 0.006 : 0.009;
    if (this.level > threshold) this.holdSamples = Math.round(sampleRate * 0.35);
    else this.holdSamples = Math.max(0, this.holdSamples - frames);
    const quiet = this.level < threshold * 0.7 && this.holdSamples === 0;
    // Preserve low-level ambient cues; never fully hard-mute the microphone.
    const desired = this.profile === 'environment' || !quiet ? 1 : 0.12;
    const smoothing = desired > this.gain ? 0.55 : 0.035;
    const start = this.gain;
    this.gain += (desired - this.gain) * smoothing;
    for (let c = 0; c < output.length; c++) {
      const input = channels[Math.min(c, channels.length - 1)];
      const target = output[c];
      for (let i = 0; i < frames; i++) {
        const fraction = (i + 1) / frames;
        target[i] = (input[i] || 0) * (start + (this.gain - start) * fraction);
      }
    }
    return true;
  }
}
registerProcessor('home-security-noise-gate', HomeSecurityNoiseGate);
