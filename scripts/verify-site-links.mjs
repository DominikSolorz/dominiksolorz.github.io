// Verify local destinations and fragments for every shipped HTML document.
// Does not authenticate, submit forms, start cameras or remove recordings.
import {readFile,stat,writeFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pageInventory} from './audit-page-inventory.mjs';
const repository=fileURLToPath(new URL('../',import.meta.url));
const origin='https://dominiksolorz.github.io';
const documents=new Map(),issues=[],links=new Map();
for(const {path} of await pageInventory()){
 if(path.includes('?')||documents.has(path))continue;
 documents.set(path,await readFile(resolve(repository,'kamera',path),'utf8'));
}
for(const [page,html] of documents){
 const base=new URL('/kamera/'+page,origin);
 for(const match of html.matchAll(/\b(href|src)\s*=\s*["']([^"']+)["']/gi)){
  const raw=match[2].replaceAll('&amp;','&');
  if(/^(data:|blob:|mailto:|tel:)/i.test(raw))continue;
  let target;try{target=new URL(raw,base);}catch{issues.push({page,url:raw,error:'invalid URL'});continue;}
  if(target.origin!==origin)continue;
  let pathname;try{pathname=decodeURIComponent(target.pathname);}catch{issues.push({page,url:raw,error:'invalid encoding'});continue;}
  if(pathname.endsWith('/'))pathname+='index.html';
  const file=resolve(repository,'.'+pathname);
  if(relative(repository,file).startsWith('..')){issues.push({page,url:raw,error:'outside repository'});continue;}
  const key=pathname+target.hash;
  if(!links.has(key))links.set(key,{pathname,hash:target.hash,from:[]});links.get(key).from.push(page);
  try{
   if(!(await stat(file)).isFile())throw Error('not a file');
   if(target.hash&&pathname.endsWith('.html')){
    const content=await readFile(file,'utf8'),id=decodeURIComponent(target.hash.slice(1));
    if(![...content.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)].some(m=>m[1]===id))issues.push({page,url:raw,error:'missing fragment'});
   }
  }catch{issues.push({page,url:raw,error:'missing local destination'});}
 }
}
const result={pages:documents.size,links:links.size,issues};
if(process.argv.includes('--live')){
 const failures=[];const queue=[...links.values()].filter(x=>!x.hash);
 await Promise.all(Array.from({length:4},async()=>{for(let item;(item=queue.shift());){
  try{const response=await fetch(origin+item.pathname,{method:'HEAD',signal:AbortSignal.timeout(25000)});if(response.status!==200)failures.push({path:item.pathname,status:response.status});}
  catch(e){failures.push({path:item.pathname,error:e.name});}
 }}));result.liveFailures=failures;
}
await writeFile(resolve(repository,'site-links-report.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(issues.length||result.liveFailures?.length)process.exitCode=1;
