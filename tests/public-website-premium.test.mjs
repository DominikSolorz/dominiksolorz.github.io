import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('website redesign is applied to the public source, generated pages and embedded landing without replacing the camera app',async()=>{
  const [home,panel,index,brochure]=await Promise.all(['design/marketing/home.html','kamera/panel.html','kamera/index.html','kamera/o-systemie.html'].map(read));
  const source=home.trimEnd();
  const markers=['id="mktPublicFeaturesTitle"','class="mktPublicPreview"','id="mktPublicJourneyTitle"','id="mktPublicFinalTitle"'];
  for(const marker of markers) assert.ok(source.includes(marker),'source template is missing '+marker);
  // The release builder adjusts generated HTML. Template equivalence is tested
  // separately by scripts/build-marketing.mjs --check before release processing.
  // Here guard the actual public features and protected camera workspace.
  for(const [name,page] of [['panel',panel],['index',index],['brochure',brochure]]){
    for(const marker of markers) assert.ok(page.includes(marker),name+' is missing public website feature: '+marker);
  }
  assert.match(index, /href="pobierz\.html"/, 'public index must retain real download link');
  const slot=/<(?:section|div)(?: role="group")? id="publicHome"[\s\S]*?<\/(?:section|div)>(?=\s*<section id="authDialog")/;
  const publicSlot=panel.match(slot)?.[0];
  assert.ok(publicSlot,'protected panel must retain its distinct public landing region');
  for(const marker of markers) assert.ok(publicSlot.includes(marker),'embedded landing is missing '+marker);
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

test('public marketing accents use the blue-purple-teal theme without recoloring the secure panel',async()=>{
  const [css,panel]=await Promise.all([read('kamera/marketing.css'),read('kamera/panel.html')]);
  const theme=css.split('/* HOME SECURITY WWW Premium Dark Pro')[1];
  for(const token of ['--m-blue:#6366f1','--m-purple:#7c3aed','--m-teal:#2dd4bf',
    'linear-gradient(95deg,#c4b5fd 4%,#a5b4fc 54%,#5eead4 100%)',
    'linear-gradient(115deg,var(--m-blue) 0%,var(--m-purple) 58%,#0f766e 100%)'])
    assert.ok(theme.includes(token),'missing public accent '+token);
  assert.match(panel,/<template id="panelStyles">/);
  assert.match(panel,/premium-dark-pro\.css\?v=1/);
  assert.match(panel,/id="app" hidden/);
});

test('public pages follow the system light preference and preserve dark illustrative previews',async()=>{
  const css=await read('kamera/marketing.css');
  const light=css.slice(css.lastIndexOf('@media(prefers-color-scheme:light)'));
  assert.ok(light.includes('--m-bg:#f5f7fc'));
  assert.ok(light.includes('color-scheme:light'));
  assert.ok(light.includes('backdrop-filter:blur(16px)'));
  assert.ok(light.includes('.mktPublicJourney'));
  assert.ok(light.includes('.mktMobileMenu>nav'));
  assert.ok(light.includes('.mktPublicFeatureLabel'));
  assert.ok(light.includes('.mktArticleAside a'));
  assert.ok(!light.includes('#app'),'light theme must never target the authenticated camera workspace');
  assert.ok(!light.includes('.mktDemo')&&!light.includes('.mktPublicPreviewStage'),
    'illustrative product previews retain their dark, high-contrast UI');
  assert.ok(css.slice(0,css.lastIndexOf('@media(prefers-color-scheme:light)')).includes('color-scheme:dark'));
});

test('PWA refreshes marketing appearance without changing versioned recorder runtime',async()=>{
  const [sw,app,panel]=await Promise.all(['kamera/sw.js','kamera/app.js','kamera/panel.html'].map(read));
  assert.match(sw,/kamera-domowa-shell-v183/);
  assert.match(app,/SERVICE_WORKER_BUILD = "183"/);
  const css=panel.match(/marketing\.css\?v=\d+/)?.[0];
  assert.ok(css);
  assert.ok(sw.includes('./'+css));
  assert.ok(panel.includes('id="publicHome"'));
});
