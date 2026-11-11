import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {panelStylesheet,panelSection} from './helpers/panel-css.mjs';

const read=path=>readFile(new URL('../kamera/'+path,import.meta.url),'utf8');

test('premium owner theme matches HTML and service worker revisions',async()=>{
 const [html,sw]=await Promise.all(['panel.html','sw.js'].map(read));
 const style=await panelSection('interface-theme.css');
 assert.ok(sw.includes('./'+panelStylesheet(html)),'PWA cache must reference the panel stylesheet');
 assert.ok(style.includes('html.desktopMode:not(.policeCommand):not(.usMilitary)'));
 assert.ok(style.includes('html.mobileOwnerMode:not(.policeCommand):not(.usMilitary)'));
});

test('premium treatment preserves recorder safety cues and authentic camera frames',async()=>{
 const style=await panelSection('interface-theme.css');
 assert.ok(style.includes('#stage video { object-fit:contain; }'));
 assert.ok(style.includes('#ctrlStart'));
 assert.ok(style.includes('#ctrlStop'));
 // Effective desktop recorder cues (the same selector is redeclared in later sections; the
 // earlier #176a53/#44252e and #16735a values never applied and were removed from panel.css).
 const product=await panelSection('desktop-product.css'),operator=await panelSection('interface-concept.css');
 assert.match(product,/:not\(\.usMilitary\) #ctrlStart\s*\{[^}]*background:\s*#d91c40/);
 assert.match(operator,/:not\(\.usMilitary\) #ctrlStop\s*\{[^}]*background:\s*#592935/);
 assert.ok(style.includes('prefers-reduced-motion:reduce'));
 assert.ok(style.includes('html:not(.policeCommand):not(.usMilitary)'));
});
