import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const legal=['polityka-prywatnosci','rodo','regulamin','zasady-korzystania','instrukcja','dokumenty'];

test('all six generated public legal documents include exactly one real 180px Apple icon',async()=>{
 const icon=await readFile(new URL('../kamera/icons/apple-touch-icon.png',import.meta.url));
 assert.deepEqual([...icon.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 assert.equal(icon.readUInt32BE(16),180);
 assert.equal(icon.readUInt32BE(20),180);
 for(const page of legal){
  const html=await read('kamera/'+page+'.html');
  const tags=[...html.matchAll(/<link\b[^>]*rel="apple-touch-icon"[^>]*>/g)].map(m=>m[0]);
  assert.equal(tags.length,1,page+' must have exactly one Apple icon');
  assert.match(tags[0],/href="icons\/apple-touch-icon\.png"/);
  assert.match(tags[0],/sizes="180x180"/);
 }
});

test('document generator includes the Apple icon so publishing cannot erase this fix',async()=>{
 const builder=await read('scripts/build-documents.mjs');
 assert.equal((builder.match(/rel="apple-touch-icon"/g)||[]).length,1);
 assert.ok(builder.includes('href="icons/apple-touch-icon.png"'));
});

test('Vercel build verifies public Apple icons after asset fingerprinting',async()=>{
 const builder=await read('hosting/public-site/vercel-build.mjs');
 const verification=await read('hosting/public-site/verify.mjs');
 assert.ok(builder.includes('hosting/public-site/verify.mjs'));
 assert.ok(verification.includes('one Apple icon per public page'));
 assert.ok(verification.includes("icon.readUInt32BE(16),180"));
});
