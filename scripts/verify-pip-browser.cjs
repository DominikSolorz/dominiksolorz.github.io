// Real browser PiP API with synthetic canvas video. No camera, microphone or account.
const {chromium}=require('playwright');const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});
try{const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',async route=>{
 const name=new URL(route.request().url()).pathname;
 if(name==='/picture-in-picture.mjs')return route.fulfill({contentType:'text/javascript',body:await fs.readFile(path.join(__dirname,'../kamera/picture-in-picture.mjs'),'utf8')});
 if(name==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><h1>TEST PiP · syntetyczne wideo</h1><video id="video" autoplay muted playsinline></video><button id="toggle">Mini-okno</button>'});return route.abort();
});const page=await context.newPage();await page.goto('https://pip-test.invalid/');
await page.evaluate(async()=>{const {createPictureInPicture}=await import('/picture-in-picture.mjs');window.errors=[];const video=document.getElementById('video');
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;document.body.append(canvas);const ctx=canvas.getContext('2d');window.stream=canvas.captureStream(0);video.srcObject=stream;void video.play();
 window.paintTimer=setInterval(()=>{ctx.fillStyle='green';ctx.fillRect(0,0,320,180);stream.getVideoTracks()[0].requestFrame();},100);
 window.client=createPictureInPicture(video,{onError:e=>errors.push(e)});document.getElementById('toggle').onclick=()=>client.toggle();});
await page.waitForFunction(()=>document.getElementById('video').readyState>=2);await page.locator('#toggle').click();
const entered=await page.evaluate(()=>({active:document.pictureInPictureElement===document.getElementById('video'),errors:[...errors],trackLive:stream.getVideoTracks()[0].readyState==='live'}));
await page.waitForFunction(()=>!client.state().busy);await page.locator('#toggle').click();await page.waitForFunction(()=>!document.pictureInPictureElement);const exited=await page.evaluate(()=>({active:!!document.pictureInPictureElement,trackLive:stream.getVideoTracks()[0].readyState==='live'}));
await page.evaluate(()=>{client.dispose();clearInterval(paintTimer);stream.getTracks().forEach(t=>t.stop());});
const result={synthetic:true,phoneTested:false,entered,exited,ok:entered.active&&!entered.errors.length&&!exited.active&&entered.trackLive&&exited.trackLive};await fs.writeFile('pip-browser-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
