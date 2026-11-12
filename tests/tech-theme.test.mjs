import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {panelStylesheet,panelSection} from './helpers/panel-css.mjs';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('Tech Ops public theme loads last on generated marketing and document pages', async () => {
  const [home, mozliwosci, instrukcja, panel, sw] = await Promise.all([
    read('kamera/index.html'), read('kamera/mozliwosci.html'), read('kamera/instrukcja.html'), read('kamera/panel.html'), read('kamera/sw.js')
  ]);
  for (const [name, html] of [['index', home], ['mozliwosci', mozliwosci]]) {
    assert.ok(html.includes('href="tech-theme.css?v=9"'), name);
    assert.ok(html.indexOf('tech-theme.css') > html.indexOf('marketing.css'), name + ': theme must follow marketing.css');
  }
  assert.ok(instrukcja.indexOf('tech-theme.css?v=9') > instrukcja.indexOf('legal-premium.css'));
  assert.ok(panel.includes('href="tech-theme.css?v=9"'));
  assert.ok(sw.includes('./tech-theme.css?v=9'));
});

test('Tech Ops public theme is presentation-only and scoped to public pages', async () => {
  const css = await read('kamera/tech-theme.css');
  assert.match(css, /--t-cyan:#ee2236/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(css, /#app\b/);
  assert.doesNotMatch(css, /display:\s*none|visibility:\s*hidden/i);
  assert.doesNotMatch(css, /\n\s*\*\s*\{/);
  // Reveal animation must survive the card transition override.
  assert.match(css, /transition:opacity \.72s/);
});

test('Tech Ops panel theme loads after Premium Dark Pro without touching recorder logic', async () => {
  const [panel, sw, all, css] = await Promise.all([read('kamera/panel.html'), read('kamera/sw.js'), read('kamera/panel.css'), panelSection('tech-ops.css')]);
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const at = name => all.indexOf('(dawniej ' + name + ')');
  assert.ok(at('tech-ops.css') > at('premium-dark-pro.css') && at('premium-dark-pro.css') > 0);
  assert.ok(at('tech-ops.css') > at('remote-unlock-ui.css') && at('remote-unlock-ui.css') > 0);
  assert.ok(sw.includes('./' + panelStylesheet(panel)));
  assert.match(css, /:not\(\.policeCommand\):not\(\.usMilitary\)/);
  assert.match(css, /#ctrlStart/);
  assert.match(css, /#ctrlStop/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(rules, /object-fit/);
  assert.doesNotMatch(rules, /display:\s*none|visibility:\s*hidden/i);
  assert.doesNotMatch(rules, /addEventListener|setInterval/);
  assert.doesNotMatch(rules, /\n\s*\*\s*\{/);
});

test('mobile camera frame never overrides the mobileHidden view switch', async () => {
  const css = await panelSection('mobile-camera-frame.css');
  // mobile.js marks #stage .mobileHidden outside the Podgląd view; a forced display:block must exclude it.
  const forced = [...css.matchAll(/([^{}]*#stage[^{}]*)\{[^}]*display:block!important/g)].map(m => m[1]);
  assert.ok(forced.length > 0);
  for (const selector of forced) assert.match(selector, /:not\(\.mobileHidden\)/, selector.trim());
});

test('Tech Ops styles the Windows sidebar, which lives outside #app', async () => {
  const css = await panelSection('tech-ops.css');
  // The active sidebar item is styled by the dashboard section; the identical Tech Ops and
  // operator-layout rules for the same selector were always overridden and were removed.
  assert.match(await panelSection('dashboard-design.css'), /body \.desktopNav button\.active\{[^}]*inset 3px 0 0/);
  assert.match(css, /\.modeList\{\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
