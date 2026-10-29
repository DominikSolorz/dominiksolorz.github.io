import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../kamera/core/client-layout.js',import.meta.url),'utf8');
const context=vm.createContext({});vm.runInContext(source,context);
const resolve=context.HomeSecurityLayout.resolve;
test('native Windows never mounts mobile shell from saved preference or URL',()=>{
  assert.equal(resolve({native:true,ui:'phone',saved:'phone',compact:true}), 'desktop');
});
test('transmitter never mounts either operator shell',()=>{
  assert.equal(resolve({transmitter:true,native:true,ui:'phone'}),'transmitter');
  assert.equal(resolve({transmitter:true,mobile:true}),'transmitter');
});
test('only a conscious manual preference overrides device detection',()=>{
  assert.equal(resolve({preference:'manual',ui:'computer',saved:'phone',mobile:true}),'desktop');
  assert.equal(resolve({preference:'manual',ui:'phone',saved:'computer'}),'mobile');
  assert.equal(resolve({preference:'manual',view:'desktop',saved:'phone'}),'desktop');
});
test('automatic layout has no unassigned tablet-width gap',()=>{
  assert.equal(resolve({compact:false,mobile:false}),'desktop');
  assert.equal(resolve({compact:true}),'mobile');
  assert.equal(resolve({mobile:true}),'mobile');
});
test('stored choices remain presentation only and unknown values are ignored',()=>{
  assert.equal(resolve({saved:'computer',mobile:true}),'mobile');
  assert.equal(resolve({saved:'phone'}),'desktop');
  assert.equal(resolve({preference:'manual',saved:'phone'}),'mobile');
  assert.equal(resolve({ui:'owner',saved:'admin'}),'desktop');
  assert.ok(!/getUserMedia|localStorage|\.stop\(|fetch\(/.test(source));
});

test('old phone links cannot turn a desktop browser into a phone',()=>{
  assert.equal(resolve({ui:'phone',view:'mobile',legacyMobile:true,saved:'phone'}),'desktop');
  assert.equal(resolve({ui:'computer',view:'desktop',saved:'computer',mobile:true}),'mobile');
});

test('phone landscape remains mobile while native Windows remains desktop',()=>{
  assert.equal(resolve({mobile:true,compact:false}),'mobile');
  assert.equal(resolve({native:true,mobile:true,compact:true,preference:'manual',ui:'phone'}),'desktop');
});
