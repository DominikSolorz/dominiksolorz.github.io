import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pageInventory} from '../scripts/audit-page-inventory.mjs';
test('audit covers every sitemap document, footer document, and exact reported private phone URL',async()=>{
 const entries=await pageInventory(),paths=new Set(entries.map(x=>x.path));
 const xml=await readFile(new URL('../kamera/sitemap.xml',import.meta.url),'utf8');
 for(const [,url] of xml.matchAll(/<loc>(.*?)<\/loc>/g)){
  const path=new URL(url).pathname.replace('/kamera/','')||'index.html';assert.ok(paths.has(path),path);
 }
 const home=await readFile(new URL('../kamera/index.html',import.meta.url),'utf8');
 for(const [,href] of home.matchAll(/href="([^"#?]+\.html)(?:[?#][^"]*)?"/g))assert.ok(paths.has(href),href);
 for(const path of ['panel.html?ui=phone','panel.html?auth=login','panel.html?auth=register','panel.html?panel=owner&ui=phone'])assert.equal(entries.find(x=>x.path===path)?.indexable,false,path);
 assert.equal(new Set(entries.map(x=>x.id)).size,entries.length);
});
