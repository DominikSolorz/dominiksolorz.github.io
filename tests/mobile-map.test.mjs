import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildNameQuery,mergePlaces,brandId,logoUrl,parseLogos,walkingMinutes,nearestResults,searchViewbox,buildPlacesQuery,describeLocationError,parsePlaces,parseGeocode,placeSearchUrl,directionsUrl,formatDistance,validCoordinates} from '../kamera/mobile-map.mjs';
import {panelStylesheet,panelSection} from './helpers/panel-css.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('coordinates are validated',()=>{
 assert.ok(validCoordinates(52.2,21));
 for(const [a,b] of [[NaN,1],[1,Infinity],[91,0],[0,181],['52','21'],[undefined,undefined]])assert.equal(validCoordinates(a,b),false);
});

test('location errors have specific Polish messages',()=>{
 assert.match(describeLocationError({code:1}),/zgody/);
 assert.match(describeLocationError({code:2}),/ustalić/);
 assert.match(describeLocationError({code:3}),/długo/);
 assert.match(describeLocationError(),/niedostępna/);
});

test('location is requested only after confirmation, tracked only while the map is open and never stored or sent to HOME SECURITY',async()=>{
 const src=await read('kamera/mobile-map.mjs');
 assert.ok(src.indexOf('getCurrentPosition')>src.indexOf("confirm.addEventListener('click'"),'geolocation only inside the confirm handler');
 assert.equal((src.match(/getCurrentPosition/g)||[]).length,1);
 assert.equal((src.match(/watchPosition/g)||[]).length,1);
 assert.ok(src.includes('clearWatch'),'tracking stops when the map closes');
 assert.ok(!/localStorage|sessionStorage|XMLHttpRequest|sendBeacon|indexedDB|supabase/.test(src));
 const urls=[...src.matchAll(/request\(current, ([^,]+),/g)].map(m=>m[1]);
 assert.equal((src.match(/\bfetch\(/g)||[]).length,1,'single outgoing helper');
 assert.ok(urls.includes('OVERPASS_URL')&&urls.some(f=>f.includes('NOMINATIM_URL')));
 assert.ok(src.includes("credentials: 'omit'"));
 const hosts=[...src.replace(/\/\/ .*$/gm,'').matchAll(/https:\/\/([a-z.-]+)/g)].map(m=>m[1]);
 assert.deepEqual([...new Set(hosts)].sort(),['commons.wikimedia.org','nominatim.openstreetmap.org','overpass-api.de','overpass.kumi.systems','tile.openstreetmap.org','www.google.com','www.wikidata.org']);
});

test('places query covers businesses and institutions inside the visible box',()=>{
 const q=buildPlacesQuery({south:52.2,west:21,north:52.3,east:21.1});
 for(const key of ['shop','amenity','office','tourism','craft','healthcare'])assert.ok(q.includes(`nwr[${key}][name](52.200000,21.000000,52.300000,21.100000)`));
 assert.match(q,/out center 80;$/);
});

test('places are parsed with street address, sorted by distance and unnamed ones dropped',()=>{
 const data={elements:[
  {lat:52.2310,lon:21.0122,tags:{name:'Dalsza apteka',amenity:'pharmacy','addr:street':'Marszałkowska','addr:housenumber':'12','addr:city':'Warszawa','addr:postcode':'00-001'}},
  {lat:52.2298,lon:21.0123,tags:{name:'Bliski sklep',shop:'convenience'}},
  {lat:52.23,lon:21.01,tags:{shop:'convenience'}},
  {center:{lat:52.2299,lon:21.0125},tags:{name:' Biuro ',office:'company'}},
  {lat:'x',lon:1,tags:{name:'Zły'}}]};
 const places=parsePlaces(data,{lat:52.2297,lon:21.0122});
 assert.deepEqual(places.map(p=>p.name),['Bliski sklep','Biuro','Dalsza apteka']);
 assert.equal(places[2].kind,'Apteka');
 assert.equal(places[2].address,'Marszałkowska 12, 00-001 Warszawa');
 assert.equal(places[0].kind,'Sklep');
 assert.deepEqual(parsePlaces(null,null),[]);
});

test('geocoding results give name, street and number',()=>{
 const found=parseGeocode([{lat:'52.2',lon:'21.0',name:'Kawiarnia X',type:'cafe',display_name:'Kawiarnia X, Złota 5, Warszawa',address:{road:'Złota',house_number:'5',postcode:'00-120',city:'Warszawa'}},{lat:'bad',lon:'1'}],{lat:52.2,lon:21});
 assert.equal(found.length,1);
 assert.equal(found[0].name,'Kawiarnia X');
 assert.equal(found[0].address,'Złota 5, 00-120 Warszawa');
 assert.deepEqual(parseGeocode(undefined,null),[]);
});

test('navigation and photo links open Google Maps with the place only',()=>{
 const place={name:'Żabka & Co',lat:52.2,lon:21};
 assert.match(placeSearchUrl(place),/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=%C5%BBabka%20%26%20Co/);
 assert.equal(directionsUrl(place),'https://www.google.com/maps/dir/?api=1&destination=52.200000,21.000000&travelmode=walking');
 assert.equal(formatDistance(450),'450 m');assert.equal(formatDistance(1250),'1,3 km');
});

test('Leaflet is served from the same origin and the panel mounts the map',async()=>{
 const [mobile,sw,panel]=await Promise.all(['kamera/mobile.js','kamera/sw.js','kamera/panel.html'].map(read));
 for(const f of ['leaflet.js','leaflet.css','LICENSE','images/marker-icon.png'])await readFile(new URL('../kamera/vendor/leaflet/'+f,import.meta.url));
 assert.ok(mobile.includes('./mobile-map.mjs?v=7')&&mobile.includes('mountLocationMap()'));
 assert.ok(sw.includes('./mobile-map.mjs?v=7'));
 assert.ok(panel.includes('mobile.js?v=51')&&sw.includes('./mobile.js?v=51'));
});

test('search prefers the surroundings and drops far-away name matches',()=>{
 const vb=searchViewbox({lat:52.23,lng:21.01}).split(',').map(Number);
 assert.ok(vb[0]<21.01&&vb[2]>21.01&&vb[1]>52.23&&vb[3]<52.23);
 const out=nearestResults([{name:'Odesa',distance:1100000},{name:'Warszawa',distance:900},{name:'Kijów',distance:690000}]);
 assert.deepEqual(out.map(p=>p.name),['Warszawa']);
 const far=nearestResults([{name:'Kraków A',distance:250000},{name:'Kraków B',distance:260000}]);
 assert.equal(far.length,2,'a single distant city is still found');
 assert.equal(nearestResults([{name:'x',distance:null},{name:'y',distance:null}]).length,2);
});

test('map list and close button stay visible on a full-screen phone map',async()=>{
 const css=await panelSection('mobile-app-look.css'), src=await read('kamera/mobile-map.mjs');
 assert.match(css,/\.mobileMapDialog\[open\]:has\(\.mobileMapCanvas:not\(\[hidden\]\)\)\{display:flex;flex-direction:column/);
 assert.match(css,/\.mobileMapCanvas\{flex:1 1 auto/);
 assert.match(src,/ResizeObserver\(\(\) => map\?\.invalidateSize\(\)\)/);
 assert.match(src,/mine !== query/);
});

test('chain results show a brand logo from Wikimedia Commons and walking time, sending only the brand id',async()=>{
 assert.equal(brandId('Q857182'),'Q857182');assert.equal(brandId('Q1; drop'),'');assert.equal(brandId(undefined),'');
 assert.deepEqual(parseLogos({entities:{Q857182:{claims:{P154:[{mainsnak:{datavalue:{value:'2016 Logo Biedronki.jpg'}}}]}},Q2:{claims:{}}}}),{Q857182:'2016 Logo Biedronki.jpg'});
 assert.equal(logoUrl('2016 Logo Biedronki.jpg'),'https://commons.wikimedia.org/wiki/Special:FilePath/2016_Logo_Biedronki.jpg?width=96');
 assert.equal(walkingMinutes(400),5);assert.equal(walkingMinutes(10),1);
 const g=parseGeocode([{lat:'52.2',lon:'21',name:'Biedronka',type:'supermarket',extratags:{'brand:wikidata':'Q857182'}}],{lat:52.2,lon:21});
 assert.equal(g[0].brand,'Q857182');
 const src=await read('kamera/mobile-map.mjs');
 assert.match(src,/bounded: '1'/);assert.match(src,/extratags: '1'/);
 assert.match(src,/min pieszo/);
 assert.ok(!/WIKIDATA_URL[^\n]*(lat|lon|here)/.test(src),'logo lookup never carries the position');
});

test('chain name search looks nearby by name or brand and merges duplicates',()=>{
 const q=buildNameQuery('Żabka"]; out;',{lat:52.2297,lng:21.0122});
 assert.ok(q.includes('nwr["name"~"Żabka out",i](around:5000,52.229700,21.012200)'));
 assert.ok(q.includes('nwr["brand"~'));assert.ok(!q.includes('"];'),'no query injection');
 assert.equal(buildNameQuery('a',{lat:52,lng:21}),'');
 const m=mergePlaces([{name:'Biedronka',lat:52.2,lon:21,address:'',brand:''}],[{name:'biedronka',lat:52.20001,lon:21,address:'Prosta 1',brand:'Q857182'},{name:'Biedronka',lat:52.21,lon:21}]);
 assert.equal(m.length,2);assert.equal(m[0].brand,'Q857182');assert.equal(m[0].address,'Prosta 1');
});

test('Windows panel opens the same consent-first map; WebView2 grants location only to the official site',async()=>{
 const [desktop,program,css]=await Promise.all([read('kamera/desktop.js'),read('desktop-client/Program.cs'),panelSection('operator-layout.css')]);
 assert.match(desktop,/import \{ mountLocationMap \} from "\.\/mobile-map\.mjs\?v=7"/);
 assert.equal((desktop.match(/mountLocationMap\(\)/g)||[]).length,1,'map mounted once');
 assert.match(program,/string\.Equals\(permissionUri\.Host, PublicHost[\s\S]{0,200}CoreWebView2PermissionKind\.Geolocation/);
 assert.match(css,/\.desktopSidebar \.mobileMapOpen\{/);
});
