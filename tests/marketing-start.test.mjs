import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=async path=>(await readFile(new URL('../'+path,import.meta.url),'utf8')).replaceAll('\r\n','\n');

test('the setup checklist actually responds to four user choices without tracking',async()=>{
 const script=await read('kamera/marketing-start.mjs');
 const handlers=[];
 const inputs=Array.from({length:4},()=>({checked:false,addEventListener:(name,fn)=>{assert.equal(name,'change');handlers.push(fn);}}));
 const count={textContent:''},bar={style:{}},summary={textContent:''};
 const progress={attrs:{},querySelector:()=>bar,setAttribute(name,value){this.attrs[name]=value;}};
 const section={querySelectorAll:()=>inputs,querySelector(selector){
  if(selector==='#mktSetupCount')return count;
  if(selector==='.mktSetupProgress')return progress;
  if(selector==='#mktSetupResult')return summary;
  return null;
 }};
 vm.runInNewContext(script,{document:{querySelector:()=>section}});
 assert.equal(count.textContent,'0 / 4');
 assert.equal(progress.attrs['aria-valuenow'],'0');
 inputs[0].checked=true;handlers[0]();
 assert.equal(count.textContent,'1 / 4');
 assert.equal(bar.style.transform,'scaleX(0.25)');
 inputs.forEach(item=>{item.checked=true;});
 handlers[1]();
 assert.equal(count.textContent,'4 / 4');
 assert.equal(bar.style.transform,'scaleX(1)');
 assert.match(summary.textContent,/nie automatyczny test kamery/);
 assert.ok(!/localStorage|sessionStorage|fetch\(|XMLHttpRequest|navigator\.mediaDevices/.test(script),'checklist does not collect data or access camera');
});

test('public home makes no fake sales promises and always marks concept material',async()=>{
 const home=await read('design/marketing/home.html');
 for(const part of ['id="przygotowanie"','Ile kosztuje HOME SECURITY?','nie jest zakupem','publicznego cennika','Wydanie rozwojowe','nie są rzeczywiste zrzuty ekranu']){
  assert.ok(home.includes(part),'missing explicit disclosure: '+part);
 }
 assert.equal((home.match(/data-mkt-setup/g)||[]).length,4);
 assert.ok(home.includes('marketing-start.css?v=3'));
 assert.ok(home.includes('marketing-start.mjs?v=2'));
 assert.ok(!home.includes('Kup teraz'));
 assert.ok(!home.includes('Zapłać teraz'));
 const [page,app]=await Promise.all(['kamera/o-systemie.html','kamera/panel.html'].map(read));
 const slot=/<(?:section|div)(?: role="group")? id="publicHome"[\s\S]*?<\/(?:section|div)>(?=\s*<section id="authDialog")/;
 assert.ok(page.includes(home.trimEnd()));
 assert.equal(app.match(slot)?.[0],home.trimEnd());
});

test('marketing guided checklist is responsive and safely cached with the new release',async()=>{
 const [css,sw,version,app]=await Promise.all([
  'kamera/marketing-start.css','kamera/sw.js','kamera/version.json','kamera/app.js'].map(read));
 assert.ok(css.includes('@media(max-width:670px)'));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 assert.ok(css.includes('mktSetupItem:focus-within'));
 assert.ok(sw.includes('./marketing-start.css?v=3'));
 assert.ok(sw.includes('./marketing-start.mjs?v=2'));
 const release=JSON.parse(version).version;
 const shell=app.match(/SERVICE_WORKER_BUILD = "(\d+)"/)?.[1];
 assert.ok(/^\d+$/.test(release)&&/^\d+$/.test(shell),'manifest and service worker revisions must be numeric');
assert.ok(sw.includes('kamera-domowa-shell-v'+shell));
 assert.ok(app.includes('SERVICE_WORKER_BUILD = "'+shell+'"'));

 assert.ok(app.includes('const VERSION = "'+release+'"'));
});

test('legal documents never send visitors from Back to a login page',async()=>{
 for(const path of ['polityka-prywatnosci','rodo','regulamin']){
  const html=await read('kamera/'+path+'.html');
  assert.ok(html.includes('href="o-systemie.html"'),path);
  assert.ok(!html.includes('href="./"'),path);
  assert.ok(html.includes('noindex,nofollow'),'unfinished legal templates must not be indexed');
 }
});

test('the deployed-site audit checks real pages without submitting forms',async()=>{
 const [script,manifest]=await Promise.all(['scripts/verify-live-marketing.mjs','kamera/version.json'].map(read));
 assert.ok(script.includes("galeria.html"));
 assert.ok(script.includes("polityka-prywatnosci.html"));
 assert.ok(script.includes("downloads/HOME-SECURITY-Desktop-Setup-"),'audit must check a real downloadable Windows installer');
 assert.ok(script.includes("expectedDesktop.version+'.exe'"),'installer URL must be derived from current release manifest');
 assert.ok(!script.includes("method:'POST'"));
 assert.ok(!script.includes('submit()'));
 assert.ok(script.includes("../kamera/version.json"));
});
