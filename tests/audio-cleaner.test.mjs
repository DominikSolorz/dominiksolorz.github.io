import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createCleanAudioStream } from '../kamera/audio-cleaner.mjs';

test('noise gate reduces stationary noise after the hold period but retains speech', () => {
  let Gate;
  const context = {
    AudioWorkletProcessor: class { constructor() { this.port = { onmessage: null }; } },
    registerProcessor(name, Class) { assert.equal(name, 'home-security-noise-gate'); Gate = Class; },
    sampleRate: 48000,
  };
  vm.runInNewContext(readFileSync(new URL('../kamera/noise-gate.worklet.js', import.meta.url), 'utf8'), context);
  const gate = new Gate();
  const input = [new Float32Array(128).fill(0.002)];
  const output = [new Float32Array(128)];
  for (let i = 0; i < 260; i++) gate.process([input], [output]);
  assert.ok(output[0][100] < 0.0006, 'steady low-level hiss should be attenuated');
  input[0].fill(0.09);
  for (let i = 0; i < 12; i++) gate.process([input], [output]);
  assert.ok(output[0][100] > 0.08, 'speech should promptly pass through');
  gate.port.onmessage({ data: { profile: 'environment' } });
  input[0].fill(0.002);
  gate.process([input], [output]);
  assert.ok(output[0][100] > 0.0019, 'environment mode must bypass gating');
});

test('audio processor degrades to the original microphone if unsupported', async () => {
  const audio = { readyState: 'live' };
  const source = { getAudioTracks: () => [audio], getVideoTracks: () => [] };
  const clean = await createCleanAudioStream(source, 'clean', {});
  assert.equal(clean.stream, source);
  assert.equal(clean.filtered, false);
  assert.equal(clean.sourceTrack, audio);
  clean.close();
  assert.equal(audio.readyState, 'live');
  await assert.rejects(() => createCleanAudioStream(source, 'wrong', {}));
});

test('noise reduction shares one output track and releases original microphone', async () => {
  const events = [];
  const rawAudio = { readyState: 'live', stop: () => events.push('raw-stopped') };
  const originalVideo = {};
  const outputTrack = { stop: () => events.push('processed-stopped') };
  class Media { constructor(tracks) { this.tracks=tracks; } getAudioTracks() {return this.tracks.filter(t => t === rawAudio || t === outputTrack);} getVideoTracks() {return this.tracks.filter(t => t === originalVideo);} }
  const node = () => ({connect() {},type:'',frequency:{setTargetAtTime() {}},gain:{value:0,setTargetAtTime() {}}});
  class Context {
    constructor(){ this.state='running';this.currentTime=0;this.audioWorklet={addModule:async()=>{}}; }
    createMediaStreamSource(){return node();}
    createBiquadFilter(){return node();}
    createGain(){return node();}
    createMediaStreamDestination(){return {stream:new Media([outputTrack])};}
    close(){events.push('context-closed');return Promise.resolve();}
  }
  class Worklet { constructor(){this.port={postMessage:()=>{},close:()=>events.push('port-closed')};} connect(){} }
  const source = new Media([rawAudio,originalVideo]);
  const pipeline=await createCleanAudioStream(source,'clean',{AudioContext:Context,AudioWorkletNode:Worklet,MediaStream:Media});
  assert.equal(pipeline.filtered,true);
  assert.equal(pipeline.stream.getAudioTracks()[0],outputTrack);
  assert.equal(pipeline.stream.getVideoTracks()[0],originalVideo);
  pipeline.setProfile('environment');
  pipeline.close();pipeline.close();
  assert.equal(events.filter(x=>x==='raw-stopped').length,1);
  assert.equal(events.filter(x=>x==='processed-stopped').length,1);
  assert.equal(events.filter(x=>x==='context-closed').length,1);
});
