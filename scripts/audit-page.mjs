// Executed by the audit runner against the deployed site. Never authenticates or opens devices.
import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises';
const target=JSON.parse(process.env.AUDIT_TARGET);
if(!/^[a-z0-9-]+$/i.test(target.id)||!/^([a-z0-9/?=&.-]+)$/i.test(target.path))throw Error('Invalid audit target');
await mkdir('lighthouse-results',{recursive:true});
const rows=[];
for(const mode of ['desktop','mobile']){
 const output=`lighthouse-results/${target.id}-${mode}.json`;
 const args=[new URL('../node_modules/lighthouse/cli/index.js',import.meta.url).pathname,new URL(target.path,'https://dominiksolorz.github.io/kamera/').href,
 '--only-categories=performance,accessibility,best-practices,seo','--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage','--output=json',`--output-path=${output}`,'--quiet'];
 if(mode==='desktop')args.push('--preset=desktop');
 const result=spawnSync(process.execPath,args,{stdio:'inherit',timeout:180000});
 if(result.status!==0)throw Error(`Lighthouse failed: ${target.path} ${mode}`);
 const report=JSON.parse(await readFile(output,'utf8'));
 if(report.runtimeError)throw Error(JSON.stringify(report.runtimeError));
 const failures=Object.entries(report.audits).filter(([,a])=>a.score===0).map(([id,a])=>({id,title:a.title,details:a.details}));
 rows.push({path:target.path,mode,url:report.finalDisplayedUrl||report.finalUrl,indexable:target.indexable,scores:Object.fromEntries(Object.entries(report.categories).map(([k,v])=>[k,Math.round(v.score*100)])),failures});
}
await writeFile(`lighthouse-results/${target.id}-summary.json`,JSON.stringify(rows,null,2));
const markdown=rows.map(r=>`| ${r.path} | ${r.mode} | ${Object.values(r.scores).join(' | ')} | ${r.indexable?'publiczna':'noindex / techniczna'} |`).join('\n');
console.log(markdown);
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'| Adres | Tryb | Wydajność | Dostępność | Praktyki | SEO | Indeksowanie |\n|---|---|---:|---:|---:|---:|---|\n'+markdown+'\n\nNiższe SEO strony noindex nie jest automatycznie błędem. Szczegóły wszystkich niezaliczonych punktów zapisano w raporcie JSON.\n');
