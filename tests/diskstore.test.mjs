import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = (await readFile(new URL('../kamera/diskstore.js',import.meta.url),'utf8')).replace(/export /g,'');
function setup() {
  let selected=null, picked=null;
  const ctx=vm.createContext({Map,Set,Error,window:{showDirectoryPicker:async()=>{if(picked instanceof Error) throw picked; return picked;}}});
  vm.runInContext(source+'\n globalThis.api={choose,save,validFolderName}; get=async()=>globalThis.selected; put=async(k,v)=>{globalThis.selected=v;};',ctx);
  function folder(name,{sizeMismatch=false,granted=true}={}) {
    const files=new Map(), children=new Map();
    return {name,files,children,queryPermission:async()=>granted?'granted':'denied',requestPermission:async()=>granted?'granted':'denied',
      getDirectoryHandle:async(child,options)=>{assert.equal(options.create,true); if(!children.has(child)) children.set(child,folder(child)); return children.get(child);},
      getFileHandle:async(file)=>{if(!files.has(file)) {let size=0; files.set(file,{getFile:async()=>({size:sizeMismatch?0:size}),createWritable:async()=>({write:async blob=>{size=blob.size;},close:async()=>{},abort:async()=>{}})});} return files.get(file);}};
  }
  return {ctx,folder,pick:f=>{picked=f;},selected:()=>ctx.selected};
}
const name='kamera-2026-10-16_21-00-00.mp4';
test('user selects arbitrary local folder and saves verified file',async()=>{const s=setup(),f=s.folder('my-archive');s.pick(f);await s.ctx.api.choose();assert.equal(await s.ctx.api.save(name,{size:10}),true);assert.equal(s.selected(),f);});
test('new subfolder is created only under user-selected parent',async()=>{const s=setup(),f=s.folder('D-drive');s.pick(f);await s.ctx.api.choose({newFolder:'nagrania'});assert.equal(s.selected(),f.children.get('nagrania'));});
test('switching archive clears cached handles from old folder',async()=>{const s=setup(),a=s.folder('A'),b=s.folder('B');s.pick(a);await s.ctx.api.choose();await s.ctx.api.save(name,{size:10});s.pick(b);await s.ctx.api.choose();await s.ctx.api.save(name,{size:20});assert.equal((await a.files.get(name).getFile()).size,10);assert.equal((await b.files.get(name).getFile()).size,20);});
test('cancelled picker preserves previous folder',async()=>{const s=setup(),a=s.folder('A');s.pick(a);await s.ctx.api.choose();s.pick(new Error('cancelled'));await assert.rejects(s.ctx.api.choose());assert.equal(s.selected(),a);});
test('unsafe folder names and recording paths rejected',async()=>{const s=setup();for(const bad of ['../other','C:\\other','CON','..','name.',''])assert.equal(s.ctx.api.validFolderName(bad),false);await assert.rejects(s.ctx.api.save('../'+name,{size:10}));});
test('mismatching saved size is not reported as success',async()=>{const s=setup();s.pick(s.folder('broken',{sizeMismatch:true}));await s.ctx.api.choose();await assert.rejects(s.ctx.api.save(name,{size:10}));});
test('denied permission does not replace archive selection',async()=>{const s=setup(),a=s.folder('A');s.pick(a);await s.ctx.api.choose();s.pick(s.folder('denied',{granted:false}));await assert.rejects(s.ctx.api.choose());assert.equal(s.selected(),a);});
