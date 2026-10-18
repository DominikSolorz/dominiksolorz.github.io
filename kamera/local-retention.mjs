// A fixed snapshot: never includes recordings created while cleanup is running.
export function oldRecordingPlan(entries, now = Date.now()) {
  const day = new Date(now);
  if (!Number.isFinite(day.getTime())) throw new Error('Nieprawidłowa data.');
  day.setHours(0, 0, 0, 0);
  const cutoff = day.getTime(), seen = new Set();
  const files = entries.filter(item => {
    if (!/^kamera-[^/\\]*\.(mp4|webm)$/i.test(item?.name || '') || seen.has(item.name) ||
        !Number.isFinite(item.start) || !Number.isFinite(item.end) ||
        item.start <= 0 || item.end < item.start || item.end >= cutoff || item.recording) return false;
    seen.add(item.name); return true;
  }).map(item => ({ name: item.name, start: item.start, end: item.end, size: item.size || 0 }));
  return { cutoff, files, bytes: files.reduce((sum, file) => sum + file.size, 0) };
}
