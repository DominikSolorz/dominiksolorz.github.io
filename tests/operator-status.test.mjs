import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {operatorStatus} from '../kamera/core/operator-status.mjs';
test('live transmission never implies active recording',()=>{
 assert.match(operatorStatus({isLive:true,recording:{status:'idle',freshness:'fresh'}}).text,/zapis nieaktywny/);
 assert.equal(operatorStatus({isLive:true}).severity,'neutral');
});
test('active recording requires fresh explicit telemetry',()=>{
 assert.equal(operatorStatus({isLive:true,recording:{status:'recording',freshness:'fresh'}}).severity,'active');
 assert.equal(operatorStatus({isLive:true,recording:{status:'recording',freshness:'stale'}}).severity,'neutral');
});
test('folder permission failure overrides live-recording indicator',()=>{
 const value=operatorStatus({isLive:true,recording:{status:'recording',freshness:'fresh'},storage:{status:'permission_required',freshness:'fresh'}});
 assert.equal(value.severity,'warning');assert.match(value.text,/folderu/);
});
test('missing video does not diagnose internet or cloud outage',()=>{
 assert.equal(operatorStatus({isLive:false}).text,'Brak transmisji');
});
test('waiting for scheduled recording is not a capture failure',()=>{
 const value=operatorStatus({isLive:true,recording:{status:'waiting',freshness:'fresh'}});
 assert.equal(value.severity,'neutral');assert.match(value.text,/harmonogram/);
});
test('operator header is hidden on the public and locked desktop screens',async()=>{
 const css=await readFile(new URL('../kamera/workspace-ui.css',import.meta.url),'utf8');
 assert.ok(css.includes('body.accessPending>.topbar'));
 assert.ok(css.includes('body:has(#publicHome:not([hidden]))>.topbar'));
});
