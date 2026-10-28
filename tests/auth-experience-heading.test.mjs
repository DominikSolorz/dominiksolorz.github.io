import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('dialog name follows the visible h2 heading and stays unique across authentication steps',async()=>{
 const headings=[{id:'authTitle'},{id:''},{id:''}];
 const names=['login','register','forgot-password'];
 const steps=names.map((name,i)=>({hidden:i!==0,dataset:{authStep:name},querySelector:selector=>selector==='h1,h2'?headings[i]:null}));
 const attributes={};const card={setAttribute:(key,value)=>attributes[key]=value};
 let sync;
 const dialog={hidden:false,querySelector:selector=>selector==='.authCard'?card:null,querySelectorAll:selector=>selector==='[data-auth-step]'?steps:[],addEventListener(){}};
 const code=await readFile(new URL('../kamera/auth-experience.mjs',import.meta.url),'utf8');
 vm.runInNewContext(code,{document:{getElementById:()=>dialog,activeElement:null},MutationObserver:class {constructor(fn){sync=fn;}observe(){}},requestAnimationFrame:fn=>fn()});
 assert.equal(attributes['aria-labelledby'],'authTitle');
 steps[0].hidden=true;steps[1].hidden=false;sync();
 assert.equal(attributes['aria-labelledby'],headings[1].id);assert.ok(headings[1].id);
 steps[1].hidden=true;steps[2].hidden=false;sync();
 assert.equal(attributes['aria-labelledby'],headings[2].id);
 assert.equal(new Set(headings.map(h=>h.id)).size,3,'each form has its own heading ID');
 steps[2].hidden=true;steps[0].hidden=false;sync();assert.equal(attributes['aria-labelledby'],'authTitle');
});
