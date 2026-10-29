// Fresh test browser only. No personal profile, credentials or device permissions.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
(async()=>{
 const {pageInventory}=await import('./audit-page-inventory.mjs');
 const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
 try{
  for(const mobile of [false,true]){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
   // Public content must not send messages or start capture in this audit.
   await context.route('**/*',route=>route.request().method()==='GET'||route.request().method()==='HEAD'?route.continue():route.abort());
   const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
   for(const entry of await pageInventory()){
    errors=[];const row={path:entry.path,mode:mobile?'mobile':'desktop'};
    try{
     const response=await page.goto(new URL(entry.path,process.env.AUDIT_ORIGIN||'https://dominiksolorz.github.io/kamera/').href,{waitUntil:'domcontentloaded',timeout:30000});
     await page.waitForTimeout(700);
     Object.assign(row,await page.evaluate(()=>({url:location.href,overflow:document.documentElement.scrollWidth>innerWidth+2,title:document.title,
      brokenImages:[...document.images].filter(i=>i.getClientRects().length&&i.complete&&!i.naturalWidth).map(i=>i.getAttribute('src')),
      visibleHeading:[...document.querySelectorAll('h1,h2')].some(h=>h.getClientRects().length&&h.textContent.trim()),
      blank:document.body.innerText.trim().length<20})),{status:response.status(),errors:[...errors]});
     if(['index.html','panel.html?auth=login'].includes(entry.path))await page.screenshot({path:`browser-${mobile?'mobile':'desktop'}-${entry.id}.png`,fullPage:false});
    }catch(e){row.error=e.message;}
    results.push(row);console.log(JSON.stringify(row));
   }await context.close();
  }
 }finally{await browser.close();}
 await fs.writeFile('public-browser-report.json',JSON.stringify(results,null,2));
 if(results.some(r=>r.error||r.status>=400||r.overflow||r.blank||r.errors?.length||r.brokenImages?.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
