import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../kamera/'+path,import.meta.url),'utf8');

test('premium owner theme matches HTML and service worker revisions',async()=>{
 const [html,sw,style]=await Promise.all(['panel.html','sw.js','interface-theme.css'].map(read));
 const css=html.match(/interface-theme\.css\?v=(\d+)/);
 assert.ok(css,'owner theme must load on panel');
 assert.ok(sw.includes('./interface-theme.css?v='+css[1]),'PWA cache must reference same theme');
 assert.ok(style.includes('html.desktopMode:not(.policeCommand):not(.usMilitary)'));
 assert.ok(style.includes('html.mobileOwnerMode:not(.policeCommand):not(.usMilitary)'));
});

test('premium treatment preserves recorder safety cues and authentic camera frames',async()=>{
 const style=await read('interface-theme.css');
 assert.ok(style.includes('#stage video { object-fit:contain; }'));
 assert.ok(style.includes('#ctrlStart'));
 assert.ok(style.includes('#ctrlStop'));
 assert.ok(style.includes('background:#176a53'));
 assert.ok(style.includes('background:#44252e'));
 assert.ok(style.includes('prefers-reduced-motion:reduce'));
 assert.ok(style.includes('html:not(.policeCommand):not(.usMilitary)'));
});
