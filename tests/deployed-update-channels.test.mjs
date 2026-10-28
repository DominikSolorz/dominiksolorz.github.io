import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Windows app advertises one-click Zaktualizuj for the exact offered version',async()=>{
  const source=await read('desktop-client/Program.cs');
  assert.ok(source.includes('updateButton.Text = $"↻ Zaktualizuj do wersji {version}";'));
  assert.ok(source.includes('Interval = 60 * 1000'));
  assert.ok(source.includes('if (!panelUnlocked || downloadingUpdate || offeredUpdate is null) return;'));
  assert.ok(source.includes('SHA256.HashDataAsync'));
  assert.ok(source.includes('RestartIntoPreparedUpdate(manifest.Version)'));
});

test('post-deployment verification compares both public update channels with immutable release sources',async()=>{
  const [script,webVersion,desktopManifest]=await Promise.all([
    read('scripts/verify-live-marketing.mjs'),
    read('kamera/version.json'),
    read('kamera/desktop-update.json')
  ]);
  const web=JSON.parse(webVersion),desktop=JSON.parse(desktopManifest);
  assert.match(web.version,/^\d+$/);
  assert.match(desktop.version,/^\d+\.\d+\.\d+$/);
  assert.match(desktop.sha256,/^[0-9A-F]{64}$/i);
  assert.match(desktop.installerSha256,/^[0-9A-F]{64}$/i);
  assert.ok(script.includes("await get('version.json')"),'must check live web manifest, not merely git contents');
  assert.ok(script.includes("await get('desktop-update.json')"),'must check live Windows manifest');
  assert.ok(script.includes('assert.equal(publicDesktop.version,expectedDesktop.version'));
  assert.ok(script.includes('assert.equal(publicDesktop.sha256,expectedDesktop.sha256'));
  assert.ok(script.includes('assert.equal(publicDesktop.installerSha256,expectedDesktop.installerSha256'));
  assert.ok(script.includes("await get('updates/HomeSecurityDesktop-'+publicDesktop.version+'-win-x64.zip',{method:'HEAD'})"));
  assert.ok(script.includes("await get('downloads/HOME-SECURITY-Desktop-Setup-'+publicDesktop.version+'.exe',{method:'HEAD'})"));
  assert.ok(script.includes('https://dominiksolorz.github.io'));
  assert.ok(!script.includes("method:'POST'"));
});

test('public site and PWA expose update controls while respecting recording safety',async()=>{
  const [site,sw,app,marketing,webUpdates]=await Promise.all([
    read('kamera/o-systemie.html'),
    read('kamera/sw.js'),
    read('kamera/app.js'),
    read('kamera/marketing-auto-update.mjs'),
    read('kamera/core/web-updates.mjs')
  ]);
  const version=JSON.parse(await read('kamera/version.json')).version;
  assert.ok(site.includes('home-security-build" content="'+version+'"'));
  const updateModule=sw.match(/marketing-auto-update\.mjs\?v=\d+/)?.[0];
  assert.ok(updateModule,'service worker must cache the public updater');
  assert.ok(site.includes(updateModule),'homepage and service worker must agree on updater revision');
  assert.ok(marketing.includes('freshUpdateURL'),'public update must navigate to fresh HTML');
  assert.ok(app.includes('freshUpdateURL(location.href,VERSION,Date.now())'),'private PWA must also refresh the current release');
  assert.ok(sw.includes("fetch(event.request, {cache: 'no-store'})"),'explicit upgrades must bypass stale page cache');
  assert.ok(sw.includes('./core/web-updates.mjs?v=3'));
  assert.ok(app.includes('autoApply:true'));
  assert.ok(app.includes("button.textContent=webUpdates.available?'Zaktualizuj':'Sprawdź aktualizacje'"));
  assert.ok(marketing.includes("update.textContent = 'Zaktualizuj'"));
  assert.ok(webUpdates.includes('prepareReload'));
  assert.ok(webUpdates.includes('canAutoApply'));
});


test('production Windows version validation accepts real releases and rejects malformed metadata',async()=>{
  const script=await read('scripts/verify-live-marketing.mjs');
  const source=script.match(/assert\.match\(publicDesktop\.version,\/([^/\n]+)\/\);/);
  assert.ok(source,'the production verifier must validate the Windows release version');
  const pattern=new RegExp(source[1]);
  assert.ok(pattern.test('1.4.20'));
  assert.ok(pattern.test('12.34.567'));
  for(const invalid of ['1x4x20','1.4','latest','1.4.20-beta','../../1.4.20']){
    assert.equal(pattern.test(invalid),false,'should reject '+invalid);
  }
});
