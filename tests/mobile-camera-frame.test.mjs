import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountMobileCameraFrame} from '../kamera/mobile-camera-frame.mjs';
const viewerCss=await readFile(new URL('../kamera/mobile-viewer.css',import.meta.url),'utf8');
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
 assert.match(landscape,/height:max\(160px,calc\(100dvh - 250px - env\(safe-area-inset-bottom\)\)\)!important;min-height:160px/);
});
