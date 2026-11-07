import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('stage 2 panel layout loads last in panelStyles and is precached', async () => {
  const [panel, sw] = await Promise.all([read('kamera/panel.html'), read('kamera/sw.js')]);
  const template = panel.match(/<template id="panelStyles">([\s\S]*?)<\/template>/)[1];
  const links = [...template.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert.equal(links.at(-1), 'operator-layout.css?v=1', 'operator-layout.css must be the last panel stylesheet');
  assert.ok(sw.includes('./operator-layout.css?v=1'));
  // Never loaded on the public landing page before the secure panel starts.
  assert.doesNotMatch(panel.slice(0, panel.indexOf('<template id="panelStyles">')), /operator-layout\.css/);
});

test('stage 2 panel layout is presentation-only and keeps alternative themes and video geometry', async () => {
  const css = (await read('kamera/operator-layout.css')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /:not\(\.policeCommand\):not\(\.usMilitary\)/);
  // Every selector (outside @media headers) starts from the scoped html element.
  const flat = css.replace(/@media[^{]*\{/g, '');
  for (const block of flat.split('}')) {
    const selector = block.includes('{') ? block.slice(0, block.indexOf('{')).trim() : '';
    if (!selector) continue;
    let depth = 0, part = '';
    for (const ch of selector + ',') {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { assert.match(part.trim(), /^html[:.\s]/, 'unscoped selector: ' + part.trim().slice(0, 80)); part = ''; continue; }
      part += ch;
    }
  }
  assert.doesNotMatch(css, /object-fit/);
  assert.doesNotMatch(css, /display:\s*none|visibility:\s*hidden/i);
  assert.doesNotMatch(css, /\n\s*\*\s*\{/);
  assert.match(css, /#ctrlStart/);
  assert.match(css, /#ctrlStop/);
  assert.match(css, /focus-visible/);
});
