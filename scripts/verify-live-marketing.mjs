// Post-deploy checks against the public GitHub Pages domain. Does not log in, send mail or access cameras.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const origin='https://dominiksolorz.github.io';
const root=origin+'/kamera/';
const expectedBuild=JSON.parse(await readFile(new URL('../kamera/version.json',import.meta.url),'utf8')).version;
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
  ['o-systemie.html',['id="publicHome"','id="przygotowanie"','data-mkt-setup','marketing-start.mjs?v=2','id="galeria"','Wydanie rozwojowe','href="galeria.html"']],
  ['galeria.html',['class="mktConceptCard"','nie zrzuty działającej aplikacji','marketing-gallery.mjs?v=2']],
  ['pomoc.html',['id="mktContactForm"','name="consent"','functions/v1/home-contact','id="mktContactResult"']],
  ['blog/index.html',['pierwsze-uruchomienie.html','diagnostyka-monitoringu.html']],
  ['blog/pierwsze-uruchomienie.html',['HOME SECURITY','Zaloguj']],
  ['polityka-prywatnosci.html',['o-systemie.html','Polityka prywatności']],
  ['regulamin.html',['o-systemie.html','Regulamin']],
  ['rodo.html',['o-systemie.html','Informacja RODO']],
  ['panel.html',['name="home-security-build" content="'+expectedBuild+'"','id="authDialog"','id="publicHome"','interface-concept.css?v=2']],
  ['index.html',['http-equiv="Content-Security-Policy"','require-trusted-types-for','data-source="marketing.css?v=9"','name="robots" content="index,follow"','rel="canonical" href="https://home-security-dominik-solorz.vercel.app/kamera/"','data-public-entry']],
  ['sitemap.xml',['/kamera/galeria.html','/kamera/</loc>']],
  ['../index.html',['./kamera/','location.replace']]
];
const assets=[
 'marketing-start.css?v=3','marketing-start.mjs?v=2',
 'marketing-auto-update.css?v=2','marketing-auto-update.mjs?v=5',
 'core/web-updates.mjs?v=3','sw.js?v=149','panel-entry.mjs?v=2','public-entry.js?v=2',
 'marketing-gallery.css?v=3','marketing-gallery.mjs?v=2',
 'interface-concept.css?v=2',
 'marketing-motion.css?v=2','marketing.css?v=9',
 '../docs/ui-193/01-pulpit.png','../docs/ui-193/07-telefon.png',
 'assets/home-security-hero-640.webp','assets/home-security-hero.webp','assets/home-security-how-it-works-640.webp','assets/ds-logo-96.webp','assets/ds-logo-192.webp','../docs/ui-193/01-pulpit-480.webp','../docs/ui-193/01-pulpit-640.webp','../docs/ui-193/01-pulpit-720.webp','../docs/ui-193/01-pulpit-960.webp',
 'assets/home-security-hero.png','downloads/HOME-SECURITY-Desktop-Setup-1.4.19.exe'
];

let tries=0;
while(true){
  try{
    const html=await get('o-systemie.html');
    const app=await get('panel.html');
    const expected='home-security-build" content="'+expectedBuild+'"';
    assert.ok(html.includes('id="przygotowanie"')&&html.includes(expected)&&html.includes('marketing-auto-update.mjs?v=5'),'The public homepage is still serving the previous release');
    assert.ok(app.includes(expected)&&app.includes('app.js?v='+expectedBuild),'The protected panel is still serving the previous release');
    break;
  }catch(error){
    if(++tries>=18)throw error;
    console.log('Waiting for GitHub Pages cache to publish the new release (attempt '+tries+')');
    await pause(5000);
  }
}
for(const [path,tokens] of checks){
  const html=await get(path);
  for(const token of tokens)assert.ok(html.includes(token),'Missing '+JSON.stringify(token)+' in '+path);
  if(/^(?:o-systemie|galeria|pomoc)\.html$/.test(path)||path.startsWith('blog/')){
    assert.ok(html.includes('home-security-build" content="'+expectedBuild+'"'),'Outdated marketing build on '+path);
    assert.ok(html.includes('marketing-auto-update.mjs?v=5'),'New public update notice is missing from '+path);
  }
  if(path==='galeria.html')assert.equal((html.match(/class="mktConceptCard"/g)||[]).length,8);
  if(path==='panel.html')assert.ok(html.includes('app.js?v='+expectedBuild)&&html.includes('content="noindex,follow"'));
  if(path==='index.html')assert.ok(!html.includes('id="authDialog"')&&!html.includes('app.js?v='));
  console.log('OK document '+path);
}
for(const path of assets){
  const response=await get(path,{method:'HEAD'});
  const bytes=Number(response.headers.get('content-length')||'0');
  console.log('OK asset '+path+(bytes?' ('+bytes+' bytes)':''));
}
const headers=(await get('index.html',{method:'HEAD'})).headers;
for(const name of ['cache-control','strict-transport-security','cross-origin-opener-policy','x-frame-options','content-security-policy'])console.log('Hosting header '+name+': '+(headers.get(name)||'(absent)'));
console.log('Production marketing smoke: all public routes, releases and media files verified.');
