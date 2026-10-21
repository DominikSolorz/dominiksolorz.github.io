import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createWebUpdates} from '../kamera/core/web-updates.mjs';
const read=p=>readFile(new URL('../kamera/'+p,import.meta.url),'utf8');
const layoutContext=vm.createContext({});vm.runInContext(await read('core/client-layout.js'),layoutContext);
const platform=layoutContext.HomeSecurityLayout.detectPlatform;
for(const [name,ua,touch,expected] of [
 ['Android Chrome','Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',5,'android'],
 ['Samsung Internet','Mozilla/5.0 (Linux; Android 13; SM-S918B) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36',5,'android'],
 ['Android Firefox','Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0',5,'android'],
 ['Android tablet','Mozilla/5.0 (Linux; Android 14; SM-X700) Chrome/130.0 Safari/537.36',10,'android'],
 ['iPhone','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',5,'ios'],
 ['iPad desktop user agent','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',5,'ios'],
 ['Mac without touch','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',0,'unknown']
])test(`${name} platform and automatic layout`,()=>{
 assert.equal(platform({userAgent:ua,maxTouchPoints:touch}),expected);
 if(expected!=='unknown')assert.equal(layoutContext.HomeSecurityLayout.resolve({mobile:true,compact:false}),'mobile');
});
function setup({controlled=true,fail=false,prepare=async()=>{}}={}){
 const states=[],calls=[];const registration=new EventTarget();registration.installing=null;registration.waiting=null;
 registration.update=async()=>{calls.push('update');if(fail)throw Error('offline');};
 const worker=new EventTarget();worker.controller=controlled?{}:null;
 worker.register=async(url,options)=>{calls.push({url,options});return registration;};
 let time=0;const manager=createWebUpdates({serviceWorker:worker,build:'110',onState:s=>states.push(s),prepareReload:prepare,abortReload:async()=>calls.push('abort'),reload:()=>calls.push('reload'),now:()=>time});
 return {manager,worker,registration,states,calls,tick:()=>{time+=60000;}};
}
test('PWA registers fresh resources and throttles background checks',async()=>{
 const x=setup();await x.manager.check({background:true});await x.manager.check({background:true});
 assert.equal(x.calls.filter(c=>c==='update').length,1);assert.equal(x.calls[0].options.updateViaCache,'none');
 x.tick();await x.manager.check({background:true});assert.equal(x.calls.filter(c=>c==='update').length,2);
 x.manager.dispose();
});
test('Android PWA update never reloads or stops camera automatically',async()=>{
 const x=setup();await x.manager.check();x.worker.dispatchEvent(new Event('controllerchange'));
 assert.equal(x.manager.available,true);assert.ok(!x.calls.includes('reload'));x.manager.dispose();
});
test('first PWA installation is not a new-version notification',async()=>{
 const x=setup({controlled:false});await x.manager.check();x.worker.dispatchEvent(new Event('controllerchange'));
 assert.equal(x.manager.available,false);assert.ok(!x.calls.includes('reload'));assert.equal(x.states.at(-1).status,'current');x.manager.dispose();
});
test('explicit update waits for confirmed recording finalization',async()=>{
 let finish;const order=[];const x=setup({prepare:()=>new Promise(r=>{order.push('prepare');finish=r;})});
 await x.manager.check();x.worker.dispatchEvent(new Event('controllerchange'));
 const applying=x.manager.apply();assert.deepEqual(order,['prepare']);assert.ok(!x.calls.includes('reload'));
 finish();await applying;assert.ok(x.calls.includes('reload'));x.manager.dispose();
});
test('failed recording finalization blocks update and resumes recorder',async()=>{
 const x=setup({prepare:async()=>{throw Error('write failed');}});await x.manager.check();
 x.worker.dispatchEvent(new Event('controllerchange'));await x.manager.apply();
 assert.ok(!x.calls.includes('reload'));assert.ok(x.calls.includes('abort'));assert.equal(x.states.at(-1).status,'error');x.manager.dispose();
});
test('offline check never claims that an update succeeded',async()=>{
 const x=setup({fail:true});await x.manager.check();assert.equal(x.states.at(-1).status,'error');x.manager.dispose();
});
test('manifest recordings shortcut opens current mobile router, not legacy page',async()=>{
 const manifest=JSON.parse(await read('manifest.webmanifest'));
 assert.equal(manifest.id,'/kamera/owner-panel');
 assert.ok(manifest.start_url.includes('ui=phone'));
 assert.ok(manifest.shortcuts.find(s=>s.short_name==='Nagrania').url.includes('mobileView=recordings'));
 const [mobile,app]=await Promise.all(['mobile.js','app.js'].map(read));
 assert.ok(mobile.includes("get('mobileView')"));assert.ok(mobile.includes('mobileBuild'));
 assert.ok(app.includes("if(document.readyState==='complete')checkWebUpdate()"));
});
