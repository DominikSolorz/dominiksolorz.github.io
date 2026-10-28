import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read = path => readFile(new URL('../kamera/' + path, import.meta.url), 'utf8');
test('release manifest, runtime and HTML/SW agree', async () => {
  const [manifest, app, html, sw, access] = await Promise.all(['version.json','app.js','panel.html','sw.js','access.js'].map(read));
  const version = JSON.parse(manifest).version;
  assert.equal(app.match(/const VERSION = "(\d+)"/)[1], version);
  const desktop = await readFile(new URL('../desktop-client/Program.cs', import.meta.url), 'utf8');
  // Native cache-generation is a minimum shell revision, not a requirement to
  // rebuild the installer for every independently deployed web/CSS revision.
  assert.ok(Number(desktop.match(/WebPanelBuild = "(\d+)"/)[1]) <= Number(version));
  assert.ok(desktop.includes('ui_build=" + WebPanelBuild'));
  assert.ok(html.includes(`app.js?v=${version}`));
  assert.ok(sw.includes(`app.js?v=${version}`));
  assert.equal(app.match(/SERVICE_WORKER_BUILD = "(\d+)"/)[1], sw.match(/kamera-domowa-shell-v(\d+)/)[1]);
  const auth = html.match(/auth.js\?v=\d+/)[0];
  for (const source of [app,sw,access]) assert.ok(source.includes(auth));
  assert.ok(sw.includes(html.match(/style.css\?v=\d+/)[0]));
});

test('desktop runtime, project and installer version agree', async () => {
  const sources = await Promise.all(['Program.cs','HomeSecurityDesktop.csproj','installer/HomeSecurityDesktop.iss']
    .map(path => readFile(new URL('../desktop-client/' + path, import.meta.url), 'utf8')));
  const version = sources[0].match(/DesktopVersion = "([\d.]+)"/)[1];
  assert.ok(sources[1].includes(`<Version>${version}</Version>`));
  assert.ok(sources[1].includes(`<FileVersion>${version}.0</FileVersion>`));
  assert.ok(sources[2].includes(`AppVersion "${version}"`));
  assert.ok(sources[2].includes(`publish-${version}`));
});

test('public update matches desktop version and the exact published package',async()=>{
  const manifest=JSON.parse(await read('desktop-update.json'));
  const desktop=await readFile(new URL('../desktop-client/Program.cs',import.meta.url),'utf8');
  assert.equal(manifest.version,desktop.match(/DesktopVersion = "([\d.]+)"/)[1]);
  const url=new URL(manifest.packageUrl);
  assert.equal(url.origin,'https://dominiksolorz.github.io');
  assert.equal(url.pathname,`/kamera/updates/HomeSecurityDesktop-${manifest.version}-win-x64.zip`);
  const bytes=await readFile(new URL('..'+url.pathname,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(),manifest.sha256);
  const installer=await readFile(new URL(`../kamera/downloads/HOME-SECURITY-Desktop-Setup-${manifest.version}.exe`,import.meta.url));
  assert.equal(installer.subarray(0,2).toString(),'MZ');
});
