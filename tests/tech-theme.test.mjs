import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('Tech Ops public theme loads last on generated marketing and document pages', async () => {
  const [home, mozliwosci, instrukcja, panel, sw] = await Promise.all([
    read('kamera/index.html'), read('kamera/mozliwosci.html'), read('kamera/instrukcja.html'), read('kamera/panel.html'), read('kamera/sw.js')
  ]);
  for (const [name, html] of [['index', home], ['mozliwosci', mozliwosci]]) {
    assert.ok(html.includes('href="tech-theme.css?v=1"'), name);
    assert.ok(html.indexOf('tech-theme.css') > html.indexOf('marketing.css'), name + ': theme must follow marketing.css');
  }
  assert.ok(instrukcja.indexOf('tech-theme.css?v=1') > instrukcja.indexOf('legal-premium.css'));
  assert.ok(panel.includes('href="tech-theme.css?v=1"'));
  assert.ok(sw.includes('./tech-theme.css?v=1'));
});

test('Tech Ops public theme is presentation-only and scoped to public pages', async () => {
  const css = await read('kamera/tech-theme.css');
  assert.match(css, /--t-cyan:#22d3ee/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(css, /#app\b/);
  assert.doesNotMatch(css, /display:\s*none|visibility:\s*hidden/i);
  assert.doesNotMatch(css, /\n\s*\*\s*\{/);
  // Reveal animation must survive the card transition override.
  assert.match(css, /transition:opacity \.72s/);
});

test('Tech Ops panel theme loads after Premium Dark Pro without touching recorder logic', async () => {
  const [panel, sw, css] = await Promise.all([read('kamera/panel.html'), read('kamera/sw.js'), read('kamera/tech-ops.css')]);
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const template = panel.match(/<template id="panelStyles">([\s\S]*?)<\/template>/)[1];
  assert.ok(template.indexOf('tech-ops.css?v=1') > template.indexOf('premium-dark-pro.css'));
  assert.ok(template.indexOf('tech-ops.css?v=1') > template.indexOf('remote-unlock-ui.css'));
  assert.ok(sw.includes('./tech-ops.css?v=1'));
  assert.match(css, /:not\(\.policeCommand\):not\(\.usMilitary\)/);
  assert.match(css, /#ctrlStart/);
  assert.match(css, /#ctrlStop/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(rules, /object-fit/);
  assert.doesNotMatch(rules, /display:\s*none|visibility:\s*hidden/i);
  assert.doesNotMatch(rules, /addEventListener|setInterval/);
  assert.doesNotMatch(rules, /\n\s*\*\s*\{/);
});
