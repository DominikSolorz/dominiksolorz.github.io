import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('desktop operator theme precedes the final scoped mobile theme and is precached', async () => {
  const [panel, sw] = await Promise.all([read('kamera/panel.html'), read('kamera/sw.js')]);
  const template = panel.match(/<template id="panelStyles">([\s\S]*?)<\/template>/)[1];
  const links = [...template.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert.ok(links.indexOf('operator-layout.css?v=3') > links.indexOf('tech-ops.css?v=2'));
  assert.equal(links.at(-1), 'mobile-app-look.css?v=9', 'phone layout must override shared operator cards');
  assert.ok(sw.includes('./operator-layout.css?v=3'));
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

test('stage 3 auth and PIN background ships with the panel and keeps the PIN keypad intact', async () => {
  const [css, panel] = await Promise.all([read('kamera/operator-layout.css'), read('kamera/panel.html')]);
  const { stat } = await import('node:fs/promises');
  const asset = await stat(new URL('../kamera/assets/auth-night.webp', import.meta.url));
  assert.ok(asset.size > 1000 && asset.size < 200000, 'background must be a small optimised image');
  assert.match(css, /url\("assets\/auth-night\.webp"\)/);
  for (const key of ['1','2','3','4','5','6','7','8','9','0','del','ok']) assert.ok(panel.includes(`data-k="${key}"`), 'keypad key ' + key);
  assert.match(css, /\.keypad button\[data-k="ok"\]/);
});
