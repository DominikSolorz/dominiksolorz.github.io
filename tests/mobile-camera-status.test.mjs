import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileCameraStatus} from '../kamera/mobile-camera-status.mjs';
test('mobile preview distinguishes a responding host from received video',()=>{
 assert.equal(mobileCameraStatus({connected:true,playing:false}).state,'waiting');
 assert.equal(mobileCameraStatus({connected:true,playing:true,width:1920,height:1080}).title,'Obraz na żywo');
 assert.equal(mobileCameraStatus({connected:false,playing:true}).state,'offline');
});
test('mobile preview describes cropping and does not claim a recording was saved',()=>{
 const state=mobileCameraStatus({connected:true,playing:true,width:640,height:480,fit:'cover'});
 assert.equal(state.dimensions,'640 × 480');assert.match(state.detail,/przycina brzegi/);
 assert.doesNotMatch(state.detail,/zapisano|nagrywanie działa/i);
});
