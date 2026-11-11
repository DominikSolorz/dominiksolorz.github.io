import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {panelStylesheet,panelSection} from './helpers/panel-css.mjs';
const read = name => readFile(new URL('../kamera/'+name,import.meta.url),'utf8');
test('workspace stylesheet loads after legacy styles and is cached',async()=>{
 const [html,sw]=await Promise.all(['panel.html','sw.js'].map(read));
 const css=await panelSection('workspace-ui.css');
 assert.ok(sw.includes('./'+panelStylesheet(html)));assert.ok(css.includes(':focus-visible'));
 assert.ok(css.includes('@media(max-width:600px)'));
});
test('events navigation reuses actual card rather than copying event data',async()=>{
 const desktop=await read('desktop.js');
 assert.ok(desktop.includes('data-desktop-view="events"'));
 assert.ok(desktop.includes('mountEventWorkspace(eventsScreen)'));
 assert.ok(desktop.includes('eventsDrawer.append(eventCard)'));
 assert.ok(!desktop.includes('eventCard.cloneNode'));
 const render=desktop.slice(desktop.indexOf('const openExistingView'),desktop.indexOf('const sync ='));
 assert.ok(!/getTracks|\.stop\(|srcObject\s*=|sender\./.test(render));
});
test('HOME SECURITY logo is used without turning concept boards into application backgrounds',async()=>{
 const desktop=await read('desktop.js');
 assert.ok(desktop.includes('src="assets/hs-logo.webp"'));assert.ok(!desktop.includes('01-pulpit.png'));
});
