import { systemStore } from "./store.mjs";
// Router dostaje wyłącznie funkcję renderującą, nigdy sender/recorder/stream.
export function createRouter({ routes, render, store = systemStore }) {
  const allowed = new Set(routes);
  let current = null;
  return {
    navigate(route) {
      if (!allowed.has(route)) return false;
      render(route, current);
      current = route;
      store.route(route);
      return true;
    },
    get current() { return current; }
  };
}
