import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = name => readFile(new URL('../kamera/'+name,import.meta.url),'utf8');
test('supplied design adaptation loads last and is available offline',async()=>{
  const [html,sw,css]=await Promise.all(['index.html','sw.js','interface-theme.css'].map(read));
  assert.ok(html.indexOf('interface-theme.css?v=1')>html.indexOf('workspace-ui.css?v='));
  assert.ok(sw.includes('./interface-theme.css?v=1'));
  assert.ok(css.includes('env(safe-area-inset-bottom)'));
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(css.includes('object-fit:contain'));
  assert.ok(!css.includes('display:none'));
});
