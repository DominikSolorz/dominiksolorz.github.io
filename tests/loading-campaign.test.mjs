import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('loading image is a small WebP from the design reference',async()=>{
 const file=await stat(new URL('kamera/assets/home-security-loading.webp',root));
 assert.ok(file.size>10000&&file.size<50000,'splash image must remain under 50 KB');
 const css=await read('kamera/loading-campaign.css');
 assert.match(css,/url\("assets\/home-security-loading\.webp"\)/);
 assert.match(css,/background-position:center 42%/);
 assert.doesNotMatch(css,/#app\b|#lock\b|\.pinCard\b|#video\b/);
});
test('loading art replaces only boot presentation, keeps PIN and camera safe',async()=>{
 const [panel,sw]=await Promise.all([read('kamera/panel.html'),read('kamera/sw.js')]);
 const css=panel.match(/<template id="panelStyles">([\s\S]*?)<\/template>/)?.[1];
 assert.ok(css,'panel stylesheet template still exists');
 const names=[...css.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(names.at(-1),'operator-layout.css?v=3','operator stylesheet must remain last');
 assert.equal(names.at(-2),'loading-campaign.css?v=1','loading art comes before operator stylesheet');
 assert.ok(sw.includes('./loading-campaign.css?v=1'));
 assert.ok(sw.includes('./assets/home-security-loading.webp'));
 for(const id of ['boot','bootText','bootProgress','bootCountdown','bootStep','bootRetry','lock','app','ctrlStart','ctrlStop','video']){
   assert.ok(panel.includes('id="'+id+'"'),'retained existing element: '+id);
 }
 assert.match(panel,/const remaining = Math\.max\(0, 700 - \(performance\.now\(\) - started\)\)/,
  'normal boot finishes quickly without an 8-second artificial wait');
 assert.match(panel,/setTimeout\(\(\) => \{[\s\S]*?\}, 7100\)/,
  'existing secure fallback stays below 8 seconds');
 assert.match(panel,/await new Promise\(resolve => setTimeout\(resolve, 220\)\)/);
});
