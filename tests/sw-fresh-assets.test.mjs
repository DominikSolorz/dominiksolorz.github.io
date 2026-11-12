// Service worker: published CSS/JS must reach users even when the cached URL is unchanged,
// while offline use keeps working from the shell cache.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../kamera/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://dominiksolorz.github.io';

function worker({network = 'ok', cached = {}, delay = 0} = {}) {
  const events = {}, fetches = [], store = new Map(Object.entries(cached));
  const cache = {
    put: async (key, response) => { store.set(typeof key === 'string' ? key : key.url, await response.text()); },
    match: async key => { const k = typeof key === 'string' ? key : key.url; return store.has(k) ? new Response(store.get(k)) : undefined; },
    keys: async () => [...store.keys()].map(url => ({url})),
    delete: async request => store.delete(request.url),
    addAll: async requests => { for (const r of requests) { fetches.push({url: r.url, cache: r.cache}); store.set(r.url, 'fresh ' + r.url); } },
  };
  class Req { constructor(url, init = {}) { this.url = new URL(url, ORIGIN + '/kamera/sw.js').href; this.cache = init.cache || 'default'; } }
  const scope = {
    self: {location: new URL(ORIGIN + '/kamera/sw.js'), addEventListener: (name, fn) => { events[name] = fn; }, skipWaiting: () => {}, clients: {claim: async () => {}}},
    URL, Response, Request: Req, setTimeout, Promise, Set,
    fetch: async (request, options) => {
      fetches.push({url: request.url, cache: options?.cache || 'default'});
      if (delay) await new Promise(r => setTimeout(r, delay));
      if (network === 'offline') throw Error('offline');
      if (network === '500') return new Response('err', {status: 500});
      return new Response('network ' + request.url, {headers: {'content-type': 'text/css'}});
    },
    caches: {open: async () => cache, match: cache.match, keys: async () => ['kamera-domowa-shell-old'], delete: async () => true},
  };
  vm.runInNewContext(source, scope);
  const request = path => ({url: ORIGIN + path, method: 'GET', mode: 'no-cors'});
  const respond = async path => { let p; events.fetch({request: request(path), respondWith: x => { p = x; }}); return p && (await p).text(); };
  return {events, fetches, store, respond};
}

test('panel stylesheet is revalidated over the network before the cached copy is used', async () => {
  const sw = worker({cached: {[ORIGIN + '/kamera/panel.css?v=1']: 'old look'}});
  assert.equal(await sw.respond('/kamera/panel.css?v=1'), 'network ' + ORIGIN + '/kamera/panel.css?v=1');
  assert.equal(sw.fetches.at(-1).cache, 'no-cache', 'conditional request bypasses a stale HTTP cache');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(sw.store.get(ORIGIN + '/kamera/panel.css?v=1'), 'network ' + ORIGIN + '/kamera/panel.css?v=1', 'offline copy is refreshed');
});

test('offline or failing server falls back to the saved stylesheet and script', async () => {
  for (const network of ['offline', '500']) {
    const sw = worker({network, cached: {[ORIGIN + '/kamera/panel.css?v=1']: 'saved css', [ORIGIN + '/kamera/app.js?v=1']: 'saved js'}});
    assert.equal(await sw.respond('/kamera/panel.css?v=1'), 'saved css');
    assert.equal(await sw.respond('/kamera/app.js?v=1'), 'saved js');
  }
});

test('install stores the shell from the network, never from the browser HTTP cache', async () => {
  const sw = worker();
  let done; sw.events.install({waitUntil: p => { done = p; }}); await done;
  const panelCss = sw.fetches.find(f => f.url.includes('/kamera/panel.css?v='));
  assert.ok(panelCss, 'consolidated panel stylesheet is precached');
  assert.ok(sw.fetches.every(f => f.cache === 'reload'));
  assert.ok(sw.fetches.some(f => f.url.endsWith('/kamera/marketing.css?v=21')), 'public start page styles remain available offline');
});

test('activation removes stylesheets that the current release no longer uses but keeps images', async () => {
  const sw = worker({cached: {
    [ORIGIN + '/kamera/operator-layout.css?v=11']: 'old layer',
    [ORIGIN + '/kamera/style.css?v=184']: 'old version',
    [ORIGIN + '/kamera/assets/ds-shield.svg']: 'image',
  }});
  let done; sw.events.activate({waitUntil: p => { done = p; }}); await done;
  assert.ok(!sw.store.has(ORIGIN + '/kamera/operator-layout.css?v=11'));
  assert.ok(!sw.store.has(ORIGIN + '/kamera/style.css?v=184'));
  assert.ok(sw.store.has(ORIGIN + '/kamera/assets/ds-shield.svg'));
});

test('images keep the cache-first offline behaviour', async () => {
  const sw = worker({cached: {[ORIGIN + '/kamera/assets/ds-shield.svg']: 'cached image'}});
  assert.equal(await sw.respond('/kamera/assets/ds-shield.svg'), 'cached image');
  assert.equal(sw.fetches.length, 0);
});
