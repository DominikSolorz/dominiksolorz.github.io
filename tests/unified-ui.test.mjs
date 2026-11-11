import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {panelStylesheet,panelSection} from './helpers/panel-css.mjs';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('public site remains dark regardless of Android/iOS light preference',async()=>{
  const css=await read('kamera/marketing.css');
  assert.match(css,/--m-bg:#0a0e1a/);
  assert.match(css,/--m-blue:#6366f1/);
  assert.doesNotMatch(css,/@media\s*\(prefers-color-scheme:\s*light\)/,'system light theme must not switch only marketing to white');
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/,'retain reduced motion support');
});
test('Windows and mobile PIN screen share the same authenticated dark palette',async()=>{
  const css=await panelSection('premium-dark-pro.css');
  assert.match(css,/HOME SECURITY unified PIN screen/);
  assert.match(css,/html\.desktopMode:not\(\.policeCommand\):not\(\.usMilitary\) #lock/);
  assert.match(css,/html\.mobileOwnerMode:not\(\.policeCommand\):not\(\.usMilitary\) #lock/);
  assert.match(css,/background:linear-gradient\(155deg,#25272b,#1c1e21 80%\)/,'graphite PIN screen shared by Windows and phone');
  assert.match(css,/outline:3px solid #649cf7/);
  assert.match(css,/object-fit: contain/,'video presentation stays uncropped');
});
test('branding CSS does not modify PIN verification, device ownership or auth DOM',async()=>{
  const [panel,auth,lock]=await Promise.all(['kamera/panel.html','kamera/auth.js','kamera/lock.js'].map(read));
  for(const id of ['authDialog','lock','app','publicHome'])assert.match(panel,new RegExp('id="'+id+'"'));
  assert.match(auth,/verifyAccountPin/);
  assert.match(lock,/await unlock\(pin, false\)/);
});
