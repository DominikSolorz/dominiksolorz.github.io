import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const topics=JSON.parse(await read('design/marketing/pages.json'));

test('homepage is an introduction and topic content has independent indexable URLs',async()=>{
 const home=await read('kamera/index.html');
 for(const id of ['mozliwosci','jak-dziala','specyfikacja','stan-projektu','przygotowanie','faq','galeria'])assert.ok(!home.includes('id="'+id+'"'),'full topic must not remain on homepage: '+id);
 assert.ok(home.includes('href="pobierz.html"'));
 const sitemap=await read('kamera/sitemap.xml');
 for(const topic of topics){
  const file=topic.slug+'.html',page=await read('kamera/'+file);
  assert.ok(page.includes('rel="canonical" href="https://dominiksolorz.github.io/kamera/'+file+'"'));
  assert.equal((page.match(/<h1\b/g)||[]).length,1,file+' has one topic heading');
  assert.ok(page.includes('href="./"'),file+' has a way back home');
  assert.ok(sitemap.includes('/kamera/'+file+'</loc>'));
  assert.ok(!/src="(?:auth|app|desktop|mobile)\.js/.test(page),'public pages must not load private camera runtime');
 }
});

test('header and footer navigate to pages instead of old homepage sections',async()=>{
 for(const file of ['index.html','pobierz.html','kontakt.html','galeria.html','pomoc.html','blog/index.html',...topics.map(p=>p.slug+'.html')]){
  const page=await read('kamera/'+file);
  const navigation=[page.match(/<header class="mktHeader">[\s\S]*?<\/header>/)?.[0],page.match(/<footer class="mktFooter mktContainer">[\s\S]*?<\/footer>/)?.[0]].join('');
  assert.ok(navigation.includes('href='),file);
  for(const [,href] of navigation.matchAll(/href="([^"]+)"/g)){
   const url=new URL(href,'https://dominiksolorz.github.io/kamera/'+file);
   assert.equal(url.hash,'',file+' must link to a page: '+href);
   url.search='';
   const local=new URL('.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''),root);
   assert.ok((await stat(local)).isFile(),file+' links to missing page '+href);
  }
 }
});

test('old public section bookmarks open topic pages and private entry stays protected',async()=>{
 const script=await read('kamera/public-entry.js');
 const resolve=address=>{
  const url=new URL(address);let destination=null;
  const location={href:url.href,search:url.search,hash:url.hash,replace:v=>{destination=v;}};
  vm.runInNewContext(script,{URL,URLSearchParams,location,sessionStorage:{getItem:()=>null},window:{matchMedia:()=>({matches:false})},navigator:{standalone:false}});
  return destination;
 };
 assert.equal(resolve('https://dominiksolorz.github.io/kamera/#jak-dziala'),'https://dominiksolorz.github.io/kamera/jak-dziala.html');
 assert.equal(resolve('https://dominiksolorz.github.io/kamera/#specyfikacja'),'https://dominiksolorz.github.io/kamera/wymagania.html');
 const privateEntry=new URL(resolve('https://dominiksolorz.github.io/kamera/?auth=login#jak-dziala'));
 assert.equal(privateEntry.pathname,'/kamera/panel.html');assert.equal(privateEntry.search,'?auth=login');
 assert.equal(resolve('https://dominiksolorz.github.io/kamera/'),null);
});
