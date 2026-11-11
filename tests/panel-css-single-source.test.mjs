// Guards the single private-panel stylesheet (docs/PANEL-CSS.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {read, panelStylesheet, panelTemplateLinks} from './helpers/panel-css.mjs';
import {deadDeclarations} from './helpers/css-dead-declarations.mjs';

// Every stylesheet in kamera/ has an owner. A new file needs a documented reason here
// and in docs/PANEL-CSS.md; panel changes go into the matching section of panel.css.
const KNOWN_STYLESHEETS = new Set([
  'panel.css',                                   // private panel, PWA and Windows (single source)
  'style.css', 'workspace-ui.css', 'legal-premium.css', // legal documents and nagrania.html
  'marketing.css', 'marketing-motion.css', 'marketing-navigation.css', 'marketing-gallery.css',
  'marketing-start.css', 'marketing-auto-update.css', 'tech-theme.css',
  'support.css', // public pages
]);

test('the private panel loads exactly one stylesheet and the service worker precaches it', async () => {
  const [html, sw] = await Promise.all([read('kamera/panel.html'), read('kamera/sw.js')]);
  const sheet = panelStylesheet(html);
  assert.ok(sw.includes('"./' + sheet + '"'), 'SHELL must contain ' + sheet);
  assert.deepEqual(panelTemplateLinks(html), [sheet]);
});

test('no dead declaration: a later rule never silently overrides the same selector and property', async () => {
  const dead = deadDeclarations(await read('kamera/panel.css'));
  assert.deepEqual(dead.slice(0, 10).map(d => `${d.selector.slice(0, 90)} { ${d.prop}: ${d.value}${d.important ? ' !important' : ''} }`), [],
    'Edit the existing declaration instead of adding an overriding copy (' + dead.length + ' dead declarations)');
});

test('no new stylesheet layers are added to kamera/ without an owner', async () => {
  const files = (await readdir(new URL('../kamera/', import.meta.url))).filter(f => f.endsWith('.css'));
  const unknown = files.filter(f => !KNOWN_STYLESHEETS.has(f));
  assert.deepEqual(unknown, [], 'Do not add new-style.css / final-design.css style layers; edit the right section of panel.css (docs/PANEL-CSS.md)');
});

test('panel.css keeps the protected modes, PIN, camera and recorder selectors', async () => {
  const css = await read('kamera/panel.css');
  for (const token of [':not(.policeCommand):not(.usMilitary)', 'html.desktopMode', 'html.mobileOwnerMode', '#lock', '.keypad', '#ctrlStart', '#ctrlStop', '#stage video', '[hidden]', 'prefers-reduced-motion', 'data-mobile-view="camera"'])
    assert.ok(css.includes(token), 'missing ' + token);
  assert.doesNotMatch(css, /@import/);
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'balanced braces');
});

test('the Windows package contains the WebP variants that public pages in Panel/ reference', async () => {
  const [build, optimizer] = await Promise.all([read('desktop-client/build-release.ps1'), read('scripts/optimize-marketing-images.mjs')]);
  assert.match(build, /scripts\/optimize-marketing-images\.mjs/);
  assert.match(build, /Panel\/assets/);
  // Every kamera/assets/*.webp referenced by a bundled page is produced by the optimizer.
  const produced = new Set([...optimizer.matchAll(/out:'kamera\/assets\/([^']+\.webp)'/g)].map(m => m[1]));
  const {readdir} = await import('node:fs/promises');
  const committed = new Set((await readdir(new URL('../kamera/assets/', import.meta.url))).filter(f => f.endsWith('.webp')));
  for (const page of ['kamera/index.html', 'kamera/panel.html', 'kamera/pobierz.html', 'kamera/o-systemie.html']) {
    for (const [, name] of (await read(page)).matchAll(/assets\/([\w.-]+\.webp)/g))
      assert.ok(committed.has(name) || produced.has(name), `${page}: ${name} would be 404 in the Windows app`);
  }
  for (const name of produced) assert.ok(build.includes(name), 'release check must verify ' + name);
});
