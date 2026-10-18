import test from 'node:test';
import assert from 'node:assert/strict';
import {oldRecordingPlan} from '../kamera/local-retention.mjs';
const now=new Date(2026,9,18,12).getTime();
const midnight=new Date(2026,9,18).getTime();
const old={name:'kamera-2026-10-17_12-00-00.mp4',start:midnight-7200000,end:midnight-3600000,size:100};
test('only finalized recordings before local midnight are selected',()=>{const p=oldRecordingPlan([old,{...old,name:'kamera-today.mp4',start:midnight,end:midnight+1000},{...old,name:'kamera-crossing.mp4',end:midnight},{...old,name:'kamera-active.mp4',recording:true}],now);assert.deepEqual(p.files,[old]);assert.equal(p.bytes,100);});
test('invalid metadata, traversal and duplicates are excluded',()=>{const p=oldRecordingPlan([old,old,{...old,name:'../kamera-private.mp4'},{...old,name:'document.txt'},{...old,name:'kamera-missing.mp4',end:undefined}],now);assert.equal(p.files.length,1);});
test('plan is a snapshot independent of subsequent metadata mutation',()=>{const item={...old},p=oldRecordingPlan([item],now);item.name='changed';assert.equal(p.files[0].name,old.name);});
