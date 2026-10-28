import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const bridge=await read('kamera/public-entry.js');
function redirect(path,{native=false,pending=false,installed=false,storageBlocked=false}={}){
 const url=new URL(path,'https://dominiksolorz.github.io');let result;
 const location={href:url.href,search:url.search,hash:url.hash,replace:target=>{result=target;}};
 vm.runInNewContext(bridge,{location,URL,URLSearchParams,navigator:{},
  window:{__HOME_SECURITY_DESKTOP__:native,matchMedia:()=>({matches:installed})},
  sessionStorage:{getItem:()=>{if(storageBlocked)throw Error('private mode');return pending?'ticket':null;}}});
 return result;
}
test('public entries render the up-to-date local marketing page without redirecting to a stale mirror',()=>{
 for(const path of ['/kamera/','/kamera/?ui=phone','/kamera/?ui=computer','/kamera/index.html#faq','/kamera/?view=desktop','/kamera/?odbiorca=invalid']){
  assert.equal(redirect(path),undefined,path);
  assert.equal(redirect(path,{storageBlocked:true}),undefined,path);
 }
});
test('legacy auth, receiver and OAuth returns preserve their full query and fragment on the same origin',()=>{
 for(const suffix of ['?auth=login&ui=phone','?auth=register','?auth=forgot','?code=example&state=example',
   '?odbiorca=cam-'+'a'.repeat(32),'#nadaj','#access_token=example&refresh_token=example','#type=recovery&access_token=example','#error=access_denied','?panel=owner&ui=phone','?app=android']){
  assert.equal(redirect('/kamera/'+suffix),'https://dominiksolorz.github.io/kamera/panel.html'+suffix);
 }
 // Untrusted return destinations are never used for navigation.
 assert.equal(new URL(redirect('/kamera/?auth=login&redirect=https://example.org')).origin,'https://dominiksolorz.github.io');
});
test('native, installed and pending entry launches retain the private panel',()=>{
 for(const options of [{native:true},{installed:true},{pending:true}])
  assert.equal(redirect('/kamera/?ui=phone',options),'https://dominiksolorz.github.io/kamera/panel.html?ui=phone');
});
test('homepage HTML is indexable without JavaScript and contains no private account or camera runtime',async()=>{
 const html=await read('kamera/index.html');
 assert.match(html,/<meta name="robots" content="index,follow">/);
 assert.match(html,/<link rel="canonical" href="https:\/\/dominiksolorz.github.io\/kamera\/">/);
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
 assert.ok(html.includes('<h1>')&&html.includes('name="description"'));
 for(const token of ['id="authDialog"','id="app"','id="panelRuntime"','src="auth.js','src="app.js','src="vendor/supabase'])assert.ok(!html.includes(token),token);
 for(const [,href] of html.matchAll(/href="([^"]*\?auth=(?:login|register))"/g))assert.ok(href.startsWith('panel.html?'),href);
});
test('sitemap contains only unique indexable canonical pages, never panel, query aliases or drafts',async()=>{
 const sitemap=await read('kamera/sitemap.xml');
 const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
 assert.equal(urls.length,7);assert.equal(new Set(urls).size,urls.length);
 for(const href of urls){
  const url=new URL(href);assert.equal(url.origin,'https://dominiksolorz.github.io');assert.equal(url.search,'');
  const path=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
  const html=await read(path.slice(1));
  assert.ok(html.includes('content="index,follow"'),path);
  assert.ok(html.includes('rel="canonical" href="'+href+'"'),path);
 }
 const alias=await read('kamera/o-systemie.html');
 assert.ok(alias.includes('rel="canonical" href="https://dominiksolorz.github.io/kamera/"'));
 for(const path of ['panel.html','polityka-prywatnosci.html','regulamin.html','rodo.html']){
  assert.ok((await read('kamera/'+path)).includes('content="noindex,'),path);assert.ok(!sitemap.includes(path),path);
 }
 assert.ok(!(await read('robots.txt')).includes('Disallow: /kamera/'),'crawlers must read noindex and canonical directives');
});
test('installed PWA identity and callback allow-list destination survive document separation',async()=>{
 const manifest=JSON.parse(await read('kamera/manifest.webmanifest'));
 assert.equal(manifest.id,'/kamera/owner-panel');
 for(const href of [manifest.start_url,...manifest.shortcuts.map(item=>item.url)])assert.equal(new URL(href,'https://dominiksolorz.github.io/kamera/').pathname,'/kamera/panel.html');
 const auth=await read('kamera/auth.js');
 const callback=auth.match(/const callbackUrl = (\(\) => [^;]+);/)[1];
 const fn=vm.runInNewContext(callback,{URL,location:{href:'https://dominiksolorz.github.io/kamera/panel.html?auth=register'}});
 assert.equal(fn(),'https://dominiksolorz.github.io/kamera/');
});
