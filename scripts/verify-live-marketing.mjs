// Post-deploy checks against the public GitHub Pages domain. Does not log in, send mail or access cameras.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const origin='https://dominiksolorz.github.io';
const root=origin+'/kamera/';
const read=path=>readFile(new URL('../kamera/'+path,import.meta.url),'utf8');
const expectedBuild=JSON.parse(await read('version.json')).version;
const deployedHTML=await read('index.html');
const conceptStyle=deployedHTML.match(/interface-concept\.css\?v=\d+/)?.[0];
assert.ok(conceptStyle,'release must load an actual concept interface stylesheet');
const timeoutMs=18000;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const get=async(path,{method='GET'}={})=>{
  const url=new URL(path,root);
  url.searchParams.set('release_check',process.env.GITHUB_SHA?.slice(0,12)||expectedBuild);
  const response=await fetch(url,{method,redirect:'follow',signal:AbortSignal.timeout(timeoutMs),headers:{'cache-control':'no-cache'}});
  assert.equal(response.status,200,method+' '+path+' returned HTTP '+response.status);
  return method==='HEAD'?response:response.text();
};
const checks=[
  ['o-systemie.html',['id="publicHome"','id="przygotowanie"','data-mkt-setup','marketing-start.mjs?v=1','id="galeria"','Wydanie rozwojowe','href="galeria.html"']],
  ['galeria.html',['class="mktConceptCard"','nie zrzuty działającej aplikacji','marketing-gallery.mjs?v=1']],
  ['pomoc.html',['id="mktContactForm"','name="consent"','functions/v1/home-contact','id="mktContactResult"']],
  ['blog/index.html',['pierwsze-uruchomienie.html','diagnostyka-monitoringu.html']],
  ['blog/pierwsze-uruchomienie.html',['HOME SECURITY','Zaloguj']],
  ['polityka-prywatnosci.html',['o-systemie.html','Polityka prywatności']],
  ['regulamin.html',['o-systemie.html','Regulamin']],
  ['rodo.html',['o-systemie.html','Informacja RODO']],
  ['index.html',['name="home-security-build" content="'+expectedBuild+'"','id="authDialog"','id="publicHome"',conceptStyle]],
  ['sitemap.xml',['/kamera/galeria.html','/kamera/o-systemie.html']],
  ['../index.html',['./kamera/o-systemie.html','location.replace']]
];
const assets=[
 'marketing-start.css?v=1','marketing-start.mjs?v=1',
 'marketing-auto-update.css?v=1','marketing-auto-update.mjs?v=2',
 'marketing-gallery.css?v=1','marketing-gallery.mjs?v=1',
 conceptStyle,
 'marketing-motion.css?v=1','marketing.css?v=6',
 '../docs/ui-193/01-pulpit.png','../docs/ui-193/07-telefon.png',
 'assets/home-security-hero.png','downloads/HOME-SECURITY-Desktop-Setup-1.4.10.exe'
];

let tries=0;
while(true){
  try{
    const html=await get('o-systemie.html');
    assert.ok(html.includes('id="przygotowanie"'),'GitHub Pages is still serving the previous release');
    break;
  }catch(error){
    if(++tries>=18)throw error;
    console.log('Waiting for GitHub Pages cache to publish the new release (attempt '+tries+')');
    await pause(5000);
  }
}
// GitHub Pages/CDN can briefly serve a previous index after the deployment API
// has succeeded. Wait for BOTH the build marker and the current CSS reference.
let indexReady=false;
for(let attempt=0;attempt<18;attempt++){
  try{
    const html=await get('index.html');
    if(html.includes('home-security-build" content="'+expectedBuild+'"') && html.includes(conceptStyle)){
      indexReady=true;break;
    }
  }catch{/* Retries handle eventual publication of the latest CDN edge. */}
  console.log('Waiting for current app shell on GitHub Pages (attempt '+(attempt+1)+')');
  await pause(5000);
}
assert.ok(indexReady,'Published app index has not reached the current build '+expectedBuild);
for(const [path,tokens] of checks){
  const html=await get(path);
  for(const token of tokens)assert.ok(html.includes(token),'Missing '+JSON.stringify(token)+' in '+path);
  if(path==='galeria.html')assert.equal((html.match(/class="mktConceptCard"/g)||[]).length,8);
  if(path==='index.html')assert.ok(html.includes('app.js?v='+expectedBuild));
  console.log('OK document '+path);
}
for(const path of assets){
  const response=await get(path,{method:'HEAD'});
  const bytes=Number(response.headers.get('content-length')||'0');
  console.log('OK asset '+path+(bytes?' ('+bytes+' bytes)':''));
}
console.log('Production marketing smoke: all public routes, releases and media files verified.');
