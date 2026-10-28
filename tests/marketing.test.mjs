import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),base=new URL('kamera/',root);
const read=name=>readFile(new URL(name,base),'utf8');
const posts=JSON.parse(await readFile(new URL('design/marketing/posts.json',root),'utf8'));
const pages=['index.html','o-systemie.html','galeria.html','pomoc.html','blog/index.html',...posts.map(post=>'blog/'+post.slug+'.html')];
test('public marketing is generated from one source without replacing the private panel',()=>{
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/build-marketing.mjs',import.meta.url)),'--check'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.error?.message);
});
test('landing page includes actual product depth, not dead section buttons',async()=>{
 const html=await read('panel.html');
 for(const id of ['mozliwosci','jak-dziala','specyfikacja','stan-projektu','poradniki','faq'])assert.ok(html.includes('id="'+id+'"'));
 assert.equal((html.match(/id="authDialog"/g)||[]).length,1);assert.equal((html.match(/id="app"/g)||[]).length,1);
 assert.ok(html.includes('marketing.css?v=13'));assert.ok(html.includes('id="publicHome"'));
});
test('public articles and brochure do not load recorder or account runtime',async()=>{
 for(const page of pages){const html=await read(page);assert.ok(!/src="(?:\.\.\/)?(?:app|auth|desktop|mobile)\.js/.test(html),page);assert.ok(html.includes('lang="pl"'));assert.ok(html.includes('rel="canonical"'));assert.ok(html.includes('name="description"'));}
});
test('every marketing navigation and asset link resolves to an existing local file',async()=>{
 for(const page of pages){
  const html=await read(page);
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   const href=match[1];if(/^(?:https?:|mailto:|#)/.test(href))continue;
   const url=new URL(href,new URL(page,base));url.search='';url.hash='';
   if(url.pathname.endsWith('/'))url.pathname+='index.html';
   assert.ok((await stat(url)).isFile(),page+' → '+href);
  }
 }
});
test('all brochure section anchors exist',async()=>{
 const html=await read('o-systemie.html');
 for(const match of html.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes('id="'+match[1]+'"'),match[1]);
});
test('login links from every public page target the real panel, not the current article',async()=>{
 for(const page of pages){
  const html=await read(page);const links=[...html.matchAll(/href="([^"]*\?auth=login)"/g)];assert.ok(links.length>0,page);
  for(const match of links){const target=new URL(match[1],new URL(page,base));assert.equal(target.pathname,base.pathname+"panel.html",page);}
 }
});
test('contact form sends to its backend and requires a confirmed receipt',async()=>{
 const [html,js]=await Promise.all(['pomoc.html','marketing-contact.js'].map(read));
 assert.ok(html.includes('Wyślij wiadomość'));assert.ok(!html.includes('Przygotuj wiadomość'));
 assert.ok(js.includes('fetch(form.action'));assert.ok(js.includes("receipt.status!=='sent'"));assert.ok(js.includes('receipt.requestId!==payload.requestId'));
 assert.ok(!js.includes('innerHTML'));assert.ok(!js.includes('mailto:'));
 assert.ok(html.includes('functions/v1/home-contact'));assert.ok(html.includes('id="mktSendMessage" type="submit" disabled'));
 assert.ok(html.includes('name="surname"'));assert.ok(html.includes('name="consent"'));assert.ok(js.includes('submit.disabled=false'));
});
test('marketing distinguishes available features from incomplete integrations and app-store releases',async()=>{
 const html=await read('o-systemie.html');
 for(const text of ['Wydanie rozwojowe','W INTEGRACJI','Nie ma jeszcze opublikowanych aplikacji','niezależnego od otwartego panelu'])assert.ok(html.includes(text),text);
});
test('public downloads match the current installer release',async()=>{
 const version=JSON.parse(await read('desktop-update.json')).version;
 for(const page of ['index.html','o-systemie.html']){
  const html=await read(page);const links=[...html.matchAll(/downloads\/HOME-SECURITY-Desktop-Setup-([\d.]+)\.exe/g)];
  assert.ok(links.length>0);for(const link of links)assert.equal(link[1],version);
 }
});
test('cached marketing asset versions match every generated page',async()=>{
 const sw=await read('sw.js');const index=await read('panel.html');
 const css=index.match(/marketing\.css\?v=\d+/)[0];assert.ok(sw.includes('./'+css));
 for(const page of pages)assert.ok((await read(page)).includes(css),page);
 const contact=(await read('pomoc.html')).match(/marketing-contact\.js\?v=\d+/)[0];assert.ok(sw.includes('./'+contact));
});
