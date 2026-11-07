// Inspect actual generated documents and production CSS; no account, camera or external submission.
const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),errors=[],results=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='documents.invalid')return route.abort();const file=path.resolve('kamera',url.pathname.slice(1));if(!file.startsWith(path.resolve('kamera')+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
 for(const width of [320,390,1440])for(const name of ['dokumenty','polityka-prywatnosci','rodo','regulamin','zasady-korzystania','instrukcja']){
  await page.setViewportSize({width,height:900});await page.goto(`https://documents.invalid/${name}.html`);
  const row=await page.evaluate(()=>({width:innerWidth,name:document.title,overflow:document.documentElement.scrollWidth>innerWidth+1,h1:document.querySelectorAll('h1').length,tabs:document.querySelectorAll('.legalTabs a').length,brokenAnchors:[...document.querySelectorAll('.legalToc a')].filter(a=>!document.getElementById(a.hash.slice(1))).length,mainVisible:document.querySelector('article').getBoundingClientRect().width>0}));
  results.push(row);if(width===390&&name==='instrukcja')await page.screenshot({path:'documents-phone.png'});
 }
 const report={ok:!errors.length&&results.every(r=>!r.overflow&&r.h1===1&&r.tabs===5&&!r.brokenAnchors&&r.mainVisible),errors,results};fs.writeFileSync('documents-layout-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1;
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
