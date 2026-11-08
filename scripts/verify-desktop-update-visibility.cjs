const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));const panel=fs.readFileSync('kamera/panel.html','utf8');const styles=panel.match(/<template id="panelStyles">([\s\S]*?)<\/template>/)[1];let body=panel.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='desktop.invalid')return route.abort();const name=u.pathname.slice(1);if(name){const file=path.resolve('kamera',name);return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});}return route.fulfill({contentType:'text/html',body:`<!doctype html><html class="desktopMode" lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<script>const routeParams=new URLSearchParams(location.search);</script><body class="desktopMode">${body}<script type="module">document.querySelectorAll('body > :not(main):not(header):not(script)').forEach(n=>n.hidden=true);document.getElementById('app').hidden=false;window.chrome=window.chrome||{};window.nativeMessages=[];const nativeListeners=[];window.chrome.webview={postMessage:m=>window.nativeMessages.push(m),addEventListener:(type,fn)=>nativeListeners.push(fn),removeEventListener:()=>{}};window.replyUpdate=data=>nativeListeners.forEach(fn=>fn({data}));await import('/desktop.js');const {mountDvr}=await import('/dvr-ui.js');window.fixtureDvr=mountDvr({client:{connected:false},drive:null,root:document.getElementById('dvrCard'),listRoot:document.getElementById('dvrListCard'),stage:document.getElementById('stage'),toast:()=>{}});window.primaryBefore=document.getElementById('video');const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.getContext('2d').fillRect(0,0,320,180);window.fixtureTrack=canvas.captureStream(1).getVideoTracks()[0];window.primaryBefore.srcObject=new MediaStream([window.fixtureTrack]);document.querySelector('[data-desktop-view="controls"]').click();</script></body></html>`});});await page.goto('https://desktop.invalid/');await page.waitForFunction(()=>window.fixtureDvr && window.primaryBefore && document.querySelector('[data-desktop-view="controls"]'));

const assert=require('node:assert/strict');
assert.equal(await page.locator('.desktopSidebarFoot').count(),0);
assert.equal(await page.locator('.desktopSidebar [data-open-project-gallery]').count(),0);
const send=state=>page.evaluate(state=>window.replyUpdate({type:'desktop.update.state',installedVersion:'1.4.75',...state}),state);
for(const state of [{status:'none'},{status:'checking',hasUpdate:false},{status:'current',hasUpdate:false},{status:'error',hasUpdate:false},{status:'available',version:'1.4.75'},{status:'available',version:'1.4.74'}]){
 await send(state);assert.equal(await page.locator('#desktopUpdateNotice').isVisible(),false,JSON.stringify(state));
}
await send({status:'available',version:'1.4.76',hasUpdate:true});
assert.equal(await page.locator('#desktopUpdateNotice').isVisible(),true);
assert.equal(await page.locator('#desktopUpdateAction').isEnabled(),true);
await page.locator('#desktopUpdateAction').click();
assert.equal(await page.evaluate(()=>window.nativeMessages.at(-1).type),'desktop.update.request');
await send({status:'downloading',version:'1.4.76',hasUpdate:true,percent:42});
assert.equal(await page.locator('#desktopUpdateProgress').isVisible(),true);
assert.equal(await page.locator('#desktopUpdateAction').isEnabled(),false);
await send({status:'staged',hasUpdate:true});
assert.equal(await page.locator('#desktopUpdateAction').isEnabled(),true);
assert.equal(await page.locator('#desktopUpdateAction').innerText(),'↻ Zainstaluj teraz');
await send({status:'current',hasUpdate:false});
assert.equal(await page.locator('#desktopUpdateNotice').isVisible(),false);
assert.deepEqual(errors,[]);
console.log('PASS desktop sidebar removed; current/checking/offline/equal/older hidden; real offer, download, prepared install and cancellation verified');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
