// Stan i historia zdarzeń są rozdzielone. Brak telemetrii nie oznacza awarii.
export function createStore({ now = Date.now, logLimit = 100, onError = console.error } = {}) {
  let state = { revision: 0, route: "live", components: {}, events: [] };
  const listeners = new Set();
  const snapshot = () => structuredClone(state);
  function publish() {
    state.revision++;
    for (const listener of listeners) {
      try { listener(snapshot()); } catch (error) { onError(error); }
    }
  }
  return {
    snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    route(route) { state.route = route; publish(); },
    removeComponent(id) { delete state.components[id]; publish(); },
    component(id, telemetry) {
      state.components[id] = { ...structuredClone(telemetry), observedAt: now() };
      publish();
    },
    event(event) {
      state.events.push({ ...structuredClone(event), at: now() });
      state.events = state.events.slice(-logLimit);
      publish();
    },
    read(id, maxAgeMs = 30000) {
      const value = state.components[id];
      if (!value) return { status: "unknown", freshness: "unknown" };
      return { ...structuredClone(value), freshness: now() - value.observedAt > maxAgeMs ? "stale" : "fresh" };
    }
  };
}
export const systemStore = createStore();
