// Numeric-only local audio diagnostics. Never store or transmit microphone samples.
export function rmsDbfs(samples) {
  if (!samples || !samples.length) return null;
  let power = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = Number(samples[i]);
    if (!Number.isFinite(sample)) return null;
    power += sample * sample;
  }
  const rms = Math.sqrt(power / samples.length);
  return Math.round(Math.max(-120, Math.min(0, 20 * Math.log10(Math.max(rms, 1e-6)))) * 10) / 10;
}

function quietPercentile(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * 0.20)];
}

// Low 20th percentile is a rough estimate of quiet portions, NOT calibrated
// room noise. Speech/music may occur in every sampled window.
export function createAudioLevelHistory(windowMs = 60000) {
  let points = [];
  let last = null;
  return {
    observe(beforeSamples, afterSamples, at = Date.now()) {
      const beforeDb = rmsDbfs(beforeSamples);
      const afterDb = rmsDbfs(afterSamples);
      if (beforeDb === null || afterDb === null || !Number.isFinite(at)) return last;
      points = points.filter(point => at - point.time >= 0 && at - point.time <= windowMs);
      points.push({ time: at, beforeDb, afterDb });
      last = {
        beforeDb,
        afterDb,
        quietBeforeDb: quietPercentile(points.map(point => point.beforeDb)),
        quietAfterDb: quietPercentile(points.map(point => point.afterDb)),
        sampleCount: points.length,
      };
      return { ...last };
    },
    snapshot() { return last ? { ...last } : null; },
    clear() { points = []; last = null; },
  };
}
