// Vercel Build Output API: config and fingerprints are generated from the same exact bytes.
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),images='/tmp/home-security-public-images',output=resolve(root,'.vercel/output/static');
for(const args of [['scripts/optimize-marketing-images.mjs',images],['hosting/public-site/build.mjs',output,images]]){
 const run=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(run.status!==0)process.exit(run.status||1);
}
const config=JSON.parse(await readFile(resolve(output,'vercel.json'),'utf8'));
const routes=[];
for(const entry of config.headers)routes.push({src:entry.source.replace('/kamera/:file((?:version|desktop-update)\\.json)','/kamera/(?:version|desktop-update)\\.json'),headers:Object.fromEntries(entry.headers.map(h=>[h.key,h.value])),continue:true});
for(const entry of config.redirects)routes.push({src:entry.source==='/'?'^/$':'^'+entry.source+'$',status:307,headers:{Location:entry.destination},continue:false});
for(const entry of config.rewrites)routes.push({src:'^'+entry.source+'$',dest:entry.destination});
routes.push({handle:'filesystem'});
await mkdir(resolve(root,'.vercel/output'),{recursive:true});await writeFile(resolve(root,'.vercel/output/config.json'),JSON.stringify({version:3,routes},null,2)+'\n');
