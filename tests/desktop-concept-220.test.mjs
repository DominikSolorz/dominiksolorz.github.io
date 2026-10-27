import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('real HOME SECURITY 220 owner interface loads the UI-concept design last and offline',async()=>{
 const [html,sw,css,version,app]=await Promise.all([
  'kamera/index.html','kamera/sw.js','kamera/interface-concept.css',
  'kamera/version.json','kamera/app.js'].map(read));
 assert.equal(JSON.parse(version).version,'222');
 assert.ok(app.includes('const VERSION = "222"'));
 assert.ok(app.includes('SERVICE_WORKER_BUILD = "132"'));
 assert.ok(sw.includes('kamera-domowa-shell-v132'));
 assert.ok(html.includes('home-security-build" content="222"'));
 assert.ok(html.includes('app.js?v=222'));
 assert.ok(html.includes('desktop.js?v=37'));
 assert.ok(sw.includes('./desktop.js?v=37'));
 assert.ok(html.includes('href="interface-concept.css?v=2"'));
 assert.ok(sw.includes('./interface-concept.css?v=2'));
 assert.ok(html.indexOf('interface-concept.css?v=2')>html.indexOf('interface-theme.css?v=3'));
 assert.ok(css.length>10000,'design is implemented in production CSS, not merely a concept document');
});

test('the styling applies to all real operator screens and is not a fake screenshot overlay',async()=>{
 const css=await read('kamera/interface-concept.css');
 for(const selector of ['.desktopSidebar','.desktopNav','.desktopBrand','.topbar','.desktopContext',
  '.desktopCameraTile','.desktopEventsDrawer','.desktopControlsScreen','.desktopSettingsScreen',
  '.desktopEventsScreen','.desktopDiagnosticsScreen','.componentCards','.componentCard',
  '.archiveModal','.archiveModalHead','.archiveStorageSidebar','.mobileAppHeader','.mobileBottomNav']){
  assert.ok(css.includes(selector),'missing real screen selector '+selector);
 }
 for(const status of ['error','failed','auth_required','permission_required','degraded','recording','connected']){
  assert.ok(css.includes('[data-state='+status+']'),'real diagnostic state not styled: '+status);
 }
 assert.ok(css.includes('object-fit:contain'));
 assert.ok(!css.includes('filter:none'),'visual mode controls may apply user-selected camera filters');
 assert.ok(css.includes('#stage video'));
 assert.ok(!css.includes('01-pulpit.png'),'must not substitute a mockup for camera frames');
 assert.ok(!css.includes('07-telefon.png'),'must not substitute a mockup for real mobile owner panel');
 assert.ok(!css.includes('data:image/'),'must not bake test snapshots into UI');
 assert.ok(!css.includes('background-image:url('));
});

test('special-purpose police and military themes remain independent and user motion settings are respected',async()=>{
 const css=await read('kamera/interface-concept.css');
 for(const cls of ['html.desktopMode:not(.policeCommand):not(.usMilitary)',
  'html.mobileOwnerMode:not(.policeCommand):not(.usMilitary)'])
  assert.ok(css.includes(cls));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 assert.ok(css.includes(':focus-visible'));
 assert.ok(css.includes('button:disabled'));
 assert.ok(css.includes('@media(min-width:1024px) and (max-width:1410px)'));
 assert.ok(css.includes('@media(max-width:430px)'));
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,'CSS braces are balanced');
});

test('desktop navigation derives current location from real router and never claims recording success',async()=>{
 const [desktop,panels,html]=await Promise.all([
  'kamera/desktop.js','kamera/workspace-panels.mjs','kamera/index.html'].map(read));
 assert.ok(desktop.includes('setAttribute("aria-current", "page")'));
 assert.ok(desktop.includes('removeAttribute("aria-current")'));
 assert.ok(desktop.includes('desktopSummaryCamera">Sprawdzam…'));
 assert.ok(!desktop.includes('<strong>Gotowy</strong><small>wykrywanie ruchu i dźwięku'));
 assert.ok(desktop.includes('Podgląd obrazu nie potwierdza zapisanego nagrania'));
 assert.ok(desktop.includes('mountDiagnosticWorkspace'));
 assert.ok(desktop.includes('mirrorLivePreview'));
 assert.ok(desktop.includes('data-desktop-view="archive"'));
 assert.ok(panels.includes('Nie potwierdzono zamkniętego pliku.'));
 assert.ok(html.includes('id="stage"'));
});

test('Windows WebView2 preview uses the updated bundle but does not change release identity or private data',async()=>{
 const [program,project,installer]=await Promise.all([
  'desktop-client/Program.cs','desktop-client/HomeSecurityDesktop.csproj',
  'desktop-client/installer/HomeSecurityDesktop.iss'].map(read));
 const installedWeb=Number(program.match(/WebPanelBuild = "(\d+)"/)?.[1]);
 const currentWeb=Number(JSON.parse(await read('kamera/version.json')).version);
 const nativeVersion=program.match(/DesktopVersion = "([\d.]+)"/)?.[1];
 assert.ok(installedWeb>=220&&installedWeb<=currentWeb,'native bundle must never point to a future web build');
 assert.ok(/^\d+\.\d+\.\d+$/.test(nativeVersion),'native release must be semantic');
 assert.ok(project.includes('<Version>'+nativeVersion+'</Version>'));
 assert.ok(installer.includes('AppVersion "'+nativeVersion+'"'));
 assert.ok(program.includes('installedShell = DesktopVersion + ":" + WebPanelBuild'));
 const clear=program.match(/Storage.clearDataForOrigin[\s\S]*?\);/);
 assert.ok(clear,'bundle migration should retain explicit cache migration');
 assert.ok(!/indexeddb|local_storage|cookies/i.test(clear[0]),'installed UI preview must not reset auth or recordings');
});

test('real desktop UI preview is a downloadable CI artifact rather than a fake released installer',async()=>{
 const workflow=await read('.github/workflows/desktop-ui-preview.yml');
 assert.ok(workflow.includes('workflow_dispatch:'));
 assert.ok(workflow.includes('desktop-client/build-release.ps1'));
 assert.ok(workflow.includes('actions/upload-artifact@v4'));
 assert.ok(workflow.includes('preview'));
 assert.ok(!workflow.includes('desktop-update.json'),'preview must not rewrite live auto-update manifest');
});
