import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { needsPanelRuntime } from '../kamera/panel-entry.mjs';

test('anonymous public routes load no account or camera runtime', () => {
  for (const search of ['', '?ui=phone', '?ui=computer', '?view=desktop', '?desktop=1']) {
    assert.equal(needsPanelRuntime({ search }), false, search);
  }
  assert.equal(needsPanelRuntime({ hash: '#galeria' }), false);
  assert.equal(needsPanelRuntime({ search: '?odbiorca=invalid' }), false);
});
test('account returns, device handoffs and valid receiver links retain immediate startup', () => {
  for (const search of ['?auth=login', '?auth=register', '?auth=forgot', '?auth=confirmed', '?code=callback', '?odbiorca=cam-' + 'a'.repeat(32)]) {
    assert.equal(needsPanelRuntime({ search }), true, search);
  }
  for (const hash of ['#access_token=test', '#type=recovery', '#error=access_denied', '#nadaj']) {
    assert.equal(needsPanelRuntime({ hash }), true, hash);
  }
  assert.equal(needsPanelRuntime({ native: true }), true);
  assert.equal(needsPanelRuntime({ pendingEntry: true }), true);
});
test('panel assets are inert templates and remain behind the existing secure gate', async () => {
  const html = await readFile(new URL('../kamera/panel.html', import.meta.url), 'utf8');
  const stripped = html.replace(/<template\b[^>]*>[\s\S]*?<\/template>/g, '');
  assert.doesNotMatch(stripped, /src="(?:vendor\/supabase|app|auth|desktop|mobile)\.(?:js|mjs)/);
  assert.doesNotMatch(stripped, /rel="preload"[^>]+supabase/);
  assert.doesNotMatch(stripped, /rel="stylesheet" href="(?:style|workspace-ui|interface-concept)\.css/);
  assert.match(html, /id="panelRuntime"/);
  assert.match(html, /id="panelStyles"/);
  assert.match(html, /panel-entry\.mjs\?v=2/);
  assert.match(html, /window\.__waitForPanel = new Promise/);
  assert.match(html, /window\.__panelRuntimeStarted&&!window\.__kameraReady/);
});

test('runtime waits for styles and the classic library before mounting account modules', async () => {
  const source = (await readFile(new URL('../kamera/panel-entry.mjs', import.meta.url), 'utf8')).replace('export function', 'function');
  const requests = [], events = {}, callbacks = [];
  const style = { cloneNode: () => ({ href: 'panel.css' }) };
  const script = (src, type = '') => ({ type, attributes: [{ name: 'src', value: src }, ...(type ? [{ name: 'type', value: type }] : [])] });
  const scripts = [script('supabase.js'), script('auth.js', 'module'), script('app.js', 'module')];
  const nodes = {
    panelStyles: { content: { querySelectorAll: () => [style] } },
    panelRuntime: { content: { querySelectorAll: () => scripts } },
    bootError: { hidden: true, textContent: '' },
  };
  const document = {
    getElementById: id => nodes[id],
    head: { append: node => { requests.push(node.href); callbacks.push(node.onload); } },
    body: { append: node => { requests.push(node.src); callbacks.push(node.onload); } },
    documentElement: { classList: { remove() {} } },
    createElement: () => ({ setAttribute(name, value) { this[name] = value; } }),
  };
  const window = { addEventListener: (name, callback) => { events[name] = callback; }, dispatchEvent() {} };
  vm.runInNewContext(source, { document, window, location: { pathname: '/kamera/panel.html', search: '?auth=login', hash: '' },
    sessionStorage: { getItem: () => null }, URLSearchParams, Event: class {} });
  assert.deepEqual(requests, ['panel.css']);
  callbacks.shift()(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, ['panel.css', 'supabase.js']);
  callbacks.shift()(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, ['panel.css', 'supabase.js', 'auth.js', 'app.js']);
  assert.equal(window.__panelRuntimeStarted, true);
  assert.equal(nodes.bootError.hidden, true);
});
