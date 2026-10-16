import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = name => readFile(new URL('../kamera/'+name,import.meta.url),'utf8');
test('workspace stylesheet loads after legacy styles and is cached',async()=>{
 const [html,sw,css]=await Promise.all(['index.html','sw.js','workspace-ui.css'].map(read));
 assert.ok(html.indexOf('workspace-ui.css?v=1')>html.indexOf('style.css?v='));
 assert.ok(sw.includes('workspace-ui.css?v=1'));assert.ok(css.includes(':focus-visible'));
 assert.ok(css.includes('@media(max-width:600px)'));
});
test('events navigation reuses actual card rather than copying event data',async()=>{
 const desktop=await read('desktop.js');
 assert.ok(desktop.includes('data-desktop-view="events"'));
 assert.ok(desktop.includes('(view === "events" ? eventsScreen : eventsDrawer).append(eventCard)'));
 assert.ok(!desktop.includes('eventCard.cloneNode'));
 const render=desktop.slice(desktop.indexOf('const openExistingView'),desktop.indexOf('const sync ='));
 assert.ok(!/getTracks|\.stop\(|srcObject\s*=|sender\./.test(render));
});
test('original DS asset remains the application brand',async()=>{
 const desktop=await read('desktop.js');
 assert.ok(desktop.includes('src="assets/ds-logo.jpg"'));assert.ok(!desktop.includes('01-pulpit.png'));
});
