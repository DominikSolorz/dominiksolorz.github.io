import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {panelStylesheet,panelSection} from './helpers/panel-css.mjs';
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
  for(const path of ['pobierz.html','przygotowanie.html','stan-projektu.html','panel.html?auth=login']){
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

test('public marketing accents use the HOME SECURITY red-graphite theme without recoloring the secure panel',async()=>{
  const [css,panel]=await Promise.all([read('kamera/marketing.css'),read('kamera/panel.html')]);
  const theme=css.split('/* HOME SECURITY WWW Premium Dark Pro')[1];
  for(const token of ['--m-blue:#ef4d5d','--m-purple:#ed3a4c','--m-teal:#e61b30',
    'linear-gradient(95deg,#dbd7d7 4%,#d2cfcf 54%,#ec5160 100%)',
    'linear-gradient(115deg,var(--m-blue) 0%,var(--m-purple) 58%,#2b2828 100%)'])
    assert.ok(theme.includes(token),'missing public accent '+token);
  assert.match(panel,/<template id="panelStyles">/);
  panelStylesheet(panel);
  assert.match(panel,/id="app" hidden/);
});

test('public site retains the same dark system identity as Windows and Android/iPhone',async()=>{
  const css=await read('kamera/marketing.css');
  assert.ok(css.includes('--m-bg:#141313'));
  assert.ok(css.includes('--m-blue:#ef4d5d'));
  assert.ok(css.includes('color-scheme:dark'));
  assert.ok(!css.includes('@media(prefers-color-scheme:light)'),
    'light phone preference must not turn only the landing page white');
  assert.ok(css.includes('backdrop-filter:blur(22px)'),
    'dark navigation stays translucent');
  assert.ok(!css.includes('#app .mktButton'),
    'marketing styles must never overwrite the authenticated camera UI');
});

test('PWA refreshes marketing appearance without changing versioned recorder runtime',async()=>{
  const [sw,app,panel]=await Promise.all(['kamera/sw.js','kamera/app.js','kamera/panel.html'].map(read));
  const rev=app.match(/SERVICE_WORKER_BUILD = "(\d+)"/)?.[1];
  assert.ok(rev,'the app must declare the current PWA cache revision');
  assert.ok(sw.includes('kamera-domowa-shell-v'+rev),'service worker cache must match the app');
  const css=panel.match(/marketing\.css\?v=\d+/)?.[0];
  assert.ok(css);
  assert.ok(sw.includes('./'+css));
  assert.ok(panel.includes('id="publicHome"'));
});
