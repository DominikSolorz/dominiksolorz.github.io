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
test('explicit web choice wins over stored mode and device detection',()=>{
  assert.equal(resolve({ui:'computer',saved:'phone',mobile:true}),'desktop');
  assert.equal(resolve({ui:'phone',saved:'computer'}),'mobile');
  assert.equal(resolve({view:'desktop',saved:'phone'}),'desktop');
});
test('automatic layout has no unassigned tablet-width gap',()=>{
  assert.equal(resolve({compact:false,mobile:false}),'desktop');
  assert.equal(resolve({compact:true}),'mobile');
  assert.equal(resolve({mobile:true}),'mobile');
});
test('stored choices remain presentation only and unknown values are ignored',()=>{
  assert.equal(resolve({saved:'computer',mobile:true}),'desktop');
  assert.equal(resolve({saved:'phone'}),'mobile');
  assert.equal(resolve({ui:'owner',saved:'admin'}),'desktop');
  assert.ok(!/getUserMedia|localStorage|\.stop\(|fetch\(/.test(source));
});
