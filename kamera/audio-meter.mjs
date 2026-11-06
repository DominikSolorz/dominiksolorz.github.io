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


// Detect narrow, repeatable tones as diagnostic hints only.
// This is not an electrical fault detector and never changes audio processing.
// Frequency data are dB values returned by AnalyserNode.getFloatFrequencyData().
export function spectralToneHints(frequencyData, sampleRate, fftSize) {
  if (!frequencyData || !Number.isFinite(sampleRate) || !Number.isFinite(fftSize) ||
      sampleRate <= 0 || fftSize < 1024 || frequencyData.length < 128) return [];
  const hzPerBin = sampleRate / fftSize;
  const nyquist = sampleRate / 2;
  const targets = [
    { hz: 100, peakWidth: 15, inner: 30, outer: 85 },
    { hz: 200, peakWidth: 15, inner: 30, outer: 85 },
    { hz: 3800, peakWidth: 65, inner: 130, outer: 350 },
  ];
  const result = [];
  for (const target of targets) {
    if (target.hz + target.outer >= nyquist) continue;
    let peak = -Infinity;
    const neighborhood = [];
    for (let i = 1; i < frequencyData.length; i++) {
      const hz = i * hzPerBin;
      const delta = Math.abs(hz - target.hz);
      const value = frequencyData[i];
      if (!Number.isFinite(value)) continue;
      if (delta <= target.peakWidth) peak = Math.max(peak, value);
      if (delta >= target.inner && delta <= target.outer) neighborhood.push(value);
    }
    if (!Number.isFinite(peak) || neighborhood.length < 4) continue;
    neighborhood.sort((a, b) => a - b);
    const baseline = neighborhood[Math.floor(neighborhood.length / 2)];
    const excessDb = peak - baseline;
    // Require both a visible signal and a strong narrowband contrast.
    if (peak > -95 && excessDb >= 12) {
      result.push({ hz: target.hz, excessDb: Math.round(excessDb * 10) / 10 });
    }
  }
  return result;
}

function stableToneHints(points, field) {
  const recent = points.slice(-5);
  if (recent.length < 3) return [];
  const result = [];
  for (const hz of [100, 200, 3800]) {
    const observations = recent.flatMap(point =>
      (point[field] || []).filter(candidate => candidate.hz === hz).map(candidate => candidate.excessDb)
    );
    if (observations.length < 3) continue;
    observations.sort((a, b) => a - b);
    result.push({ hz, excessDb: observations[Math.floor(observations.length / 2)] });
  }
  return result;
}

function quietPercentile(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * 0.20)];
}

// Low 20th percentile is a rough estimate of quiet portions, NOT calibrated
// room noise. Speech/music may occur in every sampled window.
function copyLevels(levels) {
  if (!levels) return null;
  return {
    ...levels,
    ...(levels.inputTones ? { inputTones: levels.inputTones.map(tone => ({ ...tone })) } : {}),
    ...(levels.outputTones ? { outputTones: levels.outputTones.map(tone => ({ ...tone })) } : {}),
  };
}

export function createAudioLevelHistory(windowMs = 60000) {
  let points = [];
  let last = null;
  return {
    observe(beforeSamples, afterSamples, at = Date.now(), tonal = null) {
      const beforeDb = rmsDbfs(beforeSamples);
      const afterDb = rmsDbfs(afterSamples);
      if (beforeDb === null || afterDb === null || !Number.isFinite(at)) return copyLevels(last);
      points = points.filter(point => at - point.time >= 0 && at - point.time <= windowMs);
      const hasTonal = Array.isArray(tonal?.inputTones) && Array.isArray(tonal?.outputTones);
      points.push({
        time: at, beforeDb, afterDb,
        ...(hasTonal ? {
          inputTones: tonal.inputTones.map(({ hz, excessDb }) => ({ hz, excessDb })),
          outputTones: tonal.outputTones.map(({ hz, excessDb }) => ({ hz, excessDb })),
        } : {}),
      });
      last = {
        beforeDb,
        afterDb,
        quietBeforeDb: quietPercentile(points.map(point => point.beforeDb)),
        quietAfterDb: quietPercentile(points.map(point => point.afterDb)),
        sampleCount: points.length,
        ...(hasTonal ? {
          inputTones: stableToneHints(points, 'inputTones'),
          outputTones: stableToneHints(points, 'outputTones'),
        } : {}),
      };
      return copyLevels(last);
    },
    snapshot() { return copyLevels(last); },
    clear() { points = []; last = null; },
  };
}
