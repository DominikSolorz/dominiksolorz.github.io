import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'/tmp/home-security-public-review');
const read=name=>readFile(join(root,name),'utf8');
const manifest=JSON.parse(await read('review-manifest.json'));
const config=JSON.parse(await read('vercel.json'));
const html=await read('kamera/index.html');
const headers=Object.fromEntries(config.headers[0].headers.map(x=>[x.key,x.value]));
for(const [name,value] of Object.entries({'X-Frame-Options':'DENY','Cross-Origin-Opener-Policy':'same-origin'}))assert.equal(headers[name],value);
assert.ok(headers['Content-Security-Policy'].includes("frame-ancestors 'none'"));
assert.ok(headers['Content-Security-Policy'].includes("require-trusted-types-for 'script'"));
assert.ok(headers['Strict-Transport-Security'].includes('includeSubDomains; preload'));
assert.equal(config.headers[1].headers[0].value,'public, max-age=31536000, immutable');
for(const entry of manifest.assets){
 const bytes=await readFile(join(root,entry.path));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.hash);
 assert.ok(entry.path.includes(entry.hash));
}
for(const [,src,integrity] of html.matchAll(/<script[^>]*src="([^"]+)"[^>]*integrity="([^"]+)"/g)){
 const bytes=await readFile(join(root,src));const hash='sha256-'+createHash('sha256').update(bytes).digest('base64');
 assert.equal(integrity,hash);assert.ok(headers['Content-Security-Policy'].includes("'"+hash+"'"));
}
assert.doesNotMatch(html,/id="(?:authDialog|panelRuntime)"/);
assert.doesNotMatch(html,/<link[^>]*rel="stylesheet"/);
for(const route of ['panel.html?auth=login','panel.html?auth=register','pomoc.html'])assert.ok(html.includes('href="https://dominiksolorz.github.io/kamera/'+route+'"'));
assert.ok(html.includes('rel="canonical" href="https://dominiksolorz.github.io/kamera/"'),'Original canonical stays authoritative during review');
console.log('Public review checks passed: hashed assets, script integrity, security headers, isolated accounts and canonical.');
