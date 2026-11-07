import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localPlaybackTimestamp,completedRecordingAt,nextCompletedRecording,seekLocalPlayback} from '../kamera/core/dvr-navigation.mjs';

test('time search is actual local wall clock, with seconds and input validation',()=>{
 const at=localPlaybackTimestamp('2026-11-07','05:10:09');
 const d=new Date(at);
 assert.deepEqual([d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds()],[2026,11,7,5,10,9]);
 assert.equal(localPlaybackTimestamp('2026-11-07','05:10'),localPlaybackTimestamp('2026-11-07','05:10:00'));
 for(const [day,time] of [['2026-02-30','12:00'],['2026-11-07','24:00'],['2026-11-07','10:61:00'],['2026-11-07','10:00:80'],['2026-11-07','hello'],['abc','12:00']])
  assert.throws(()=>localPlaybackTimestamp(day,time),RangeError);
});

test('seeking only uses recorded indexed segments, never a still-writing file or a gap',()=>{
 const start=Date.now()-3*600000;
 const files=[
  {name:'old.mp4',start,end:start+600000,local:true},
  {name:'writing.mp4',start:start+600000,end:start+1200000,recording:true},
  {name:'later.mp4',start:start+1800000,end:start+2400000,local:true}
 ];
 assert.equal(completedRecordingAt(files,start+500).name,'old.mp4');
 assert.equal(completedRecordingAt(files,start+600000),null);
 assert.equal(completedRecordingAt(files,start+1200000),null);
 assert.equal(nextCompletedRecording(files,start+1200000)?.name,'later.mp4');
 assert.equal(nextCompletedRecording(files,start+1200000,1000),null);
 assert.equal(completedRecordingAt(files,NaN),null);
 assert.equal(nextCompletedRecording(files,NaN),null);
});

test('frame navigation does not claim forensic precision and cannot seek unknown duration',()=>{
 const video={readyState:4,duration:60,currentTime:9.5,paused:false,pause(){this.paused=true;}};
 assert.equal(seekLocalPlayback(video,-1/25),9.46);
 assert.equal(video.currentTime,9.46);
 assert.equal(video.paused,true);
 assert.equal(seekLocalPlayback(video,100),60);
 assert.equal(seekLocalPlayback(video,-100),0);
 video.duration=Infinity;
 assert.equal(seekLocalPlayback(video,1),null);
 video.duration=60;video.readyState=0;
 assert.equal(seekLocalPlayback(video,1),null);
});

test('DVR controls are attached to the real file player, not to a decorative demo',async()=>{
 const dvr=await readFile(new URL('../kamera/dvr-ui.js',import.meta.url),'utf8');
 const nav=await readFile(new URL('../kamera/core/dvr-navigation.mjs',import.meta.url),'utf8');
 assert.match(dvr,/dvrPrecisionControls/);
 for(const label of ['5 min temu','10 min temu','− 1 s','+ 1 s','− 1 h','+ 1 h','Pokaż godzinę','klatka ≈'])assert.ok(dvr.includes(label),label);
 assert.match(dvr,/localPlaybackTimestamp\(day,clockInput\.value\)/);
 assert.match(dvr,/await setDay\(targetDay,true\)/);
 assert.match(dvr,/!playing\?\.local/);
 assert.match(dvr,/await play\(f,t-f.start\)/);
 assert.match(dvr,/const \{ blob: raw \} = await client\.get/);
 assert.match(dvr,/iframe/);
 assert.match(nav,/NEVER certified forensic frame accuracy/);
 assert.doesNotMatch(dvr,/setInterval\(\(\)=>\{.*currentTime\+=/);
});
