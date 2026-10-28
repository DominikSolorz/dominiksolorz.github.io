import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = name => readFile(new URL('../kamera/'+name,import.meta.url),'utf8');
test('supplied design adaptation loads last and is available offline',async()=>{
  const [html,sw,css]=await Promise.all(['panel.html','sw.js','interface-theme.css'].map(read));
  const theme=html.match(/href="(interface-theme\.css\?v=\d+)"/)[1];
  assert.ok(html.indexOf(theme)>html.indexOf('workspace-ui.css?v='));
  assert.ok(sw.includes('./'+theme));
  assert.ok(css.includes('env(safe-area-inset-bottom)'));
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(css.includes('object-fit:contain'));
  assert.ok(!css.includes('display:none'));
});
