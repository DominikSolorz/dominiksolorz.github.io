// Actual browser FileSystemHandle/IndexedDB persistence in a fresh isolated OPFS.
// Synthetic recording test only: never opens a camera, microphone or user folder.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/diskstore.js')return route.fulfill({contentType:'text/javascript',body:await fs.readFile(path.join(__dirname,'../kamera/diskstore.js'),'utf8')});
   if(pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated archive test</title><h1>Synthetic archive test</h1>'});
   return route.abort();
  });
  const page=await context.newPage();await page.goto('https://archive-test.invalid/');
  const first=await page.evaluate(async()=>{
   const store=await import('/diskstore.js');
   const folder=await (await navigator.storage.getDirectory()).getDirectoryHandle('archive-fixture',{create:true});
   window.showDirectoryPicker=async()=>folder;await store.choose();
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
   document.body.append(canvas);const context=canvas.getContext('2d'),stream=canvas.captureStream(0),parts=[];
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});
   const closed=new Promise(resolve=>recorder.onstop=resolve);recorder.ondataavailable=e=>parts.push(e.data);
   recorder.start();for(let i=0;i<8;i++){context.fillStyle=i%2?'blue':'green';context.fillRect(0,0,320,180);stream.getVideoTracks()[0].requestFrame();await new Promise(r=>setTimeout(r,100));}
   recorder.stop();await closed;stream.getTracks().forEach(t=>t.stop());
   const recording=new Blob(parts,{type:'video/webm'}),name='kamera-2026-10-29_00-00-00.webm';
   if(!await store.save(name,recording))throw Error('Save was not confirmed');
   const file=await store.load(name);return {name,bytes:recording.size,savedBytes:file.size,ready:(await store.status()).ready};
  });
  console.log(JSON.stringify(first));await page.reload();
  const second=await page.evaluate(async()=>{const store=await import('/diskstore.js');const status=await store.status();const files=await store.list();
   const file=await store.load(files[0].name),video=document.createElement('video');video.src=URL.createObjectURL(new Blob([await file.arrayBuffer()],{type:'video/webm'}));video.muted=true;document.body.append(video);
   const decoded=await new Promise((resolve,reject)=>{video.onloadeddata=()=>resolve({width:video.videoWidth,height:video.videoHeight});video.onerror=()=>reject(Error('Recording cannot be decoded: '+video.error?.code+' '+video.error?.message+' '+file.size));setTimeout(()=>reject(Error('Decode timeout')),10000);});
   URL.revokeObjectURL(video.src);return {status,files:files.length,bytes:file.size,decoded};});
  const result={synthetic:true,userFolderTested:false,first,afterReload:second,ok:first.ready&&first.bytes>0&&first.bytes===first.savedBytes&&second.status.ready&&second.files===1&&second.bytes===first.bytes&&second.decoded.width===320};
  await fs.writeFile('folder-browser-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
