import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../kamera/app.js',import.meta.url),'utf8');
test('sender cannot play microphone locally while remote viewer retains listening',()=>{
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{dataset:{},setAttribute(k,v){this[k]=v;}});return elements.get(id);};
 const sender={live:true},video={muted:false,volume:0.6};
 const context=vm.createContext({$,sender,video,listeningAvailable:true});
 const begin=app.indexOf('function paintListeningControls()');
 vm.runInContext(app.slice(begin,app.indexOf('$("soundBtn").addEventListener',begin))+'\nglobalThis.paint=paintListeningControls;',context);
 context.paint();
 assert.equal(video.muted,true);assert.equal($('soundBtn').disabled,true);assert.equal($('listenVolume').disabled,true);
 sender.live=false;video.muted=false;context.paint();
 assert.equal(video.muted,false);assert.equal($('soundBtn').disabled,false);assert.equal($('listenVolume').disabled,false);
 assert.equal($('soundBtn')['aria-pressed'],'true');
});
test('periodic sender version check never stops recording or navigates away',()=>{
 const check=app.slice(app.indexOf('  async function checkUpdate()'),app.indexOf('  // Powiadomienie oglądających'));
 assert.ok(check.includes('version.json'));
 for(const forbidden of ['archive.stop','releaseSenderLock','location.replace','archive.flush'])assert.ok(!check.includes(forbidden),forbidden);
});
