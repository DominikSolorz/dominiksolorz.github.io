import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWebUpdates} from '../kamera/core/web-updates.mjs';

test('browser without Service Worker can still detect new published UI and reload on click',async()=>{
 const calls=[],states=[];
 const updater=createWebUpdates({serviceWorker:null,build:'150',releaseVersion:'240',
  readRelease:async()=>{calls.push('manifest');return '241';},
  onState:s=>states.push(s),prepareReload:async()=>calls.push('prepared'),
  reload:()=>calls.push('reload')});
 await updater.check();
 assert.equal(updater.available,true);
 assert.equal(states.at(-1).status,'available');
 await updater.apply();
 assert.deepEqual(calls,['manifest','prepared','reload']);
 updater.dispose();
});

test('fallback updater never interrupts an active recording and resumes after it ends',async()=>{
 let recording=true;
 const calls=[],states=[];
 const updater=createWebUpdates({serviceWorker:null,build:'150',releaseVersion:'240',
  readRelease:async()=>241,onState:s=>states.push(s),
  prepareReload:async()=>calls.push('safe-save'),reload:()=>calls.push('reload'),
  canAutoApply:()=>!recording,autoApply:true});
 await updater.check();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(updater.available,true);
 assert.equal(states.at(-1).status,'waiting');
 assert.equal(calls.length,0);
 await updater.apply();assert.equal(calls.length,0);
 recording=false;updater.tryAutoApply();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(calls,['safe-save','reload']);
 updater.dispose();
});

test('offline and malformed fallback metadata must never say updated',async()=>{
 for(const input of [
  async()=>{throw Error('offline');},
  async()=>null,
  async()=>0,
  async()=>'-1',
  async()=> 'not a number'
 ]){
  let reloads=0;const states=[];
  const updater=createWebUpdates({serviceWorker:null,build:'150',releaseVersion:'240',
    readRelease:input,onState:s=>states.push(s),reload:()=>reloads++});
  await updater.check();
  assert.equal(updater.available,false);
  assert.equal(states.at(-1).status,'error');
  assert.equal(reloads,0);updater.dispose();
 }
});

test('fallback reports current and respects background throttle',async()=>{
 let reads=0;
 const states=[];let t=100000;
 const updater=createWebUpdates({serviceWorker:null,build:'150',releaseVersion:'240',
  readRelease:async()=>{reads++;return 240;},
  onState:s=>states.push(s),now:()=>t,reload:()=>{}});
 await updater.check({background:true});
 await updater.check({background:true});
 assert.equal(reads,1);
 assert.equal(states.at(-1).status,'current');
 t+=61000;await updater.check({background:true});assert.equal(reads,2);
 updater.dispose();
});

test('native release check resumes when unlocked Windows window returns to foreground',async()=>{
 const native=await readFile(new URL('../desktop-client/Program.cs',import.meta.url),'utf8');
 assert.ok(native.includes('Activated += async (_, _) =>'));
 assert.ok(native.includes('if (!panelUnlocked || downloadingUpdate'));
 assert.ok(native.includes('lastForegroundUpdateCheck < TimeSpan.FromMinutes(1)'));
 assert.ok(native.includes('if (panelUnlocked && offeredUpdate is null) _ = CheckForUpdateAsync();'));
 assert.ok(native.includes('updateButton.Text = $"↻ Zaktualizuj do {version}"'));
 assert.ok(native.includes('updateButton.Click += async (_, _) => await DownloadAndPrepareOfferedUpdateAsync()'));
 assert.ok(native.includes('SHA256.HashDataAsync(packageStream)'));
 assert.ok(native.includes('if (!prepared)'));
});
