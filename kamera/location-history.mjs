// Prywatna historia tras konta. Zapis działa tylko po jawnym włączeniu przez użytkownika
// na danym urządzeniu; dane widzi wyłącznie właściciel konta (RLS), przechowywane 30 dni.
const DEVICE_KEY = 'hs-location-device';
const MIN_INTERVAL_MS = 30000;
const MIN_DISTANCE_M = 25;
const MISSING_TABLE = new Set(['42P01', 'PGRST205', 'PGRST202', '42883']);

const distance = (a, b) => {
  const rad = d => d * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
};

export function shouldRecord(last, next, { minMs = MIN_INTERVAL_MS, minMeters = MIN_DISTANCE_M } = {}) {
  if (!next || !Number.isFinite(next.lat) || !Number.isFinite(next.lon) || !Number.isFinite(next.at)) return false;
  if (!last) return true;
  return next.at - last.at >= minMs && distance(last, next) >= minMeters;
}

export function deviceInfo(storage = globalThis.localStorage, nav = globalThis.navigator) {
  let id = '';
  try { id = storage?.getItem(DEVICE_KEY) || ''; } catch { /* brak dostępu do pamięci */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    id = globalThis.crypto.randomUUID();
    try { storage?.setItem(DEVICE_KEY, id); } catch { /* identyfikator tylko na czas sesji */ }
  }
  const mobile = /android|iphone|ipad|mobile/i.test(nav?.userAgent || '');
  return { id, label: mobile ? 'Telefon' : 'Komputer' };
}

export function createLocationStore({ client, ownerId, device = deviceInfo() }) {
  if (!client || !/^[a-f0-9-]{36}$/i.test(ownerId || '')) return null;
  const unavailable = error => MISSING_TABLE.has(error?.code) ? { unavailable: true } : { error: true };
  let last = null;
  return {
    device,
    async start() {
      last = null;
      const { error } = await client.rpc('hs_prune_location_points');
      return error ? unavailable(error) : { ok: true };
    },
    async save({ lat, lon, accuracy, at = Date.now() }) {
      const point = { lat, lon, at };
      if (!shouldRecord(last, point)) return { skipped: true };
      last = point;
      const { error } = await client.from('hs_location_points').insert({
        owner_id: ownerId, device_id: device.id, device_label: device.label, lat, lon,
        accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null, recorded_at: new Date(at).toISOString()
      });
      return error ? unavailable(error) : { ok: true };
    },
    async recent(hours = 24) {
      const since = new Date(Date.now() - hours * 3600000).toISOString();
      const { data, error } = await client.from('hs_location_points')
        .select('device_id,device_label,lat,lon,recorded_at').eq('owner_id', ownerId)
        .gte('recorded_at', since).order('recorded_at', { ascending: true }).limit(1500);
      return error ? unavailable(error) : { ok: true, points: data || [] };
    },
    async clear() {
      const { error } = await client.from('hs_location_points').delete().eq('owner_id', ownerId);
      return error ? unavailable(error) : { ok: true };
    }
  };
}

export function groupRoutes(points, ownDeviceId) {
  const routes = new Map();
  for (const p of Array.isArray(points) ? points : []) {
    if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lon) || !p.device_id) continue;
    if (!routes.has(p.device_id)) routes.set(p.device_id, { deviceId: p.device_id, label: String(p.device_label || 'Urządzenie').slice(0, 60), own: p.device_id === ownDeviceId, points: [] });
    routes.get(p.device_id).points.push({ lat: p.lat, lon: p.lon, at: Date.parse(p.recorded_at) || 0 });
  }
  return [...routes.values()];
}
