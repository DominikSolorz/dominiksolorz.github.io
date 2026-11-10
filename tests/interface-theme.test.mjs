import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {panelStylesheet,panelSection} from './helpers/panel-css.mjs';
const read = name => readFile(new URL('../kamera/'+name,import.meta.url),'utf8');
test('supplied design adaptation loads last and is available offline',async()=>{
  const [html,sw]=await Promise.all(['panel.html','sw.js'].map(read));
  const css=await panelSection('interface-theme.css');
  assert.ok(sw.includes('./'+panelStylesheet(html)));
  assert.ok(css.includes('env(safe-area-inset-bottom)'));
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(css.includes('object-fit:contain'));
  assert.ok(!css.includes('display:none'));
});
