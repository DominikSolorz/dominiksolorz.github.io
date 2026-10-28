// Every shipped HTML document, including legal pages and the protected application.
import {readdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../kamera/',import.meta.url);
export async function pageInventory(){
 const targets=[];
 async function walk(directory,prefix=''){
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   if(entry.isDirectory()&&entry.name==='blog')await walk(new URL(entry.name+'/',directory),prefix+entry.name+'/');
   if(!entry.isFile()||!entry.name.endsWith('.html'))continue;
   const path=prefix+entry.name,html=await readFile(new URL(entry.name,directory),'utf8');
   targets.push({id:path.replace(/[^a-z0-9]+/gi,'-'),path,indexable:!/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html)});
  }
 }
 await walk(root);
 targets.push({id:'public-phone',path:'?ui=phone',indexable:true},{id:'panel-phone',path:'panel.html?ui=phone',indexable:false},{id:'panel-login',path:'panel.html?auth=login',indexable:false},{id:'panel-register',path:'panel.html?auth=register',indexable:false},{id:'panel-owner-phone',path:'panel.html?panel=owner&ui=phone',indexable:false});
 return targets;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify({include:await pageInventory()}));
