import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('website redesign is applied to the public source, generated pages and embedded landing without replacing the camera app',async()=>{
  const [home,panel,index,brochure]=await Promise.all(['design/marketing/home.html','kamera/panel.html','kamera/index.html','kamera/o-systemie.html'].map(read));
  const source=home.trimEnd();
  for(const page of [panel,index,brochure]){
    for(const marker of ['id="mktPublicFeaturesTitle"','class="mktPublicPreview"','id="mktPublicJourneyTitle"','id="mktPublicFinalTitle"']){
      assert.ok(page.includes(marker),marker);
    }
    assert.ok(page.includes(source),'generated marketing page must match source exactly');
  }
  const slot=/<(?:section|div)(?: role="group")? id="publicHome"[\s\S]*?<\/(?:section|div)>(?=\s*<section id="authDialog")/;
  assert.equal(panel.match(slot)?.[0],source,'secure panel public slot is regenerated from public template');
  assert.match(panel,/id="lock"/);
  assert.match(panel,/id="app" hidden/);
  assert.match(panel,/id="ctrlStart"/);
  assert.match(panel,/id="ctrlStop"/);
  assert.match(panel,/<video id="video" autoplay playsinline muted>/);
});

test('public feature preview is explicitly illustrative and every call-to-action leads to an existing route',async()=>{
  const source=await read('design/marketing/home.html');
  assert.match(source,/To nie jest rzeczywisty obraz ani aktywna transmisja/);
  assert.match(source,/HOME SECURITY jest projektem rozwojowym/);
  assert.match(source,/nie zastępuje certyfikowanego systemu alarmowego/);
  for(const path of ['prezentacja.html','pobierz.html','przygotowanie.html','stan-projektu.html','panel.html?auth=login']){
    assert.ok(source.includes('href="'+path+'"'),path);
  }
  assert.doesNotMatch(source,/Kup teraz|Odtwórz film|fałszywa transmisja/i);
});

test('new site visual layer stays public-only, responsive and accessible',async()=>{
  const css=await read('kamera/marketing.css');
  const newCss=css.split('/* HOME SECURITY WWW Premium Dark Pro')[1];
  assert.ok(newCss,'missing new website theme');
  assert.ok(newCss.includes('#publicHome.mktSite,.marketingPage'));
  assert.ok(newCss.includes('.mktPublicFeatureGrid'));
  assert.ok(newCss.includes('.mktPublicJourneyLayout'));
  assert.ok(newCss.includes('.mktPublicFinal'));
  assert.ok(newCss.includes('@media(max-width:760px)'));
  assert.ok(newCss.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(newCss.includes('focus-visible')||css.includes(':focus-visible'));
  assert.ok(!newCss.includes('#app'),'new public CSS must not override private camera workspace');
  assert.ok(!newCss.includes('object-fit:cover'),'new CSS must never crop actual camera frames');
  assert.equal((newCss.match(/\{/g)||[]).length,(newCss.match(/\}/g)||[]).length,'CSS curly braces match');
});

test('PWA refreshes marketing appearance without changing versioned recorder runtime',async()=>{
  const [sw,app,panel]=await Promise.all(['kamera/sw.js','kamera/app.js','kamera/panel.html'].map(read));
  assert.match(sw,/kamera-domowa-shell-v181/);
  assert.match(app,/SERVICE_WORKER_BUILD = "181"/);
  const css=panel.match(/marketing\.css\?v=\d+/)?.[0];
  assert.ok(css);
  assert.ok(sw.includes('./'+css));
  assert.ok(panel.includes('id="publicHome"'));
});
