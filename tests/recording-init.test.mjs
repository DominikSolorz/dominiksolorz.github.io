import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRecordingVideo,recorderActuallyRunning,waitForRecorderData} from '../kamera/recording-init.mjs';
class Video extends EventTarget{readyState=0;srcObject=null;play(){this.readyState=1;this.dispatchEvent(new Event('loadedmetadata'));return Promise.resolve();}}
test('binds metadata before source/play and accepts synchronous metadata',async()=>{const v=new Video(),s={};await prepareRecordingVideo(v,s);assert.equal(v.srcObject,s);});
test('already prepared media does not wait for a second metadata event',async()=>{const v=new Video();v.readyState=2;v.play=()=>Promise.resolve();await prepareRecordingVideo(v,{});});
test('missing metadata/play cannot hang recording initialization',async()=>{const v=new Video();v.play=()=>new Promise(()=>{});await assert.rejects(prepareRecordingVideo(v,{},{timeoutMs:10}),/Przekroczono/);});
test('play errors reject and allow a later retry',async()=>{const v=new Video();v.play=()=>Promise.reject(new Error('blocked'));await assert.rejects(prepareRecordingVideo(v,{}),/blocked/);v.play=Video.prototype.play;await prepareRecordingVideo(v,{});});
test('a preparing or inactive recorder never reports recording',()=>{assert.equal(recorderActuallyRunning(null),false);assert.equal(recorderActuallyRunning({state:'inactive'}),false);assert.equal(recorderActuallyRunning({state:'paused'}),false);assert.equal(recorderActuallyRunning({state:'recording'}),true);});

test('a recording state without bytes is rejected',async()=>{const r=new EventTarget();await assert.rejects(waitForRecorderData(r,{timeoutMs:10}),/nie przekazał/);});
test('first nonempty chunk confirms the encoder',async()=>{const r=new EventTarget();const ready=waitForRecorderData(r);const e=new Event('dataavailable');e.data=new Blob(['encoded']);r.dispatchEvent(e);await ready;});
