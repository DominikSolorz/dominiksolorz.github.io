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

test('panel startup detects this device despite a stale manual storage choice', async()=>{
  const html=await readFile(new URL('../kamera/panel.html',import.meta.url),'utf8');
  const boot=html.match(/<script>\s*([\s\S]*?const routeParams[\s\S]*?)<\/script>/)[1];
  for(const sample of [
    {ua:'iPhone',width:390,saved:'computer',want:'mobile'},
    {ua:'iPhone',width:844,saved:'computer',want:'mobile'},
    {ua:'Windows NT',width:1440,saved:'phone',want:'desktop'},
    {ua:'Windows NT',width:800,saved:'computer',want:'mobile'},
    {ua:'Macintosh',touch:5,width:1024,saved:'computer',want:'mobile'},
    {ua:'Windows NT',width:600,native:true,saved:'phone',want:'desktop'},
    {ua:'iPhone',width:390,search:'?layout=manual&ui=computer',want:'desktop'},
    {ua:'Windows NT',width:1440,search:'?layout=manual&ui=phone',want:'mobile'},
  ]){
    const values=new Map([['hs-layout-mode-v2','manual'],['hs-layout-choice-v2',sample.saved]]);
    const root={dataset:{},classList:{add(){}}};
    const window={__HOME_SECURITY_DESKTOP__:!!sample.native};
    const ctx=vm.createContext({
      URLSearchParams,URL,window,
      location:{search:sample.search||'',hash:'',href:'https://example.test/kamera/panel.html'},
      navigator:{userAgent:sample.ua,maxTouchPoints:sample.touch||0},
      document:{documentElement:root},
      matchMedia:()=>({matches:sample.width<=900}),
      localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}
    });
    vm.runInContext(source,ctx);vm.runInContext(boot,ctx);
    assert.equal(root.dataset.clientMode,sample.want,JSON.stringify(sample));
  }
});
