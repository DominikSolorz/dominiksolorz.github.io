import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';

const base=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,base),'utf8');

test('phone homepage has no timed slideshow; slideshow assets stay public-only and inert',async()=>{
 const [page,alias,script,css]=await Promise.all([
  read('kamera/index.html'),read('kamera/o-systemie.html'),read('kamera/mobile-app-splash.js'),read('kamera/mobile-app-splash.css')
 ]);
 for(const html of [page,alias]){
  assert.ok(html.includes('mobile-app-splash.css?v=4'));
  assert.ok(!html.includes('hsMobileLaunch")'),'no inline start guard turns the slideshow on');
  assert.ok(!html.includes('30000'),'no 30-second safety timer on the homepage');
 }
 // mobile-app-splash.js exits at once unless hsMobileLaunch is present, so the page is never covered.
 assert.ok(script.includes("if (!root.classList.contains('hsMobileLaunch')) return;"));
 assert.doesNotMatch(css,/#lock\b|#app\b|#video\b/,'advertising CSS is public-only');
});

test('splash script never runs on desktop, Windows or account routes',async()=>{
 const script=await read('kamera/mobile-app-splash.js');
 const run=cls=>{const calls=[];vm.runInNewContext(script,{document:{documentElement:{classList:{contains:x=>cls.has(x),remove:()=>calls.push('remove')}},getElementById:()=>{calls.push('splash');return null;}},performance:{now:()=>0},window:{},setTimeout:()=>calls.push('timer')});return calls;};
 assert.deepEqual(run(new Set()),[],'without hsMobileLaunch the script does nothing');
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
 assert.ok(sw.includes('kamera-domowa-shell-v289'));
 assert.ok(app.includes('SERVICE_WORKER_BUILD = "289"'));
 assert.ok(sw.includes('./mobile-app-splash.css?v=4')&&sw.includes('./mobile-app-splash.js?v=3'));
 const manifest=JSON.parse(manifestStr);
 assert.equal(manifest.start_url,'./index.html?app=mobile-home');
 for(const shortcut of manifest.shortcuts)assert.match(shortcut.url,/^\.\x2fpanel\.html\?panel=owner/);
 for(const id of ['authDialog','lock','app','ctrlStart','ctrlStop','video']){
  assert.ok(panel.includes('id="'+id+'"'),id+' must be retained in protected panel');
 }
 assert.ok(!panel.includes('id="hsMobileSplash"'),'ads must not cover camera or PIN screens');
});
