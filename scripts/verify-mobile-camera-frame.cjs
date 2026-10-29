// Isolated layout fixture using production styles/modules; no account or live camera.
const {chromium}=require('playwright');const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{const context=await browser.newContext({serviceWorkers:'block',isMobile:true,hasTouch:true});const page=await context.newPage();
const panel=await fs.readFile(path.join(__dirname,'../kamera/panel.html'),'utf8');const styles=panel.match(/<template id="panelStyles">([\s\S]*?)<\/template>/)[1];
await context.route('**/*',async route=>{const name=new URL(route.request().url()).pathname.slice(1);if(!name)return route.fulfill({contentType:'text/html',body:`<!doctype html><html class="mobileOwnerMode"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<body class="mobileOwnerMode"><p>TEST UKŁADU · BEZ KAMERY</p><main id="app"><div class="mainCol"><div id="stage" class="stage fit-contain"><video id="video"></video><div class="placeholder">Czekam na obraz z kamery…</div></div></div></main><script type="module">import {mountMobileCameraFrame} from './mobile-camera-frame.mjs';window.mount=mountMobileCameraFrame;window.fixtureReady=true;</script></body></html>`});
if(!/^[a-z0-9/_.-]+$/i.test(name)||name.includes('..'))return route.abort();try{const file=path.join(__dirname,'../kamera',name);return route.fulfill({contentType:name.endsWith('.css')?'text/css':name.endsWith('.mjs')?'text/javascript':'application/octet-stream',body:await fs.readFile(file)});}catch{return route.abort();}});
for(const [width,height] of [[390,844],[430,932],[844,390],[932,430],[1280,591]]){
 await page.setViewportSize({width,height});await page.goto('https://frame-test.invalid/');await page.waitForFunction(()=>window.fixtureReady);
 for(const [w,h] of [[1920,1080],[640,480],[720,1280]]){
  const row=await page.evaluate(([w,h])=>{const video=document.getElementById('video'),stage=document.getElementById('stage');
   Object.defineProperty(video,'videoWidth',{value:w,configurable:true});Object.defineProperty(video,'videoHeight',{value:h,configurable:true});window.mount(stage,video);
   const r=stage.getBoundingClientRect();return {viewport:[innerWidth,innerHeight],source:[w,h],frame:[r.width,r.height],fit:getComputedStyle(video).objectFit,overflow:document.documentElement.scrollWidth>innerWidth+2,ratioOK:Math.abs(r.width/r.height-w/h)<.02};},[w,h]);results.push(row);
  if(w===1920&&[390,844].includes(width))await page.screenshot({path:`mobile-camera-${width}.png`,fullPage:true});
 }
}await fs.writeFile('mobile-camera-layout-report.json',JSON.stringify(results,null,2));console.log(JSON.stringify({checks:results.length,failures:results.filter(x=>!x.ratioOK||x.fit!=='contain'||x.overflow||x.frame[0]<x.viewport[0]-50)}));if(results.some(x=>!x.ratioOK||x.fit!=='contain'||x.overflow||x.frame[0]<x.viewport[0]-50))process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
