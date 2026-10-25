import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../kamera/sw.js',import.meta.url),'utf8');
async function navigate(path,{offline=false,cacheFailure=false,cached}={}){
 const events={},writes=[],matches=[];
 const scope={self:{location:new URL('https://dominiksolorz.github.io/kamera/sw.js'),addEventListener:(name,fn)=>events[name]=fn},URL,Response,
  fetch:async()=>{if(offline)throw Error('offline');return new Response('<h1>real page</h1>',{headers:{'content-type':'text/html'}});},
  caches:{open:async()=>({put:async(key)=>{if(cacheFailure)throw Error('quota');writes.push(key);}}),match:async(key)=>{matches.push(key);return cached?new Response(cached):undefined;}}};
 vm.runInNewContext(source,scope);let response;
 events.fetch({request:{url:'https://dominiksolorz.github.io'+path,method:'GET',mode:'navigate'},respondWith:promise=>response=promise});
 return {response:await response,writes,matches};
}
test('blog navigation never replaces the cached panel document',async()=>{
 const value=await navigate('/kamera/blog/pierwsze-uruchomienie.html');
 assert.deepEqual(value.writes,['https://dominiksolorz.github.io/kamera/blog/pierwsze-uruchomienie.html']);
});
test('account navigation retains one query-free panel cache key',async()=>{
 assert.deepEqual((await navigate('/kamera/?auth=login')).writes,['./index.html']);
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
