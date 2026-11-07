import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../kamera/sw.js',import.meta.url),'utf8');
async function navigate(path,{offline=false,cacheFailure=false,cached}={}){
 const events={},writes=[],matches=[],requestModes=[];
 const scope={self:{location:new URL('https://dominiksolorz.github.io/kamera/sw.js'),addEventListener:(name,fn)=>events[name]=fn},URL,Response,
  fetch:async(_request,options)=>{requestModes.push(options?.cache||'default');if(offline)throw Error('offline');return new Response('<h1>real page</h1>',{headers:{'content-type':'text/html'}});},
  caches:{open:async()=>({put:async(key)=>{if(cacheFailure)throw Error('quota');writes.push(key);}}),match:async(key)=>{matches.push(key);return cached?new Response(cached):undefined;}}};
 vm.runInNewContext(source,scope);let response;
 events.fetch({request:{url:'https://dominiksolorz.github.io'+path,method:'GET',mode:'navigate'},respondWith:promise=>response=promise});
 return {response:await response,writes,matches,requestModes};
}
test('blog navigation never replaces the cached panel document',async()=>{
 const value=await navigate('/kamera/blog/pierwsze-uruchomienie.html');
 assert.deepEqual(value.writes,['https://dominiksolorz.github.io/kamera/blog/pierwsze-uruchomienie.html']);
});
test('account navigation retains one query-free panel cache key',async()=>{
 assert.deepEqual((await navigate('/kamera/panel.html?auth=login')).writes,['./panel.html']);
});
test('offline article uses its own cached document, not a private panel or another article',async()=>{
 const value=await navigate('/kamera/blog/zapis-lokalny-i-drive.html',{offline:true,cached:'saved article'});
 assert.equal(await value.response.text(),'saved article');
 assert.deepEqual(value.matches,['https://dominiksolorz.github.io/kamera/blog/zapis-lokalny-i-drive.html']);
});
test('cache quota failure never turns a successful network navigation into an error',async()=>{
 const value=await navigate('/kamera/pomoc.html',{cacheFailure:true});assert.equal(value.response.status,200);
});
test('uncached offline public page gives an honest 503 response',async()=>{
 const value=await navigate('/kamera/blog/index.html',{offline:true});assert.equal(value.response.status,503);
});

test('public homepage and private panel never share an offline document cache key',async()=>{
 assert.deepEqual((await navigate('/kamera/?ui=phone')).writes,['./index.html']);
 assert.deepEqual((await navigate('/kamera/panel.html?auth=register')).writes,['./panel.html']);
 const home=await navigate('/kamera/?ui=phone',{offline:true,cached:'public home'});
 assert.deepEqual(home.matches,['./index.html']);
 const panel=await navigate('/kamera/panel.html?auth=login',{offline:true,cached:'panel'});
 assert.deepEqual(panel.matches,['./panel.html']);
});

test('a browser update bypasses stale HTML cache, preserving the authenticated panel route',async()=>{
 const value=await navigate('/kamera/panel.html?auth=login&hs_release=240&hs_refresh=123');
 assert.equal(value.response.status,200);
 assert.deepEqual(value.requestModes,['no-store']);
 assert.deepEqual(value.writes,['./panel.html'],'new HTML replaces old panel cache key');
});
test('a failed online update must not silently return an older cached screen',async()=>{
 const value=await navigate('/kamera/o-systemie.html?hs_release=240',{offline:true,cached:'outdated page'});
 assert.equal(value.response.status,503);
 assert.deepEqual(value.requestModes,['no-store']);
 assert.deepEqual(value.matches,[],'stale offline page must never be treated as an update');
});
