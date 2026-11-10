import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,stat} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

function launch(html,{agent='Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',search='',hash='',touch=5,width=390}={}){
 const src=html.match(/<link rel="stylesheet" href="mobile-app-splash\.css\?v=3"><script>([\s\S]*?)<\/script><script defer src="mobile-app-splash\.js\?v=3"><\/script>/)?.[1];
 assert.ok(src,'mobile splash head must be included by the public page');
 const classes=new Set(),delays=[];
 const context={URLSearchParams,location:{search,hash},navigator:{userAgent:agent,maxTouchPoints:touch},
  document:{documentElement:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}},
  performance:{now:()=>1000},window:{},matchMedia:()=>({matches:width<=900}),
  setTimeout:(_,ms)=>{delays.push(ms);return delays.length;}};
 vm.runInNewContext(src,context);
 return {classes,delays};
}

test('phone Chrome shows 30-second advertising on EVERY homepage refresh, never desktop or account route',async()=>{
 const [homepage,alias]=await Promise.all(['kamera/index.html','kamera/o-systemie.html'].map(read));
 for(const page of [homepage,alias]){
  for(let i=0;i<2;i++){
   const x=launch(page);
   assert.ok(x.classes.has('hsMobileLaunch'),'Android phone must show splash on each page navigation');
   assert.deepEqual(x.delays,[30000],'full presentation lasts 30 seconds');
  }
  const ios=launch(page,{agent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
  assert.ok(ios.classes.has('hsMobileLaunch'));
  const desktop=launch(page,{agent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',touch:0,width:1440});
  assert.equal(desktop.classes.size,0,'desktop Chrome must not get a splash');
  for(const search of ['?auth=login','?auth=register','?auth=forgot','?panel=owner','?code=abcdef','?odbiorca=cam-'+'a'.repeat(32)])
   assert.equal(launch(page,{search}).classes.size,0,'no advertising before secure callback '+search);
  assert.ok(page.includes('id="hsMobileSplash"'));
  assert.equal((page.match(/class="hsMobileSplashImage/g)||[]).length,3);
 }
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
 assert.match(sw,/kamera-domowa-shell-v200/);
 assert.match(app,/SERVICE_WORKER_BUILD = "200"/);
 for(const asset of ['mobile-app-splash.css?v=3','mobile-app-splash.js?v=3',
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
