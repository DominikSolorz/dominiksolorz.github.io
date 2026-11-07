import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('panel layout blueprint maps only to identifiers that exist in kamera/panel.html', async () => {
  const [blueprint, panel] = await Promise.all([read('design/panel-layout/index.html'), read('kamera/panel.html')]);
  const existing = new Set([...panel.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const sources = [...blueprint.matchAll(/data-hs-source="([^"]+)"/g)].map(m => m[1]);
  assert.ok(sources.length >= 15, 'every region should declare its data source');
  const referenced = sources.flatMap(s => [...s.matchAll(/(?:^|[\s,])#([A-Za-z][\w-]*)/g)].map(m => m[1]));
  // desktop.js creates these at runtime; they are not in panel.html.
  const runtimeCreated = new Set(['desktopSearchInput']);
  for (const id of referenced) assert.ok(existing.has(id) || runtimeCreated.has(id), 'unknown panel id: #' + id);
});

test('panel layout blueprint stays out of the published app and release triggers', async () => {
  const [panel, sw, pages, release, buildMarketing] = await Promise.all([
    read('kamera/panel.html'), read('kamera/sw.js'), read('.github/workflows/pages.yml'),
    read('.github/workflows/desktop-scheduled-release.yml'), read('scripts/build-marketing.mjs')
  ]);
  for (const text of [panel, sw, buildMarketing]) assert.doesNotMatch(text, /panel-layout/);
  assert.match(pages, /--exclude='\/design\/'/);
  assert.doesNotMatch(release, /design\/panel-layout|'design\/\*\*'/);
});

test('panel layout prototype script is offline and shows no unlabelled sample data', async () => {
  const [script, blueprint] = await Promise.all([read('design/panel-layout/app.js'), read('design/panel-layout/index.html')]);
  assert.doesNotMatch(script, /\bfetch\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon|supabase/i);
  assert.doesNotMatch(script + blueprint, /aivo/i);
  // Sample data is opt-in and every sample label is marked.
  assert.match(script, /let sampleOn = store\.get\('sample', false\)/);
  const sampleBlock = script.slice(script.indexOf('const SAMPLE'), script.indexOf('const shell'));
  for (const m of sampleBlock.matchAll(/(?:sub|cameras?).{0,4}'([^']+)'/g)) {
    if (/·/.test(m[1])) assert.match(m[1], /^PRZYKŁAD ·/, m[1]);
  }
  assert.match(blueprint, /DANE PRZYKŁADOWE/);
  assert.match(blueprint, /niepodłączone/);
});
