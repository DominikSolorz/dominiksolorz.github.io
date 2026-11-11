import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountMobileCameraFrame} from '../kamera/mobile-camera-frame.mjs';
import {panelStylesheet,panelSection} from './helpers/panel-css.mjs';
const [viewerCss,frameCss,panelHtml,serviceWorker,appJs,mobileJs]=await Promise.all([
 panelSection('mobile-viewer.css'),
 panelSection('mobile-camera-frame.css'),
 readFile(new URL('../kamera/panel.html',import.meta.url),'utf8'),
 readFile(new URL('../kamera/sw.js',import.meta.url),'utf8'),
 readFile(new URL('../kamera/app.js',import.meta.url),'utf8'),
 readFile(new URL('../kamera/mobile.js',import.meta.url),'utf8')
]);
test('mobile frame follows actual source dimensions and orientation changes without touching media',()=>{
 const events=new Map(),properties=new Map();
 const stage={style:{setProperty:(k,v)=>properties.set(k,v)}};
 const video={videoWidth:1920,videoHeight:1080,addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)};
 const dispose=mountMobileCameraFrame(stage,video);assert.equal(properties.get('--mobile-camera-ratio'),'1920 / 1080');
 video.videoWidth=720;video.videoHeight=1280;events.get('resize')();assert.equal(properties.get('--mobile-camera-ratio'),'720 / 1280');
 video.videoWidth=0;events.get('loadedmetadata')();assert.equal(properties.get('--mobile-camera-ratio'),'720 / 1280');
 dispose();assert.equal(events.size,0);
});
test('short landscape enlarges the camera preview and preserves 48px navigation targets',()=>{
 const landscape=viewerCss.match(/@media\(orientation:landscape\) and \(max-height:650px\)\s*\{([\s\S]*?)\n\}/)?.[1];
 assert.ok(landscape);
 assert.match(landscape,/\.mobileBottomNav button\{[^}]*min-height:48px!important/);
 assert.match(landscape,/data-mobile-view="camera"\] #stage[^}]*height:max\(160px,calc\(100dvh - 250px - env\(safe-area-inset-bottom\)\)\)!important;min-height:160px/);
 assert.match(frameCss,/data-mobile-view="camera"\] #stage[^}]*height:max\(160px/);
});
test('mobile layout switch remains a 48px touch target and refreshed CSS is precached',()=>{
 assert.match(viewerCss,/mobileAppHeader #deviceLayoutBtn\{min-width:48px!important;min-height:48px!important\}/);
 const sheet=panelStylesheet(panelHtml);
 assert.match(panelHtml,/mobile\.js\?v=48/);
 const version=appJs.match(/const VERSION = "(\d+)"/)?.[1];
 assert.ok(version);
 assert.match(panelHtml,new RegExp('app\\.js\\?v='+version));
 const rev=appJs.match(/SERVICE_WORKER_BUILD = "(\d+)"/)?.[1];
 assert.ok(rev);
 assert.match(serviceWorker,new RegExp(`kamera-domowa-shell-v${rev}`));
 assert.ok(serviceWorker.includes('./'+sheet));
 assert.ok(serviceWorker.includes('./mobile.js?v=48'));
 assert.ok(serviceWorker.includes('./app.js?v='+version));
});
test('device layout button hides decorative square but keeps accessible layout selection',()=>{
 assert.match(frameCss,/mobileAppHeader #deviceLayoutBtn span\{display:none\}/);
 assert.match(frameCss,/mobileAppHeader #deviceLayoutBtn b\{display:block/);
 assert.match(mobileJs,/id="deviceLayoutBtn"/);
 assert.match(mobileJs,/byId\("deviceLayoutBtn"\)\?\.addEventListener\("click"/);
 assert.doesNotMatch(mobileJs,/querySelector\('b'\)\.textContent=platformName/);
 assert.match(mobileJs,/data-open-mobile-view="appearance"/);
});
test('mobile navigation opens camera only from an explicit camera view and starts at overview',()=>{
 assert.match(mobileJs,/data-open-mobile-view="home"/);
 assert.match(mobileJs,/data-open-mobile-view="camera"/);
 assert.match(mobileJs,/rememberedView === "camera" \? "home" : rememberedView/);
 assert.match(mobileJs,/Obraz nie włącza się sam po zalogowaniu/);
 assert.match(appJs,/if \(MOBILE_OWNER_APP\) \{\s*document\.addEventListener\("hs-mobile-view-change", event => \{\s*if \(event\.detail\?\.view === "camera"\) viewer\.start\(\);\s*else viewer\.stop\(\);/);
 assert.match(appJs,/else \{\s*viewer\.start\(\);\s*\}\s*\}/);
});
