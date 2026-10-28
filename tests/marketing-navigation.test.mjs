import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const pages=['kamera/index.html','kamera/o-systemie.html','kamera/panel.html',
 'kamera/pobierz.html','kamera/galeria.html','kamera/pomoc.html',
 'kamera/blog/index.html','kamera/blog/pierwsze-uruchomienie.html',
 'kamera/blog/zapis-lokalny-i-drive.html','kamera/blog/diagnostyka-monitoringu.html'];

test('navigation module is valid, progressive and independent of recorder/account',async()=>{
 const url=new URL('kamera/marketing-navigation.mjs',root);
 const syntax=spawnSync(process.execPath,['--check',fileURLToPath(url)],{encoding:'utf8'});
 assert.equal(syntax.status,0,syntax.stderr||syntax.error?.message);
 const src=await read('kamera/marketing-navigation.mjs');
 assert.ok(src.includes("'.mktHeader .mktMobileMenu'"));
 assert.ok(src.includes("event.key === 'Escape'"));
 assert.ok(src.includes("event.target.closest('a[href]')"));
 assert.ok(src.includes("event.target"));
 assert.ok(!/localStorage|fetch\(|getUserMedia|MediaRecorder|createClient|signInWithPassword/.test(src));
});

test('native hamburger opens, closes by second tap, Escape, link and outside pointer',async()=>{
 const code=await read('kamera/marketing-navigation.mjs');
 const listeners={},documentListeners={},windowListeners={},attributes={};
 let focused=0;
 const trigger={isConnected:true,setAttribute:(k,v)=>{attributes[k]=v;},focus:()=>{focused++;}};
 const nav={addEventListener:(type,callback)=>{listeners['nav:'+type]=callback;}};
 const menu={open:false,querySelector:s=>s.includes('summary')?trigger:s.includes('nav')?nav:null,
  addEventListener:(type,callback)=>{listeners['menu:'+type]=callback;},
  contains:node=>node===trigger||node===nav};
 const document={querySelectorAll:()=>[menu],
  addEventListener:(type,callback)=>{documentListeners[type]=callback;}};
 const window={addEventListener:(type,callback)=>{windowListeners[type]=callback;},
  matchMedia:()=>({matches:true})};
 vm.runInNewContext(code,{document,window});
 assert.equal(attributes['aria-expanded'],'false');
 assert.equal(attributes['aria-label'],'Otwórz menu nawigacji');
 menu.open=true;listeners['menu:toggle']();
 assert.equal(attributes['aria-expanded'],'true');
 assert.equal(attributes['aria-label'],'Zamknij menu nawigacji');
 // The native details element owns the first and second summary clicks.
 menu.open=false;listeners['menu:toggle']();
 assert.equal(attributes['aria-expanded'],'false');
 menu.open=true;listeners['menu:toggle']();
 listeners['nav:click']({target:{closest:()=>({href:'#mozliwosci'})}});
 assert.equal(menu.open,false,'link closes menu');
 menu.open=true;documentListeners.pointerdown({target:{}});
 assert.equal(menu.open,false,'outside press closes menu');
 menu.open=true;
 let cancelled=0;
 documentListeners.keydown({key:'Escape',preventDefault(){cancelled++;}});
 assert.equal(cancelled,1);
 assert.equal(menu.open,false);
 assert.equal(focused,1,'keyboard focus returns to hamburger');
 menu.open=true;windowListeners.resize();
 assert.equal(menu.open,false,'desktop switch closes mobile drawer');
});

test('all public pages use one grouped navigation, deep footer and versioned assets',async()=>{
 for(const path of pages){
  const html=await read(path);
  const prefix=path.startsWith('kamera/blog/')?'../':'';
  for(const asset of ['marketing-navigation.css?v=1','marketing-navigation.mjs?v=1']){
   assert.ok(html.includes(prefix+asset),path+' missing '+asset);
  }
  assert.equal((html.match(/class="mktMobileMenu"/g)||[]).length,1,path);
  assert.equal((html.match(/class="mktMenuGroup /g)||[]).length,4,path);
  for(const title of ['Poznaj HOME SECURITY','Zacznij korzystać','Konto','Pomoc i dokumenty'])
   assert.ok(html.includes('aria-label="'+title+'"'),path+' group '+title);
  for(const href of ['polityka-prywatnosci.html','regulamin.html','rodo.html'])
   assert.ok(html.includes('href="'+prefix+href+'"'),path+' legal link '+href);
  assert.ok(html.includes('mktMobileNavigation'),path);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.filter(id=>id==='mktMobileNavigation').length,1,path);
 }
});

test('homepage puts only the essential five links in desktop header and deeper items in mobile menu',async()=>{
 const home=await read('design/marketing/home.html');
 const header=home.match(/<header class="mktHeader">([\s\S]*?)<\/header>/)?.[1];
 assert.ok(header);
 const top=header.match(/<nav aria-label="Nawigacja strony">([\s\S]*?)<\/nav>/)?.[1];
 assert.ok(top);
 assert.equal((top.match(/<a /g)||[]).length,5);
 for(const label of ['Jak działa','Możliwości','Pobierz','Poradniki','Pomoc'])assert.ok(top.includes(label));
 assert.ok(header.includes('aria-controls="mktMobileNavigation"'));
 assert.ok(header.includes('<details class="mktMobileMenu">'));
 assert.ok(header.includes('mktMenuTextOpen'));
 assert.ok(header.includes('mktMenuTextClosed'));
 const footer=home.match(/<footer class="mktFooter mktContainer">([\s\S]*?)<\/footer>/)?.[1];
 assert.ok(footer);
 assert.equal((footer.match(/<nav aria-label=/g)||[]).length,3);
 assert.ok(footer.includes('Informacja RODO'));
 assert.ok(footer.includes('Wydanie rozwojowe.'));
 for(const id of ['jak-dziala','mozliwosci','zobacz-panel','przygotowanie','specyfikacja','stan-projektu'])
  assert.ok(home.includes('id="'+id+'"'));
});

test('mobile navigation is legible, keyboard-accessible and supports reduced motion',async()=>{
 const css=await read('kamera/marketing-navigation.css');
 for(const part of ['@media(max-width:760px)', '.mktMobileMenu[open]', '.mktMenuBars i:first-child',
   '.mktMenuGroupLabel',':focus-visible','@media(prefers-reduced-motion:reduce)','min-height:46px'])
  assert.ok(css.includes(part),'missing CSS behavior '+part);
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
 const [sw,app,manifest]=await Promise.all(['kamera/sw.js','kamera/app.js','kamera/version.json'].map(read));
 assert.ok(sw.includes('./marketing-navigation.css?v=1'));
 assert.ok(sw.includes('./marketing-navigation.mjs?v=1'));
 assert.ok(sw.includes('kamera-domowa-shell-v151'));
 assert.ok(app.includes('SERVICE_WORKER_BUILD = "151"'));
 assert.equal(JSON.parse(manifest).version,'241');
 assert.ok(app.includes('const VERSION = "241"'));
});
