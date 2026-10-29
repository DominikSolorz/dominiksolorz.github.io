import test from 'node:test';
import assert from 'node:assert/strict';
import {closeRecordingFragment} from '../kamera/close-recording-fragment.mjs';
test('manual local save waits for the closed file without stopping live media or contacting Drive',async()=>{
 let saved=null,release;const pending=new Promise(resolve=>release=resolve);let completed=false,rotated=false;
 const result=closeRecordingFragment({current:()=>({}),ready:()=>true,receipt:()=>saved,
 rotate:()=>{rotated=true;return pending;},flush:async task=>{await task;saved={name:'camera.mp4',folder:'nagrania',bytes:12};},error:()=>''}).then(x=>{completed=true;return x;});
 assert.equal(rotated,true);assert.equal(completed,false);release();assert.equal((await result).bytes,12);
});
test('missing folder or stopped recorder cannot claim a successful write',async()=>{
 for(const [ready,current] of [[false,{}],[true,null]])await assert.rejects(closeRecordingFragment({ready:()=>ready,current:()=>current,rotate:()=>assert.fail('must not rotate')}));
});
test('previous receipt and a failed folder write cannot confirm the new segment',async()=>{
 const previous={bytes:10};
 for(const error of ['', 'Brak miejsca na dysku'])await assert.rejects(closeRecordingFragment({ready:()=>true,current:()=>({}),receipt:()=>previous,rotate:()=>Promise.resolve(),flush:async()=>{},error:()=>error}));
});
