import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMapUrl,describeLocationError} from '../kamera/mobile-map.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('map URL is built only from valid coordinates',()=>{
 assert.match(buildMapUrl(52.2297,21.0122),/^https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?bbox=.*&marker=52\.229700%2C21\.012200$/);
 for(const [a,b] of [[NaN,1],[1,Infinity],[91,0],[0,181],['52','21'],[undefined,undefined]])assert.equal(buildMapUrl(a,b),null);
});

test('location errors have specific Polish messages',()=>{
 assert.match(describeLocationError({code:1}),/zgody/);
 assert.match(describeLocationError({code:2}),/ustalić/);
 assert.match(describeLocationError({code:3}),/długo/);
 assert.match(describeLocationError(),/niedostępna/);
});

test('location is requested only after confirmation and never stored or sent to the server',async()=>{
 const src=await read('kamera/mobile-map.mjs');
 const call=src.indexOf('getCurrentPosition');
 assert.ok(call>src.indexOf("confirm.addEventListener('click'"),'geolocation only inside the confirm handler');
 assert.equal((src.match(/getCurrentPosition/g)||[]).length,1);
 assert.ok(!/watchPosition|localStorage|sessionStorage|fetch\(|XMLHttpRequest|sendBeacon|indexedDB/.test(src));
 assert.ok(src.includes('maximumAge: 0'));
 assert.ok(src.includes('referrerPolicy'));
});

test('mobile panel mounts the map and the service worker caches it',async()=>{
 const [mobile,sw,panel]=await Promise.all(['kamera/mobile.js','kamera/sw.js','kamera/panel.html'].map(read));
 assert.ok(mobile.includes('./mobile-map.mjs?v=1')&&mobile.includes('mountLocationMap()'));
 assert.ok(sw.includes('./mobile-map.mjs?v=1'));
 assert.ok(panel.includes('mobile.js?v=34')&&sw.includes('./mobile.js?v=34'));
});
