import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = (await readFile(new URL('../kamera/diskstore.js',import.meta.url),'utf8')).replace(/export /g,'');
function setup() {
  let picked=null;
  const ctx=vm.createContext({Map,Set,Error,window:{showDirectoryPicker:async()=>{if(picked instanceof Error) throw picked; return picked;}}});
  vm.runInContext(source+'\n globalThis.values=new Map(); globalThis.api={choose,save,validFolderName,disconnect,deleteEmptyCreatedFolder,browseFolders,selectRemoteFolder,createRemoteFolder}; get=async k=>values.get(k); put=async(k,v)=>{values.set(k,v);};',ctx);
  function folder(name,{sizeMismatch=false,granted=true}={}) {
    const files=new Map(), children=new Map();
    return {name,kind:'directory',files,children,queryPermission:async()=>granted?'granted':'denied',requestPermission:async()=>granted?'granted':'denied',
      resolve:async other=>{const walk=(node,path)=>{if(node.files===other.files)return path;for(const [name,child] of node.children){const found=walk(child,[...path,name]);if(found)return found;}return null;};return walk({files,children},[]);},
      isSameEntry:async other=>other.files===files,
      entries:()=>[...files,...children][Symbol.iterator](),
      removeEntry:async(child,options)=>{assert.equal(options.recursive,false);const target=children.get(child);if(target.files.size||target.children.size)throw Error('not empty');children.delete(child);},
      getDirectoryHandle:async(child,options)=>{if(!children.has(child)){if(!options?.create){const e=new Error('missing');e.name='NotFoundError';throw e;}children.set(child,folder(child));}return children.get(child);},
      getFileHandle:async(file)=>{if(!files.has(file)) {let size=0; files.set(file,{getFile:async()=>({size:sizeMismatch?0:size}),createWritable:async()=>({write:async blob=>{size=blob.size;},close:async()=>{},abort:async()=>{}})});} return files.get(file);}};
  }
  return {ctx,folder,pick:f=>{picked=f;},selected:()=>ctx.values.get('folder')};
}
const name='kamera-2026-10-16_21-00-00.mp4';
test('user selects arbitrary local folder and saves verified file',async()=>{const s=setup(),f=s.folder('my-archive');s.pick(f);await s.ctx.api.choose();assert.equal(await s.ctx.api.save(name,{size:10}),true);assert.equal(s.selected(),f);});
test('new subfolder is created only under user-selected parent',async()=>{const s=setup(),f=s.folder('D-drive');s.pick(f);await s.ctx.api.choose({newFolder:'nagrania'});assert.equal(s.selected(),f.children.get('nagrania'));});
test('switching archive clears cached handles from old folder',async()=>{const s=setup(),a=s.folder('A'),b=s.folder('B');s.pick(a);await s.ctx.api.choose();await s.ctx.api.save(name,{size:10});s.pick(b);await s.ctx.api.choose();await s.ctx.api.save(name,{size:20});assert.equal((await a.files.get(name).getFile()).size,10);assert.equal((await b.files.get(name).getFile()).size,20);});
test('cancelled picker preserves previous folder',async()=>{const s=setup(),a=s.folder('A');s.pick(a);await s.ctx.api.choose();s.pick(new Error('cancelled'));await assert.rejects(s.ctx.api.choose());assert.equal(s.selected(),a);});
test('unsafe folder names and recording paths rejected',async()=>{const s=setup();for(const bad of ['../other','C:\\other','CON','..','name.',''])assert.equal(s.ctx.api.validFolderName(bad),false);await assert.rejects(s.ctx.api.save('../'+name,{size:10}));});
test('mismatching saved size is not reported as success',async()=>{const s=setup();s.pick(s.folder('broken',{sizeMismatch:true}));await s.ctx.api.choose();await assert.rejects(s.ctx.api.save(name,{size:10}));});
test('denied permission does not replace archive selection',async()=>{const s=setup(),a=s.folder('A');s.pick(a);await s.ctx.api.choose();s.pick(s.folder('denied',{granted:false}));await assert.rejects(s.ctx.api.choose());assert.equal(s.selected(),a);});
test('disconnect preserves all recorded files',async()=>{const s=setup(),f=s.folder('A');s.pick(f);await s.ctx.api.choose();await s.ctx.api.save(name,{size:10});await s.ctx.api.disconnect();assert.equal(s.selected(),null);assert.equal(f.files.size,1);});
test('only empty app-created folder may be deleted',async()=>{const s=setup(),parent=s.folder('desktop');s.pick(parent);await s.ctx.api.choose({newFolder:'nagrania'});await s.ctx.api.deleteEmptyCreatedFolder();assert.equal(parent.children.size,0);assert.equal(s.selected(),null);});
test('folder with recordings is never deleted',async()=>{const s=setup(),parent=s.folder('desktop');s.pick(parent);await s.ctx.api.choose({newFolder:'nagrania'});await s.ctx.api.save(name,{size:10});await assert.rejects(s.ctx.api.deleteEmptyCreatedFolder());assert.equal(parent.children.size,1);assert.equal(s.selected().files.size,1);});
test('pre-existing chosen folder cannot be deleted by app',async()=>{const s=setup(),f=s.folder('existing');s.pick(f);await s.ctx.api.choose();await assert.rejects(s.ctx.api.deleteEmptyCreatedFolder());assert.equal(s.selected(),f);});
test('remote browser lists only directories under approved root',async()=>{const s=setup(),f=s.folder('approved');s.pick(f);await s.ctx.api.choose();await s.ctx.api.createRemoteFolder([],'child');const result=await s.ctx.api.browseFolders([]);assert.equal(result.root,'approved');assert.equal(result.entries[0].name,'child');});
test('remote selection changes archive without widening browse root',async()=>{const s=setup(),f=s.folder('approved');s.pick(f);await s.ctx.api.choose();await s.ctx.api.createRemoteFolder([],'child');await s.ctx.api.selectRemoteFolder(['child']);assert.equal(s.selected(),f.children.get('child'));assert.equal((await s.ctx.api.browseFolders([])).root,'approved');});
test('remote traversal and invalid names rejected',async()=>{const s=setup(),f=s.folder('approved');s.pick(f);await s.ctx.api.choose();for(const path of [['..'],['C:\\'],Array(13).fill('child')])await assert.rejects(s.ctx.api.browseFolders(path));await assert.rejects(s.ctx.api.createRemoteFolder([],'../escape'));});
test('disconnect revokes remote folder browsing',async()=>{const s=setup(),f=s.folder('approved');s.pick(f);await s.ctx.api.choose();await s.ctx.api.disconnect();await assert.rejects(s.ctx.api.browseFolders([]));});
test('remote pagination is bounded',async()=>{const s=setup(),f=s.folder('approved');s.pick(f);await s.ctx.api.choose();for(let i=0;i<101;i++)await s.ctx.api.createRemoteFolder([],'child'+i);const first=await s.ctx.api.browseFolders([]);assert.equal(first.entries.length,100);assert.equal(first.nextOffset,100);assert.equal((await s.ctx.api.browseFolders([],100)).entries.length,1);});
