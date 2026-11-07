import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('preview setup is deliberately separate from the production installer',async()=>{
 const [preview,stable]=await Promise.all([
  read('desktop-client/installer/HomeSecurityDesktop.UI220.Preview.iss'),
  read('desktop-client/installer/HomeSecurityDesktop.iss')
 ]);
 assert.match(preview,/OutputBaseFilename=HOME-SECURITY-Desktop-UI220-PREVIEW-Setup/);
 assert.match(preview,/AppId=\{\{59C811BC/);
 assert.notEqual(preview.match(/AppId=(.+)/)?.[1],stable.match(/AppId=(.+)/)?.[1]);
 assert.match(preview,/UsePreviousAppDir=no/);
 assert.match(preview,/Home Security UI220 Preview/);
 assert.match(preview,/Filename: "\{app\}\\\{#AppExeName\}".*postinstall skipifsilent unchecked/);
 assert.match(preview,/function InitializeSetup\(\): Boolean/);
 assert.match(preview,/tasklist \/FI "IMAGENAME eq HomeSecurityDesktop\.exe"/);
 assert.match(preview,/ExitCode = 0/);
 assert.ok(!preview.includes('[UninstallDelete]'),'preview must not delete user data');
 assert.ok(!preview.includes('CloseApplications=force'),'preview must never force-close the recorder');
});
test('installer workflow builds and validates genuine Windows EXE without altering public updates',async()=>{
 const [workflow,panel,stableManifest]=await Promise.all([
  read('.github/workflows/desktop-ui220-installer.yml'),
  read('kamera/panel.html'),
  read('kamera/desktop-update.json')
 ]);
 for(const part of ['runs-on: windows-latest','HomeSecurityDesktop.UI220.Preview.iss',
  'build-release.ps1', 'Agent/1.4.8/HomeSecurityAgent.exe',
  'Get-FileHash $setup -Algorithm SHA256','gh release create',
  '--prerelease', 'contents: write', 'UI220-PREVIEW-Setup.exe']){
  assert.ok(workflow.includes(part),'Missing installer safety/build requirement: '+part);
 }
 assert.ok(panel.includes('interface-concept.css?v='));
 const native=await read('desktop-client/Program.cs');
 assert.equal(JSON.parse(stableManifest).version,native.match(/DesktopVersion = "([\d.]+)"/)?.[1]);
 assert.ok(!workflow.includes('desktop-update.json'),'preview may not switch stable update channel');
 assert.ok(!workflow.includes('git push'),'preview must not overwrite stable binaries');
});