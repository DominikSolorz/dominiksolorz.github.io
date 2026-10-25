import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
test('desktop bundle is installed separately from browser updates', async () => {
  const [host, project, app, installer] = await Promise.all([
    'desktop-client/BundledPanel.cs', 'desktop-client/HomeSecurityDesktop.csproj',
    'kamera/app.js', 'desktop-client/installer/HomeSecurityDesktop.iss'].map(read));
  assert.ok(host.includes('File.OpenRead(path)'));
  assert.ok(host.includes('root + Path.DirectorySeparatorChar'));
  assert.ok(host.includes('404, "Not Found"'));
  assert.ok(host.includes('Cache-Control: no-store'));
  assert.ok(project.includes('<ExcludeFromSingleFile>true</ExcludeFromSingleFile>'));
  assert.ok(project.includes('../kamera/**/*.gs'));
  assert.ok(app.includes('!window.__HOME_SECURITY_BUNDLED_PANEL__'));
  assert.ok(installer.includes('DisableDirPage=no'));
  assert.ok(installer.includes('UsePreviousAppDir=yes'));
  assert.ok(!installer.includes('[UninstallDelete]'));
});

test('native shell cache changes with desktop release while retaining account and recording storage',async()=>{
  const host=await read('desktop-client/Program.cs');
  assert.ok(host.includes('var installedShell = DesktopVersion + ":" + WebPanelBuild'));
  assert.ok(host.includes('installedBuild == installedShell'));
  assert.ok(host.includes('File.WriteAllText(WebShellMarkerPath, installedShell)'));
  const clear=host.match(/Storage.clearDataForOrigin[\s\S]*?\);/)[0];
  assert.ok(clear.includes('cache_storage,service_workers'));
  assert.ok(!/indexeddb|local_storage|cookies|all"/i.test(clear));
});
