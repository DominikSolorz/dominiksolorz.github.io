import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';

const base=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,base),'utf8');

test('public Chrome on a phone shows 30s slideshow on every homepage reload; desktop and account routes do not',async()=>{
 const [page,alias,builder,script,css]=await Promise.all([
  read('kamera/index.html'),read('kamera/o-systemie.html'),
  read('scripts/build-marketing.mjs'),read('kamera/mobile-app-splash.js'),
  read('kamera/mobile-app-splash.css')
 ]);
 for(const html of [page,alias]){
  assert.ok(html.includes('id="hsMobileSplash"'),'missing promo overlay');
  assert.ok(html.includes('mobile-app-splash.js?v=3'),'slideshow script missing');
  assert.ok(html.includes('mobile-app-splash.css?v=3'),'slideshow CSS missing');
  assert.ok(html.includes('setTimeout(()=>document.documentElement.classList.remove("hsMobileLaunch"),30000)'),
    'safety limit must remain at 30 seconds');
  assert.ok(!html.includes('hs-mobile-intro-seen-v1'),'advertising must not be skipped after reload');
  assert.ok(html.includes('if(!phone)return;'),'desktop must skip the ad');
  assert.ok(html.includes('q.has("auth")')&&html.includes('q.has("code")'),
    'do not cover authentication/OAuth callbacks');
 }
 assert.ok(builder.includes('const mobileSplashBody'),'builder must generate the slideshow on release');
 assert.ok(script.includes('after(10000, () => activate(1))'));
 assert.ok(script.includes('after(20000, () => activate(2))'));
 assert.ok(script.includes('after(30000, finish)'));
 assert.ok(script.includes("addEventListener('click', finish)"));
 assert.ok(css.includes('aspect-ratio:16/9'));
 assert.ok(css.includes('object-fit:contain'),'image content must not be cropped');
 assert.doesNotMatch(css,/#lock\b|#app\b|#video\b/,'advertising CSS is public-only');
});

test('phone-ad decision runs on each refresh and does not run on desktop or sensitive redirects',async()=>{
 const html=await read('kamera/index.html');
 const inline=html.match(/<link rel="stylesheet" href="mobile-app-splash.css\?v=3"><script>([\s\S]*?)<\/script><script defer src="mobile-app-splash.js\?v=3"/)?.[1];
 assert.ok(inline,'cannot find synchronous mobile start guard');
 const run=({ua='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',url='https://dominiksolorz.github.io/kamera/',touch=5}={})=>{
  const classes=new Set(),timers=[];
  const location=new URL(url);
  const context={location,URLSearchParams,navigator:{userAgent:ua,maxTouchPoints:touch},
   matchMedia:()=>({matches:false}),performance:{now:()=>0},
   document:{documentElement:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}},
   window:{},setTimeout:(cb,ms)=>{timers.push(ms);return 1;}};
  vm.runInNewContext(inline,context);
  return {classes,timers};
 };
 for(let i=0;i<2;i++){
  const r=run();
  assert.ok(r.classes.has('hsMobileLaunch'),'mobile Chrome refresh '+i+' must show ad');
  assert.equal(r.timers.length,1);
  assert.equal(r.timers[0],30000);
 }
 assert.equal(run({ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130',touch:0}).classes.size,0);
 assert.ok(run({ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130',touch:0,url:'https://dominiksolorz.github.io/kamera/?layout=manual&ui=phone'}).classes.has('hsMobileWelcome'),'an explicit mobile layout also works without an Android device');
 for(const suffix of ['?auth=login','?code=confirm','?panel=owner','?odbiorca=cam-'+'a'.repeat(32)]){
  assert.equal(run({url:'https://dominiksolorz.github.io/kamera/'+suffix}).classes.size,0,suffix);
 }
});

test('three campaign images are small local WebP assets, PWA keeps PIN and shortcuts private',async()=>{
 const paths=['home-security-loading.webp','home-security-ad-02.webp','home-security-ad-03.webp'];
 const [page,sw,app,panel,manifestStr]=await Promise.all([
  read('kamera/index.html'),read('kamera/sw.js'),read('kamera/app.js'),
  read('kamera/panel.html'),read('kamera/manifest.webmanifest')
 ]);
 for(const path of paths){
  const info=await stat(new URL('kamera/assets/'+path,base));
  assert.ok(info.size>10000&&info.size<100000,'bad promo image '+path);
  assert.ok(page.includes('data-src="assets/'+path+'"'),'missing slide '+path);
  assert.ok(sw.includes('./assets/'+path),'PWA offline promo asset missing '+path);
 }
 assert.ok(sw.includes('kamera-domowa-shell-v193'));
 assert.ok(app.includes('SERVICE_WORKER_BUILD = "193"'));
 assert.ok(sw.includes('./mobile-app-splash.css?v=3')&&sw.includes('./mobile-app-splash.js?v=3'));
 const manifest=JSON.parse(manifestStr);
 assert.equal(manifest.start_url,'./index.html?app=mobile-home');
 for(const shortcut of manifest.shortcuts)assert.match(shortcut.url,/^\.\x2fpanel\.html\?panel=owner/);
 for(const id of ['authDialog','lock','app','ctrlStart','ctrlStop','video']){
  assert.ok(panel.includes('id="'+id+'"'),id+' must be retained in protected panel');
 }
 assert.ok(!panel.includes('id="hsMobileSplash"'),'ads must not cover camera or PIN screens');
});
