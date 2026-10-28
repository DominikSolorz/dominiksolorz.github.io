// Executed against deployed pages. Never authenticates, submits forms or opens devices.
import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile,appendFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export const transientLighthouseFailure = value =>
 /NO_FCP|NO_NAVSTART|PROTOCOL_TIMEOUT|CHROME_INTERSTITIAL_ERROR|waiting for dynamic debugging port|Unable to connect to Chrome|ChromeLauncher|Chrome did not start|The page did not paint any content|timed out waiting for browser|Failed to launch the browser process/i
 .test(String(value||''));

export async function auditPage(target,{spawn=spawnSync,read=readFile,remove=rm,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),write=writeFile,append=appendFile,dir='lighthouse-results'}={}){
 if(!target||!/^[a-z0-9-]+$/i.test(target.id)||!/^([a-z0-9/?=&.-]+)$/i.test(target.path))throw Error('Invalid audit target');
 await mkdir(dir,{recursive:true});
 const rows=[];
 for(const mode of ['desktop','mobile']){
  const output=`${dir}/${target.id}-${mode}.json`;
  const args=[fileURLToPath(new URL('../node_modules/lighthouse/cli/index.js',import.meta.url)),
   new URL(target.path,'https://dominiksolorz.github.io/kamera/').href,
   '--only-categories=performance,accessibility,best-practices,seo',
   '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage --disable-background-networking --disable-extensions --no-first-run',
   '--output=json',`--output-path=${output}`,'--max-wait-for-load=60000','--quiet'];
  if(mode==='desktop')args.push('--preset=desktop');
  let report=null,lastFailure='';
  for(let attempt=1;attempt<=3;attempt++){
   await remove(output,{force:true});
   const result=spawn(process.execPath,args,{encoding:'utf8',timeout:180000,maxBuffer:5*1024*1024});
   let resultText=(result.stdout||'')+'\n'+(result.stderr||'')+'\n'+(result.error?.message||'');
   if(result.status===0){
    try{
     report=JSON.parse(await read(output,'utf8'));
     if(report.runtimeError){
      resultText+='\n'+JSON.stringify(report.runtimeError);
      report=null;
     }
    }catch(error){
     resultText+='\n'+String(error);
     report=null;
    }
   }
   if(report)break;
   lastFailure=resultText.slice(-4500);
   const transient=transientLighthouseFailure(resultText)||
    (result.status===0&&/NO_FCP|NO_NAVSTART|PROTOCOL_TIMEOUT/.test(resultText));
   if(!transient||attempt===3){
    throw Error(`Lighthouse failed: ${target.path} ${mode}, attempt ${attempt}/3, status ${result.status}\n${lastFailure}`);
   }
   console.warn(`Lighthouse transient Chrome error: ${target.path} ${mode}; retry ${attempt}/2 (new Chrome instance)`);
   await wait(2500*attempt);
  }
  const failures=Object.entries(report.audits).filter(([,a])=>a.score===0).map(([id,a])=>({id,title:a.title,details:a.details}));
  rows.push({path:target.path,mode,url:report.finalDisplayedUrl||report.finalUrl,indexable:target.indexable,
   scores:Object.fromEntries(Object.entries(report.categories).map(([k,v])=>[k,Math.round(v.score*100)])),failures});
 }
 await write(`${dir}/${target.id}-summary.json`,JSON.stringify(rows,null,2));
 const markdown=rows.map(r=>`| ${r.path} | ${r.mode} | ${Object.values(r.scores).join(' | ')} | ${r.indexable?'publiczna':'noindex / techniczna'} |`).join('\n');
 console.log(markdown);
 if(process.env.GITHUB_STEP_SUMMARY)await append(process.env.GITHUB_STEP_SUMMARY,
  '| Adres | Tryb | Wydajność | Dostępność | Praktyki | SEO | Indeksowanie |\n|---|---|---:|---:|---:|---:|---|\n'+markdown+'\n\nNiższe SEO strony noindex nie jest automatycznie błędem. Szczegóły niezaliczonych punktów: raport JSON.\n');
 return rows;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 await auditPage(JSON.parse(process.env.AUDIT_TARGET||'null'));
}
