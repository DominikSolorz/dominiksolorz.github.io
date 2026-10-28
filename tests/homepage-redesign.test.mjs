import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=async path=>(await readFile(new URL('../'+path,import.meta.url),'utf8')).replaceAll('\r\n','\n');

test('homepage explains real use cases and privacy responsibilities without fictitious footage',async()=>{
 const [home,brochure]=await Promise.all(['design/marketing/home.html','kamera/o-systemie.html'].map(read));
 for(const html of [home,brochure]){
  for(const id of ['zobacz-panel','w-praktyce','zastosowania','prywatnosc','jak-dziala','specyfikacja','stan-projektu','wybierz-start','faq','asystent'])
   assert.ok(html.includes('id="'+id+'"'),id);
  for(const text of ['miniatury są schematami','SCHEMAT','folderu','Wydanie rozwojowe','nadajnika','nie transmisja z kamery'])
   assert.ok(html.includes(text),text);
  assert.ok(!html.includes('Kup teraz'),'website has no checkout');
  assert.ok(!html.includes('Odtwórz film'),'no fake video links');
 }
 const ids=[...home.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'no duplicate section IDs');
 for(const [,anchor] of home.matchAll(/href="#([^"]+)"/g))
  assert.ok(ids.includes(anchor),'missing destination: '+anchor);
});

test('new homepage conversion actions point to actual account and contact paths',async()=>{
 const home=await read('design/marketing/home.html');
 assert.ok(home.includes('href="panel.html?auth=register"'));
 assert.ok(home.includes('href="pomoc.html?temat=produkt"'));
 assert.ok(home.includes('href="#zobacz-panel"'));
 assert.ok(home.includes('data-hs-open-support'));
 assert.ok(home.includes('polityka-prywatnosci.html'));
 assert.ok(home.includes('rodo.html'));
 const app=await read('kamera/panel.html');
 assert.equal((app.match(/id="authDialog"/g)||[]).length,1);
 assert.equal((app.match(/id="app"/g)||[]).length,1);
});

test('responsive feature diagrams disclose illustration status and avoid false telemetry',async()=>{
 const [home,css]=await Promise.all(['design/marketing/home.html','kamera/marketing.css'].map(read));
 assert.equal((home.match(/class="mktScenarioCard"/g)||[]).length,3);
 assert.ok(home.includes('mktScenarioVisualFoot">OBRAZ · SCHEMAT'));
 assert.ok(home.includes('mktPrivacyNote'));
 assert.ok(css.includes('.mktScenarioGrid{display:grid'));
 assert.ok(css.includes('.mktPrivacyGrid{display:grid'));
 assert.ok(css.includes('@media(max-width:700px)'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
 assert.ok(css.includes('mktHeroFacts'));
});

test('standalone brochure and embedded public homepage match source',async()=>{
 const [src,app,brochure]=await Promise.all(['design/marketing/home.html','kamera/panel.html','kamera/o-systemie.html'].map(read));
 const slot=/<(?:section|div)(?: role="group")? id="publicHome"[\s\S]*?<\/(?:section|div)>(?=\s*<section id="authDialog")/;
 assert.equal(app.match(slot)?.[0],src.trimEnd());
 assert.ok(brochure.includes(src.trimEnd()));
 assert.ok(brochure.includes('Monitoring domu z podglądem na telefonie — HOME SECURITY'));
});

test('PWA shell and every marketing page have consistent revisions',async()=>{
 const paths=['kamera/panel.html','kamera/o-systemie.html','kamera/pomoc.html','kamera/blog/index.html','kamera/blog/pierwsze-uruchomienie.html','kamera/blog/zapis-lokalny-i-drive.html','kamera/blog/diagnostyka-monitoringu.html'];
 const content=await Promise.all(paths.map(read));
 const [sw,app,version,source]=await Promise.all(['kamera/sw.js','kamera/app.js','kamera/version.json','scripts/build-marketing.mjs'].map(read));
 const appVersion=JSON.parse(version).version;
 const shellVersion=app.match(/SERVICE_WORKER_BUILD = "(\d+)"/)?.[1];
 const cssVersion=content[0].match(/marketing\.css\?v=(\d+)/)?.[1];
 assert.ok(appVersion,'missing version manifest');
 assert.ok(shellVersion,'missing service-worker revision');
 assert.ok(cssVersion,'missing marketing CSS revision');
 for(let i=0;i<paths.length;i++)assert.ok(content[i].includes('marketing.css?v='+cssVersion),paths[i]);
 assert.ok(source.includes('marketing.css?v='+cssVersion));
 assert.ok(sw.includes('kamera-domowa-shell-v'+shellVersion));
 assert.ok(sw.includes('./marketing.css?v='+cssVersion));
 assert.ok(sw.includes('./app.js?v='+appVersion));
 assert.ok(app.includes('const VERSION = "'+appVersion+'"'));
 assert.ok(content[0].includes('app.js?v='+appVersion));
 assert.ok(content[0].includes('home-security-build" content="'+appVersion+'"'));
});
