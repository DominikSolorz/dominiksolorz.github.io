import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const out=resolve(process.argv[2]||'.vercel/output/static');
const manifest=JSON.parse(await readFile(join(out,'public-build.json'),'utf8'));
const publicVersion=JSON.parse(await readFile(join(out,'kamera/version.json'),'utf8')).version;
assert.equal(publicVersion,manifest.version);
for(const name of manifest.documents){
 const html=await readFile(join(out,'kamera',name),'utf8');
 assert(html.includes('home-security-build" content="'+publicVersion+'"'),'Public release metadata must agree: '+name);
 assert(html.includes('width=device-width,initial-scale=1'),'Browser chooses the responsive viewport: '+name);
 assert(!/maximum-scale|user-scalable=no/.test(html),'Browser zoom must remain available: '+name);
 if(html.includes('class="mktHeader"')){
  assert.equal((html.match(/<details class="mktMobileMenu">/g)||[]).length,1,'One phone disclosure per header: '+name);
  assert(html.includes('<summary aria-label="Otwórz lub zamknij menu nawigacji">'),'Phone menu is operable without JavaScript: '+name);
  const phone=html.match(/<details class="mktMobileMenu">[\s\S]*?<\/details>/)?.[0]||'';
  assert(phone.includes('auth=login')&&phone.includes('auth=register'),'Phone menu retains both account routes: '+name);
 }
}
const config=JSON.parse(await readFile(join(out,'vercel.json'),'utf8'));
const policy=config.headers[0].headers.find(h=>h.key==='Content-Security-Policy').value;
for(const asset of manifest.assets){const bytes=await readFile(join(out,asset.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.hash);}
for(const name of manifest.documents){
 const html=await readFile(join(out,'kamera',name),'utf8');
 assert(!html.includes('&amp;amp;'),'Public links must not double-encode query separators: '+name);
 if(name==='index.html'){assert(html.includes(manifest.legacy+'/kamera/#asystent'));assert.equal([...html.matchAll(/<script\b[^>]*\bsrc=/g)].length,1,'homepage has one bundled enhancement request');assert(html.includes('async fetchpriority="low"'));} 
 const apple=[...html.matchAll(/<link\b[^>]*rel="apple-touch-icon"[^>]*href="([^"]+)"[^>]*>/g)];
 assert.equal(apple.length,1,'one Apple icon per public page: '+name);
 const icon=await readFile(join(out,apple[0][1]));
 assert(icon.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Apple icon must be PNG');
 assert.equal(icon.readUInt32BE(16),180);assert.equal(icon.readUInt32BE(20),180);
 assert(!/id="(?:authDialog|panelRuntime)"/.test(html));
 assert(html.includes('rel="canonical" href="'+manifest.origin+'/kamera/'));
 for(const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
  const src=script[1].match(/src="([^"]+)"/);
  const code=src?await readFile(join(out,src[1])):script[2];
  const hash='sha256-'+createHash('sha256').update(code).digest('base64');
  assert(policy.includes("'"+hash+"'"),'Missing CSP hash in '+name);
  if(src)assert(script[1].includes('integrity="'+hash+'"'));
 }
}
for(const name of ['panel.html','pomoc.html']){
 const html=await readFile(join(out,'kamera',name),'utf8');
 assert(!html.includes('&amp;amp;'),'Public links must not double-encode query separators: '+name);let target;
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{URL,location:{search:'?test=1',hash:'#test',replace:v=>target=v}});
 assert.equal(target,manifest.legacy+'/kamera/'+name+'?test=1#test');
}
assert(policy.includes("frame-ancestors 'none'"));assert(policy.includes("require-trusted-types-for 'script'"));
assert(config.headers.some(r=>r.source==='/_assets/(.*)'&&r.headers.some(h=>h.value.includes('31536000, immutable'))));
const sitemap=await readFile(join(out,'kamera/sitemap.xml'),'utf8');assert.equal([...sitemap.matchAll(/<loc>/g)].length,7);assert(!sitemap.includes(manifest.legacy));
const routes=JSON.parse(await readFile(resolve(out,'../config.json'),'utf8')).routes;
for(const route of routes)if(route.src){assert(!route.src.includes(':file'));new RegExp(route.src);}
console.log('Verified '+manifest.documents.length+' public documents, '+manifest.assets.length+' content hashes, CSP, SRI, redirect state, sitemap and HTTP routes.');
