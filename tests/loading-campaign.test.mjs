import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('campaign artwork belongs to the mobile public homepage, not the login/PIN boot',async()=>{
 const [publicHome,panel,sw,source,visualScript]=await Promise.all([
  read('kamera/index.html'),read('kamera/panel.html'),read('kamera/sw.js'),
  read('scripts/build-marketing.mjs'),read('kamera/mobile-app-splash.js')
 ]);
 const image=await stat(new URL('kamera/assets/home-security-loading.webp',root));
 assert.ok(image.size>10000&&image.size<50000,'mobile advertising image remains lightweight');
 assert.ok(publicHome.includes('id="hsMobileSplash"'));
 assert.ok(publicHome.includes('data-src="assets/home-security-loading.webp"'));
 assert.ok(publicHome.includes('setTimeout(()=>document.documentElement.classList.remove("hsMobileLaunch"),30000)'));
 assert.ok(source.includes('const mobileSplashHead'));
 assert.ok(visualScript.includes('after(30000, finish)'));
 const styles=panel.match(/<template id="panelStyles">([\s\S]*?)<\/template>/)?.[1];
 assert.ok(styles,'secure panel stylesheet template must remain present');
 const loaded=[...styles.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(loaded.at(-1),'operator-layout.css?v=3','owner stylesheet remains last');
 assert.ok(!loaded.some(x=>x.includes('loading-campaign.css')),'no promotional artwork after tapping login');
 assert.ok(!sw.includes('./loading-campaign.css?v=1'),'PWA must not preload the unused post-login campaign CSS');
 assert.ok(sw.includes('./assets/home-security-loading.webp'),'mobile public homepage still caches the campaign graphic');
});

test('phone login proceeds to PIN without a second splash, retaining retry on real startup errors',async()=>{
 const panel=await read('kamera/panel.html');
 for(const id of ['boot','bootText','bootProgress','bootCountdown','bootStep','bootRetry','lock','app','ctrlStart','ctrlStop','video'])
  assert.ok(panel.includes('id="'+id+'"'),'preserved owner panel element '+id);
 assert.ok(panel.includes('const mobileLogin = /Android|iPhone|iPad|iPod|Mobile|CriOS/i'));
 assert.ok(panel.includes('boot.hidden = mobileLogin;'),'mobile login does not open promotional/boot screen');
 assert.ok(panel.includes('if (!mobileLogin) requestAnimationFrame(paint);'));
 assert.ok(panel.includes('if (mobileLogin) boot.hidden = false;'),'failure still reveals the technical status');
 assert.match(panel,/const showRetry = \(\) => \{\s*boot\.hidden = false;[\s\S]*?retry\.hidden = false;/);
 assert.match(panel,/const remaining = Math\.max\(0, 700 - \(performance\.now\(\) - started\)\)/);
 assert.match(panel,/setTimeout\(\(\) => \{[\s\S]*?\}, 7100\)/);
 assert.match(panel,/window\.__finishSecureBoot = async \(\) =>/);
 const sw=await read('kamera/sw.js'),app=await read('kamera/app.js');
 assert.ok(sw.includes('kamera-domowa-shell-v190'));
 assert.ok(app.includes('SERVICE_WORKER_BUILD = "190"'));
});
