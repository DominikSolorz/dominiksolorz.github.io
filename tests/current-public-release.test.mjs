import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('the public homepage stays on the verified GitHub Pages origin, not a delayed deployment mirror',async()=>{
  const [bridge,html,alias,manifest,robots,sitemap,sw]=await Promise.all([
    'kamera/public-entry.js','kamera/index.html','kamera/o-systemie.html',
    'kamera/version.json','robots.txt','kamera/sitemap.xml','kamera/sw.js'].map(read));
  const version=JSON.parse(manifest).version;
  for(const site of [html,alias]){
    assert.ok(site.includes('home-security-build" content="'+version+'"'));
    assert.ok(site.includes('rel="canonical" href="https://dominiksolorz.github.io/kamera/"'));
    assert.ok(site.includes('public-entry.js?v=5'));
    assert.ok(!site.includes('home-security-dominik-solorz.vercel.app'));
  }
  assert.ok(!bridge.includes('vercel.app'),'public entry must never send users to stale external website');
  assert.ok(bridge.includes("new URL('./panel.html'"),'private login and camera routes still use the same origin');
  assert.ok(robots.includes('https://dominiksolorz.github.io/kamera/sitemap.xml'));
  assert.ok(sitemap.includes('https://dominiksolorz.github.io/kamera/pobierz.html'));
  assert.ok(!sitemap.includes('vercel.app'));
  assert.ok(sw.includes('./public-entry.js?v=5'));
});

test('download page presents exactly the current signed Windows release without stale hardcoded labels',async()=>{
  const [template,builder,manifest,download,homepage]=await Promise.all([
    'design/marketing/pobierz.html','scripts/build-marketing.mjs',
    'kamera/desktop-update.json','kamera/pobierz.html','kamera/index.html'].map(read));
  const release=JSON.parse(manifest).version;
  assert.match(release,/^\d+\.\d+\.\d+$/);
  assert.ok(template.includes('HOME-SECURITY-Desktop-Setup-__DESKTOP_RELEASE__.exe'));
  assert.ok(template.includes('Wersja __DESKTOP_RELEASE__'));
  assert.ok(builder.includes("JSON.parse(await read(camera,'desktop-update.json')).version"));
  assert.ok(builder.includes(".replaceAll('__DESKTOP_RELEASE__',currentDesktopRelease)"));
  assert.ok(download.includes('HOME-SECURITY-Desktop-Setup-'+release+'.exe'));
  assert.ok(download.includes('Wersja '+release));
  assert.ok(homepage.includes('href="pobierz.html"'),'homepage delegates downloads to the dedicated page');
});
