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
function setup({controlled=true,fail=false,prepare=async()=>{},auto=false,can=()=>true}={}){
 const states=[],calls=[];const registration=new EventTarget();registration.installing=null;registration.waiting=null;
 registration.update=async()=>{calls.push('update');if(fail)throw Error('offline');};
 const worker=new EventTarget();worker.controller=controlled?{}:null;
 worker.register=async(url,options)=>{calls.push({url,options});return registration;};
 let time=0;const manager=createWebUpdates({serviceWorker:worker,build:'110',onState:s=>states.push(s),prepareReload:prepare,abortReload:async()=>calls.push('abort'),reload:()=>calls.push('reload'),now:()=>time,autoApply:auto,canAutoApply:can});
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

test('published web update reloads automatically when idle with no Update click',async()=>{
 let saved=0;
 const x=setup({auto:true,prepare:async()=>{saved++;}});
 await x.manager.check();
 x.worker.dispatchEvent(new Event('controllerchange'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(saved,1);
 assert.equal(x.calls.filter(c=>c==='reload').length,1);
 x.manager.dispose();
});

test('automatic web update waits while camera is active, then resumes without a click',async()=>{
 let recording=true;
 const x=setup({auto:true,can:()=>!recording});
 await x.manager.check();
 x.worker.dispatchEvent(new Event('controllerchange'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(!x.calls.includes('reload'));
 assert.equal(x.states.at(-1).status,'waiting');
 recording=false;
 x.manager.tryAutoApply();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.calls.filter(c=>c==='reload').length,1);
 x.manager.dispose();
});

test('first web service-worker install does not trigger an automatic reload',async()=>{
 const x=setup({controlled:false,auto:true});
 await x.manager.check();
 x.worker.dispatchEvent(new Event('controllerchange'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(!x.calls.includes('reload'));
 x.manager.dispose();
});

test('failure to flush the recording blocks automatic update and restores recording',async()=>{
 const x=setup({auto:true,prepare:async()=>{throw Error('write failure');}});
 await x.manager.check();
 x.worker.dispatchEvent(new Event('controllerchange'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(!x.calls.includes('reload'));
 assert.ok(x.calls.includes('abort'));
 assert.equal(x.states.at(-1).status,'error');
 x.manager.dispose();
});

test('a manually clicked PWA update is blocked until the active camera stops',async()=>{
 let active=true;
 const x=setup({auto:false,can:()=>!active});
 await x.manager.check();
 x.worker.dispatchEvent(new Event('controllerchange'));
 await x.manager.apply();
 assert.ok(!x.calls.includes('reload'));
 assert.equal(x.states.at(-1).status,'waiting');
 active=false;
 await x.manager.apply();
 assert.equal(x.calls.filter(c=>c==='reload').length,1);
 x.manager.dispose();
});

test('marketing pages poll the published build but preserve unsent forms',async()=>{
 const [script,source,generated]=await Promise.all([
  read('marketing-auto-update.mjs'),
  readFile(new URL('../scripts/build-marketing.mjs',import.meta.url),'utf8'),
  read('o-systemie.html')
 ]);
 for(const item of ["cache: 'no-store'",'window.location.reload()','!dirty','document.visibilityState', 'version.json']){
  assert.ok(script.includes(item),'missing safe public update condition: '+item);
 }
 assert.ok(source.includes('marketing-auto-update.mjs?v=3'));
 assert.ok(source.includes('home-security-build'));
 assert.ok(generated.includes('marketing-auto-update.mjs?v=3'));
 const version=JSON.parse(await read('version.json')).version;
 assert.ok(generated.includes('home-security-build" content="'+version+'"'));
});

test('native Windows update remains strictly opt-in via the left-hand sidebar',async()=>{
 const [native,desktop]=await Promise.all([
   readFile(new URL('../desktop-client/Program.cs',import.meta.url),'utf8'),
   read('desktop.js')
 ]);
 assert.ok(native.includes('updateCheckTimer.Tick += async (_, _) => await CheckForUpdateAsync()'));
 assert.ok(native.includes('updateButton.Click += async (_, _) => await DownloadAndPrepareOfferedUpdateAsync()'));
 assert.ok(native.includes('if (manifest is null || !Version.TryParse'));
 assert.ok(desktop.includes('data-desktop-view="live"'));
 assert.ok(desktop.includes('type: "desktop.update.request"'));
 assert.ok(desktop.includes('desktopUpdateNotice'));
});

test('remote live camera viewer prevents idle or manually requested PWA refresh',async()=>{
 const app=await read('app.js');
 const match=app.match(/canAutoApply:\(\)=>([^\r\n]+),\r?\n\s*onState:/);
 assert.ok(match,'update safety guard must be wired in the current app');
 assert.ok(app.replaceAll('\n','\r\n').match(/canAutoApply:\(\)=>([^\r\n]+),\r?\n\s*onState:/),'Windows CRLF checkout must pass the same live-viewer safety assertion');
 const canRefresh=new Function('sender','archive','video','document','return ('+match[1]+');');
 const sender={live:false},state={recording:false};
 const archive={status:()=>state};
 const video={srcObject:{getVideoTracks:()=>[{readyState:'live'}]}};
 const document={querySelector:()=>null};
 assert.equal(canRefresh(sender,archive,video,document),false,'never auto-reload while remote viewer plays a live track');
 video.srcObject={getVideoTracks:()=>[{readyState:'ended'}]};
 assert.equal(canRefresh(sender,archive,video,document),true,'allow idle viewer once the remote track has ended');
 sender.live=true;
 assert.equal(canRefresh(sender,archive,video,document),false,'a local sender must also be protected');
 sender.live=false;state.recording=true;
 assert.equal(canRefresh(sender,archive,video,document),false,'recording still blocks update');
 state.recording=false;
 document.querySelector=()=>({});
 assert.equal(canRefresh(sender,archive,video,document),false,'editing a form blocks refresh');
});
