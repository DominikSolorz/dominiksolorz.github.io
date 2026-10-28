// Summarize actual Lighthouse results. Missing results must fail rather than pretend success.
import {readFile,appendFile} from 'node:fs/promises';
const reportFiles=[
 ['Panel /kamera/ — desktop','lighthouse-results/root-desktop.json'],
 ['Strona /o-systemie.html — desktop','lighthouse-results/marketing-desktop.json'],
 ['Strona /o-systemie.html — mobile','lighthouse-results/marketing-mobile.json']
];
const rows=[],opportunities=[];
const format=(audit)=>audit?.displayValue || (audit?.numericValue===undefined?'—':String(Math.round(audit.numericValue)));
const score=x=>Math.round((x?.score??0)*100);
for(const [name,path] of reportFiles){
 const report=JSON.parse(await readFile(path,'utf8'));
 if(!report.lighthouseVersion||!report.categories?.performance||!report.audits?.['largest-contentful-paint'])throw new Error('Incomplete Lighthouse results: '+path);
 const a=report.audits;
 rows.push({name,url:report.finalDisplayedUrl||report.finalUrl||report.requestedUrl,
  lighthouse:report.lighthouseVersion,
  performance:score(report.categories.performance),
  accessibility:score(report.categories.accessibility),
  practices:score(report.categories['best-practices']),
  seo:score(report.categories.seo),
  fcp:format(a['first-contentful-paint']),lcp:format(a['largest-contentful-paint']),
  tbt:format(a['total-blocking-time']),cls:format(a['cumulative-layout-shift']),
  bytes:Math.round((a['total-byte-weight']?.numericValue||0)/1024)
 });
 const expensive=Object.values(a).filter(x=>x?.details?.type==='opportunity'&&x.details.overallSavingsMs>50)
  .sort((x,y)=>(y.details.overallSavingsMs||0)-(x.details.overallSavingsMs||0)).slice(0,7);
 opportunities.push({name,top:expensive.map(x=>({title:x.title,savingsMs:Math.round(x.details.overallSavingsMs)}))});
}
const markdown=['## HOME SECURITY — real Lighthouse results','',
 '| Audyt | Performance | A11y | Best practices | SEO | FCP | LCP | TBT | CLS | Transfer |',
 '|---|---:|---:|---:|---:|---|---|---|---|---:|',
 ...rows.map(x=>`| ${x.name} | ${x.performance} | ${x.accessibility} | ${x.practices} | ${x.seo} | ${x.fcp} | ${x.lcp} | ${x.tbt} | ${x.cls} | ${x.bytes} KiB |`),
 '',
 'This is a Lighthouse lab measurement from GitHub Actions, not the Google PageSpeed report or real-user CrUX field data.',
 '',
 ...opportunities.flatMap(o=>['### '+o.name,...(o.top.length?o.top.map(i=>'- '+i.title+' — potential saving '+i.savingsMs+' ms'):['- No significant classic opportunity audit returned']), '']),
 ''];
const body=markdown.join('\n');
console.log(body);
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,body);
