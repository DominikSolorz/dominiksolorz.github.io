// Production HTML, styles and mobile router; isolated browser, no accounts/camera.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 let platform="ios";const results=[],errors=[];const page=await browser.newPage({isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 const panel=fs.readFileSync('kamera/panel.html','utf8'),styles=panel.match(/<template id="panelStyles">([\s\S]*?)<\/template>/)[1];
 const body=panel.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='mobile.invalid')return route.abort();const name=url.pathname.slice(1);if(name){const file=path.resolve('kamera',name);return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});}
 return route.fulfill({contentType:'text/html',body:`<!doctype html><html class="mobileOwnerMode" data-phone-platform="${platform}" lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<body class="mobileOwnerMode">${body}<script type="module">document.querySelectorAll('body > :not(main):not(header):not(script)').forEach(n=>n.hidden=true);document.getElementById('app').hidden=false;window.routeParams=new URLSearchParams(location.search);window.originalVideo=document.getElementById('video');await import('/mobile.js?v=23');document.getElementById('zoomBar').hidden=false;document.getElementById('watchPanel').hidden=false;window.fixtureReady=true;</script></body></html>`});});
 for(platform of ["ios","android"])for(const [width,height] of [[390,664],[390,844],[430,932],[844,390],[932,430],[1280,591]]){
  await page.setViewportSize({width,height});await page.goto('https://mobile.invalid/');await page.waitForFunction(()=>window.fixtureReady && document.body.dataset.mobileView==="home");
  await page.evaluate(()=>{const v=document.getElementById('video');Object.defineProperty(v,'videoWidth',{value:1920,configurable:true});Object.defineProperty(v,'videoHeight',{value:1080,configurable:true});v.dispatchEvent(new Event('loadedmetadata'));});
  const row=await page.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect();const s=rect('stage'),z=rect('zoomBar'),w=rect('watchPanel'),n=document.querySelector('.mobileBottomNav').getBoundingClientRect(),i=rect('mobileCameraInfo');return {platform:document.documentElement.dataset.phonePlatform,viewport:[innerWidth,innerHeight],bodyView:document.body.dataset.mobileView,landscape:matchMedia("(orientation:landscape) and (max-height:650px)").matches,stageStyle:getComputedStyle(document.getElementById("stage")).height,overflow:document.documentElement.scrollWidth>innerWidth+1,zoomOutside:s.bottom<=z.top+1,toolsOutside:z.bottom<=w.top+1,frameAboveNavigation:s.bottom<=n.top+1,infoAfterCamera:i.height===0||i.top>=s.bottom,videoRetained:originalVideo===document.getElementById('video'),singleSpeaker:getComputedStyle(document.getElementById('soundBtn'),'::after').content==='none',frame:[s.width,s.height],nav:n.top};});results.push(row);
  if(width===390||width===844)await page.screenshot({path:`mobile-viewer-${width}x${height}.png`,fullPage:true});
 }
 await page.locator('.mobileRelease>summary').click();const options=await page.locator('.mobileOptionsBody').isVisible();await page.locator('.mobileRelease>summary').click();
 await page.evaluate(()=>window.originalControls=document.getElementById('ctrlBar'));
 await page.locator('button[data-mobile-view="settings"]').click();if(await page.locator("#zoomBar").isVisible())throw Error("Zoom remained visible in settings");
 await page.locator('[data-setting-section="controls"]').click();
 if(!await page.locator('#ctrlBar').isVisible())throw Error('Controls unavailable in mobile category');
 if(!await page.evaluate(()=>originalControls===document.getElementById('ctrlBar')))throw Error('Controls were replaced');
 await page.evaluate(()=>document.getElementById('ctrlBar').hidden=true);
 if(await page.locator('#ctrlBar').isVisible())throw Error('Read-only permission hidden controls were exposed');
 await page.evaluate(()=>document.getElementById('ctrlBar').hidden=false);
 await page.locator('button[data-mobile-view="home"]').click();
 if(await page.locator('#ctrlBar').isVisible())throw Error('Controls leaked into home');
 const retained=await page.evaluate(()=>originalVideo===document.getElementById('video'));
 const fitChecks=await page.evaluate(async()=>{
  const {applyCameraFit}=await import('/camera-fit.mjs?v=1');const stage=document.getElementById('stage');
  const button=document.getElementById('fitBtn'),fullscreenButton=document.getElementById('fitFull'),video=document.getElementById('video');
  stage.classList.add('fakeFull');
  applyCameraFit({stage,button,fullscreenButton,mode:'cover',mobile:true});const cover=getComputedStyle(video).objectFit;
  applyCameraFit({stage,button,fullscreenButton,mode:'contain',mobile:true});const contain=getComputedStyle(video).objectFit;stage.classList.remove('fakeFull');
  const a=document.getElementById('audioHud').getBoundingClientRect(),s=stage.getBoundingClientRect();return {cover,contain,audioOutside:!stage.contains(document.getElementById('audioHud')),audioBelow:a.top>=s.bottom};
 });
 if(fitChecks.cover!=='cover'||fitChecks.contain!=='contain'||!fitChecks.audioOutside||!fitChecks.audioBelow)throw Error(JSON.stringify(fitChecks));
 const report={results,errors,options,retained};fs.writeFileSync('mobile-viewer-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(errors.length||!options||!retained||results.some(r=>r.overflow||!r.zoomOutside||!r.toolsOutside||!r.frameAboveNavigation||!r.infoAfterCamera||!r.videoRetained||!r.singleSpeaker))process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
