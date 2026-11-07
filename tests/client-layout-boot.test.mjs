import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const resolver=await readFile(new URL('../kamera/core/client-layout.js',import.meta.url),'utf8');
const html=await readFile(new URL('../kamera/panel.html',import.meta.url),'utf8');
const boot=html.match(/<script>\s*(const routeParams[\s\S]*?)<\/script>/)[1];
function start({search='',phone=false,native=false,width=1440,storage=new Map(),storageBlocked=false}={}){
 const classes=new Set(),dataset={};const context=vm.createContext({URLSearchParams,
  location:{search,hash:''},navigator:{userAgent:phone?'iPhone':'Windows',maxTouchPoints:phone?5:0},
  matchMedia:()=>({matches:width<=900}),window:native?{chrome:{webview:{}}}:{},
  localStorage:{getItem:key=>{if(storageBlocked)throw Error('disabled');return storage.get(key)||null;},setItem:(key,value)=>storage.set(key,value)},
  document:{documentElement:{dataset,classList:{add:name=>classes.add(name)}}}});
 vm.runInContext(resolver,context);vm.runInContext(boot,context);return {dataset,classes,storage};
}
test('real boot ignores legacy saved phone preference and old phone URL on desktop',()=>{
 const result=start({search:'?ui=phone',storage:new Map([['hs-ui-mode','phone']])});
 assert.equal(result.dataset.clientMode,'desktop');assert.equal(result.dataset.layoutPreference,'auto');
 assert.equal(result.storage.get('hs-last-client-layout'),'desktop');
});
test('real boot detects iPhone in landscape regardless of old desktop URL',()=>{
 assert.equal(start({phone:true,width:932,search:'?ui=computer&view=desktop'}).dataset.clientMode,'mobile');
});
test('manual choice persists in this browser and auto explicitly restores detection',()=>{
 const storage=new Map();assert.equal(start({search:'?layout=manual&ui=phone',storage}).dataset.clientMode,'mobile');
 assert.equal(start({storage}).dataset.clientMode,'mobile');
 assert.equal(start({search:'?layout=auto&ui=phone',storage}).dataset.clientMode,'desktop');
 assert.equal(start({storage}).dataset.clientMode,'desktop');
});
test('native Windows ignores manual phone preference',()=>{
 assert.equal(start({native:true,phone:true,width:600,search:'?layout=manual&ui=phone'}).dataset.clientMode,'desktop');
});
test('automatic layout works when persistent storage is unavailable',()=>{
 assert.equal(start({phone:true,storageBlocked:true}).dataset.clientMode,'mobile');
 assert.equal(start({storageBlocked:true}).dataset.clientMode,'desktop');
});
