import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,stat} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

// The phone homepage shows the real public page immediately. The timed 30-second splash and the
// welcome screen were removed (owner decision 11.11.2026): their markup stays in the HTML but no
// inline script adds hsMobileLaunch / hsMobileWelcome, so both remain hidden.
test('phone Chrome opens the real homepage immediately: no timed splash before the page or login',async()=>{
 const [homepage,alias,builder]=await Promise.all(['kamera/index.html','kamera/o-systemie.html','scripts/build-marketing.mjs'].map(read));
 for(const page of [homepage,alias]){
  const head=page.slice(0,page.indexOf('</head>'));
  assert.doesNotMatch(head,/classList\.add\("hsMobileLaunch"\)|classList\.add\("hsMobileWelcome"\)/,'no splash or welcome class is set on load');
  assert.doesNotMatch(head,/setTimeout\([^)]*30000/,'no 30-second wait before the homepage');
  assert.match(head,/mobile-app-splash\.css\?v=4/);
  assert.ok(page.includes('href="panel.html?auth=login'),'login stays one click away');
 }
 assert.doesNotMatch(builder,/classList\.add\("hsMobileLaunch"\)/,'generator must not bring the splash back');
});

test('three distinct images cycle at 0, 10 and 20 seconds; allow early skip and disappear after 30 seconds',async()=>{
 const js=await read('kamera/mobile-app-splash.js');
 const names=['home-security-loading.webp','home-security-ad-02.webp','home-security-ad-03.webp'];
 const delays=[],classes=new Set(['hsMobileLaunch']),states=[new Set(),new Set(),new Set()];
 const slides=names.map((src,i)=>({
   dataset:{src:'assets/'+src},classList:{toggle:(name,value)=>{if(value)states[i].add(name);else states[i].delete(name);}},
   setAttribute(){} }));
 const button={addEventListener:(_,fn)=>{button.skip=fn;}};
 const splash={querySelectorAll:()=>slides,querySelector:()=>button,hidden:false,setAttribute(){}};
 const context={window:{__hsMobileSplashStarted:1000,addEventListener(){}},document:{
 documentElement:{classList:{contains:n=>classes.has(n),remove:n=>classes.delete(n)}},
 getElementById:()=>splash},performance:{now:()=>1000},setTimeout:(fn,ms)=>{
 const timer={fn,ms};delays.push(timer);return timer;},clearTimeout:()=>{}};
 vm.runInNewContext(js,context);
 assert.deepEqual(delays.map(x=>x.ms),[10000,20000,30000]);
 assert.ok(states[0].has('is-active'));
 assert.ok(!states[1].has('is-active'));
 delays[0].fn();
 assert.ok(states[1].has('is-active'));
 delays[1].fn();
 assert.ok(states[2].has('is-active'));
 delays[2].fn();
 assert.equal(classes.has('hsMobileLaunch'),false);
 assert.equal(splash.hidden,true);
 assert.ok(typeof button.skip==='function');
});

test('PWA route, assets, and worker cache remain consistent without changing camera runtime',async()=>{
 const [manifest,bridge,sw,app,css,panel]=await Promise.all([
   read('kamera/manifest.webmanifest'),read('kamera/public-entry.js'),read('kamera/sw.js'),
   read('kamera/app.js'),read('kamera/mobile-app-splash.css'),read('kamera/panel.html')]);
 const m=JSON.parse(manifest);
 assert.equal(m.start_url,'./index.html?app=mobile-home');
 for(const item of m.shortcuts) assert.ok(item.url.startsWith('./panel.html?panel=owner'));
 assert.match(bridge,/params\.get\("app"\) === "mobile-home"/);
 assert.match(sw,/kamera-domowa-shell-v289/);
 assert.match(app,/SERVICE_WORKER_BUILD = "289"/);
 for(const asset of ['mobile-app-splash.css?v=4','mobile-app-splash.js?v=3',
   'home-security-loading.webp','home-security-ad-02.webp','home-security-ad-03.webp'])
   assert.ok(sw.includes(asset),'PWA precache missing '+asset);
 assert.ok(css.includes('aspect-ratio:16/9'));
 assert.ok(!css.includes('#app')&&!css.includes('#video'));
 assert.ok(panel.includes('id="lock"')&&panel.includes('id="authDialog"')&&panel.includes('id="video"'));
 for(const asset of ['home-security-loading.webp','home-security-ad-02.webp','home-security-ad-03.webp']){
   const file=await stat(new URL('kamera/assets/'+asset,root));
   assert.ok(file.size>10000 && file.size<100000,'fast mobile WebP image '+asset);
 }
});
