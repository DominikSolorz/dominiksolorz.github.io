const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));const panel=fs.readFileSync('kamera/panel.html','utf8');const styles=panel.match(/<template id="panelStyles">([\s\S]*?)<\/template>/)[1];let body=panel.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='desktop.invalid')return route.abort();const name=u.pathname.slice(1);if(name){const file=path.resolve('kamera',name);return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});}return route.fulfill({contentType:'text/html',body:`<!doctype html><html class="desktopMode" lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<script>const routeParams=new URLSearchParams(location.search);</script><body class="desktopMode">${body}<script type="module">document.querySelectorAll('body > :not(main):not(header):not(script)').forEach(n=>n.hidden=true);document.getElementById('app').hidden=false;await import('/desktop.js');document.querySelector('[data-desktop-view="controls"]').click();</script></body></html>`});});await page.goto('https://desktop.invalid/');await page.waitForTimeout(500);
const results=[];
for(const width of [1024,1440,1920]){
 await page.setViewportSize({width,height:1000});
 for(const view of ['live','controls','settings','events','diagnostics']){
  await page.evaluate(view=>document.querySelector(`[data-desktop-view="${view}"]`).click(),view);
  await page.waitForTimeout(100);await page.evaluate(()=>window.scrollTo(0,0));
  const result=await page.evaluate(()=>{
   const nodes=[...document.querySelectorAll('.controlDeviceDock > *')].filter(n=>n.getBoundingClientRect().width);
   return {overflow:document.documentElement.scrollWidth>innerWidth+1,deviceWidths:nodes.map(n=>Math.round(n.getBoundingClientRect().width)),primaryVideoRetained:!!document.querySelector('#video'),active:document.querySelector('.desktopNav .active')?.dataset.desktopView};
  });
  if(result.overflow||result.active!==view||!result.primaryVideoRetained||result.deviceWidths.some(w=>w<200))throw Error(JSON.stringify({width,view,...result}));
  results.push({width,view,...result});
  if(width===1440)await page.screenshot({path:`desktop-product-${view}.png`,fullPage:false});
 }
}
if(errors.length)throw Error(errors.join('; '));
fs.writeFileSync('desktop-product-verified.json',JSON.stringify({isolatedProductionMarkup:true,realAccount:false,physicalCamera:false,errors,results},null,2));
console.log(JSON.stringify({errors,passed:results.length}));
}finally{await browser.close();}})();


