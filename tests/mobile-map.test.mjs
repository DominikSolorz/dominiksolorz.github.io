import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMapUrl,describeLocationError,buildShopsQuery,parseShops,placeSearchUrl,formatDistance} from '../kamera/mobile-map.mjs';

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
 assert.ok(!/watchPosition|localStorage|sessionStorage|XMLHttpRequest|sendBeacon|indexedDB/.test(src));
 assert.equal((src.match(/fetch\(/g)||[]).length,1);assert.ok(src.includes("fetch(OVERPASS_URL")&&src.includes('overpass-api.de'));
 assert.ok(src.includes('maximumAge: 0'));
 assert.ok(src.includes('referrerPolicy'));
});

test('mobile panel mounts the map and the service worker caches it',async()=>{
 const [mobile,sw,panel]=await Promise.all(['kamera/mobile.js','kamera/sw.js','kamera/panel.html'].map(read));
 assert.ok(mobile.includes('./mobile-map.mjs?v=2')&&mobile.includes('mountLocationMap()'));
 assert.ok(sw.includes('./mobile-map.mjs?v=2'));
 assert.ok(panel.includes('mobile.js?v=36')&&sw.includes('./mobile.js?v=36'));
});

test('nearby shops are parsed, sorted by distance and linked to Google Maps',()=>{
 assert.match(buildShopsQuery(52.2297,21.0122),/around:800,52\.229700,21\.012200/);
 const data={elements:[{lat:52.2310,lon:21.0122,tags:{name:'Dalszy'}},{lat:52.2298,lon:21.0123,tags:{name:'Bliski'}},{lat:52.23,lon:21.01,tags:{}},{center:{lat:52.2299,lon:21.0125},tags:{name:' Budynek '}},{lat:'x',lon:1,tags:{name:'Zły'}}]};
 const shops=parseShops(data,52.2297,21.0122);
 assert.deepEqual(shops.map(s=>s.name),['Bliski','Budynek','Dalszy']);
 assert.ok(shops[0].distance<shops[2].distance);
 assert.deepEqual(parseShops(null,1,1),[]);
 assert.match(placeSearchUrl({name:'Żabka & Co',lat:52.2,lon:21}),/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=%C5%BBabka%20%26%20Co/);
 assert.equal(formatDistance(450),'450 m');assert.equal(formatDistance(1250),'1,3 km');
});
