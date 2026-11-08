import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopUpdatePresentation as present,newerDesktopVersion} from '../kamera/desktop-update-presentation.mjs';
test('current, startup, checking and offline failures without an offer stay silent',()=>{
 for(const status of ['none','current','checking','error'])assert.equal(present({status,installedVersion:'1.4.75',hasUpdate:false}).visible,false,status);
 for(const status of ['available','error','checking']){
  for(const version of ['1.4.75','1.4.74',undefined,'invalid'])assert.equal(present({status,installedVersion:'1.4.75',version}).visible,false,status+version);
 }
});
test('numeric newer versions enable an offer, equal/older/malformed versions do not',()=>{
 assert.equal(newerDesktopVersion('1.4.100','1.4.99'),true);
 assert.equal(newerDesktopVersion('1.4.9','1.4.75'),false);
 assert.equal(newerDesktopVersion('1.4.75.0','1.4.75'),false);
 assert.equal(newerDesktopVersion('oops','1.4.75'),false);
 const p=present({status:'available',version:'1.4.76',installedVersion:'1.4.75'});
 assert.equal(p.visible,true);assert.equal(p.enabled,true);assert.match(p.label,/1\.4\.76/);
});
test('a known offer remains visible through progress and retry, then disappears when current',()=>{
 for(const status of ['checking','downloading','verifying','preparing','installing']){
  const p=present({status,hasUpdate:true,version:'1.4.76'});assert.equal(p.visible,true);assert.equal(p.enabled,false);assert.equal(p.progress,status==='downloading');
 }
 assert.equal(present({status:'error',hasUpdate:true}).enabled,true);
 assert.equal(present({status:'current',hasUpdate:false}).visible,false);
});
test('a prepared package exposes install, including old host compatibility, without null version text',()=>{
 for(const hasUpdate of [true,undefined]){
  const p=present({status:'staged',hasUpdate});assert.equal(p.visible,true);assert.equal(p.enabled,true);assert.equal(p.label,'↻ Zainstaluj teraz');
 }
 assert.equal(present({status:'staged',hasUpdate:false}).visible,false);
});
