import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const source = (await readFile(new URL('../kamera/diskstore.js',import.meta.url),'utf8')).replace(/export /g,'');
function setup() {
  let picked=null;
  const ctx=vm.createContext({Map,Set,Error,crypto:webcrypto,window:{showDirectoryPicker:async()=>{if(picked instanceof Error) throw picked; return picked;}}});
  vm.runInContext(source+'\n globalThis.values=new Map(); globalThis.api={status,choose,save,list,removeRecording,validFolderName,disconnect,deleteEmptyCreatedFolder,browseFolders,selectRemoteFolder,createRemoteFolder,deleteRemoteEmptyFolder}; get=async k=>values.get(k); put=async(k,v)=>{values.set(k,v);}; putMany=async entries=>{if(globalThis.failCommit)throw Error("commit failed");for(const [k,v] of entries)values.set(k,v);};',ctx);
  function folder(name,{sizeMismatch=false,granted=true}={}) {
    const files=new Map(), children=new Map();
    return {name,kind:'directory',files,children,queryPermission:async()=>granted?'granted':'denied',requestPermission:async()=>granted?'granted':'denied',
      resolve:async other=>{const walk=(node,path)=>{if(node.files===other.files)return path;for(const [name,child] of node.children){const found=walk(child,[...path,name]);if(found)return found;}return null;};return walk({files,children},[]);},
      isSameEntry:async other=>other.files===files,
      entries:()=>[...files,...children][Symbol.iterator](),
      removeEntry:async(child,options)=>{assert.equal(options.recursive,false);if(files.has(child)){files.delete(child);return;}const target=children.get(child);if(target.files.size||target.children.size)throw Error('not empty');children.delete(child);},
      getDirectoryHandle:async(child,options)=>{if(!children.has(child)){if(!options?.create){const e=new Error('missing');e.name='NotFoundError';throw e;}children.set(child,folder(child));}return children.get(child);},
      getFileHandle:async(file,options)=>{if(!files.has(file)) {if(!options?.create){const e=new Error('missing');e.name='NotFoundError';throw e;}let size=0; files.set(file,{getFile:async()=>({name:file,size:sizeMismatch?0:size}),createWritable:async()=>({write:async blob=>{size=typeof blob==='string'?blob.length:blob.size;},close:async()=>{},abort:async()=>{}})});} return files.get(file);}};
  }
  return {ctx,folder,pick:f=>{picked=f;},selected:()=>ctx.values.get('folder')};
}
const name='kamera-2026-10-16_21-00-00.mp4';
test('explicit recording delete removes exactly one selected file',async()=>{const s=setup(),f=s.folder('archive');s.pick(f);await s.ctx.api.choose();await s.ctx.api.save(name,{size:10});const other='kamera-2026-10-16_21-10-00.mp4';await s.ctx.api.save(other,{size:11});assert.equal(await s.ctx.api.removeRecording(name),true);assert.equal(f.files.has(name),false);assert.equal(f.files.has(other),true);});
test('recording delete after switching folders never uses a parent cached from old archive',async()=>{const s=setup(),a=s.folder('A'),b=s.folder('B');s.pick(a);await s.ctx.api.choose();await s.ctx.api.save(name,{size:10});await s.ctx.api.list();s.pick(b);await s.ctx.api.choose();await assert.rejects(s.ctx.api.removeRecording(name));assert.equal(a.files.has(name),true);assert.equal(b.files.size,0);});
test('recording deletion refuses revoked folder permission and arbitrary paths',async()=>{const s=setup(),f=s.folder('A');s.pick(f);await s.ctx.api.choose();await s.ctx.api.save(name,{size:10});f.queryPermission=async()=>'denied';await assert.rejects(s.ctx.api.removeRecording(name));await assert.rejects(s.ctx.api.removeRecording('../'+name));assert.equal(f.files.has(name),true);});
test('empty recordings are never confirmed',async()=>{const s=setup(),f=s.folder('nagrania');s.pick(f);await s.ctx.api.choose();await assert.rejects(s.ctx.api.save(name,{size:0}));assert.equal(f.files.has(name),false);});
test('missing permission is not a confirmed folder write',async()=>{const s=setup();s.ctx.values.set('folder',s.folder('nagrania',{granted:false}));assert.equal(await s.ctx.api.save(name,{size:10}),false);});
test('wrong size after closing a recording rejects confirmation',async()=>{const s=setup(),f=s.folder('nagrania');s.pick(f);await s.ctx.api.choose();f.files.set(name,{createWritable:async()=>({write:async()=>{},close:async()=>{},abort:async()=>{}}),getFile:async()=>({size:3})});await assert.rejects(s.ctx.api.save(name,{size:10}),/Rozmiar/);});
test('user selects arbitrary local folder and saves verified file',async()=>{const s=setup(),f=s.folder('my-archive');s.pick(f);await s.ctx.api.choose();assert.equal(await s.ctx.api.save(name,{size:10}),true);assert.equal(s.selected(),f);});
test('new subfolder is created only under user-selected parent',async()=>{const s=setup(),f=s.folder('D-drive');s.pick(f);await s.ctx.api.choose({newFolder:'nagrania'});assert.equal(s.selected(),f.children.get('nagrania'));});
test('switching archive clears cached handles from old folder',async()=>{const s=setup(),a=s.folder('A'),b=s.folder('B');s.pick(a);await s.ctx.api.choose();await s.ctx.api.save(name,{size:10});s.pick(b);await s.ctx.api.choose();await s.ctx.api.save(name,{size:20});assert.equal((await a.files.get(name).getFile()).size,10);assert.equal((await b.files.get(name).getFile()).size,20);});
test('cancelled picker preserves previous folder',async()=>{const s=setup(),a=s.folder('A');s.pick(a);await s.ctx.api.choose();s.pick(new Error('cancelled'));await assert.rejects(s.ctx.api.choose());assert.equal(s.selected(),a);});
test('unsafe folder names and recording paths rejected',async()=>{const s=setup();for(const bad of ['../other','C:\\other','CON','..','name.',''])assert.equal(s.ctx.api.validFolderName(bad),false);await assert.rejects(s.ctx.api.save('../'+name,{size:10}));});
test('failed write check does not accept folder',async()=>{const s=setup();s.pick(s.folder('broken',{sizeMismatch:true}));await assert.rejects(s.ctx.api.choose());assert.equal(s.selected(),undefined);});

test('remote empty folder deletion protects root, active location and recordings',async()=>{const s=setup(),f=s.folder('approved');s.pick(f);await s.ctx.api.choose();await assert.rejects(s.ctx.api.deleteRemoteEmptyFolder([]));await s.ctx.api.createRemoteFolder([],'empty');await s.ctx.api.deleteRemoteEmptyFolder(['empty']);assert.equal(f.children.has('empty'),false);await s.ctx.api.createRemoteFolder([],'active');await s.ctx.api.selectRemoteFolder(['active']);await assert.rejects(s.ctx.api.deleteRemoteEmptyFolder(['active']));await s.ctx.api.save(name,{size:10});assert.equal(s.selected().files.size,1);});

test('write check removes only its temporary file',async()=>{const s=setup(),f=s.folder('approved');s.pick(f);await s.ctx.api.choose();assert.equal(f.files.size,0);await s.ctx.api.save(name,{size:10});await s.ctx.api.choose();assert.equal(f.files.size,1);});
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

test('failed selection commit preserves both prior recording folder and remote browse root',async()=>{
 const s=setup(),a=s.folder('old'),b=s.folder('new');s.pick(a);await s.ctx.api.choose();
 s.ctx.failCommit=true;s.pick(b);await assert.rejects(s.ctx.api.choose(),/commit failed/);
 assert.equal(s.selected(),a);assert.equal(s.ctx.values.get('browseRoot'),a);
 assert.equal((await s.ctx.api.status()).name,'old');
});
test('restoring preloaded folder requests permission before asynchronous storage access and verifies write',async()=>{
 const s=setup(),f=s.folder('saved');s.ctx.values.set('folder',f);await s.ctx.api.status();
 let requested=false;f.requestPermission=()=>{requested=true;return Promise.resolve('granted');};
 vm.runInContext('get=async()=>{throw Error("storage read consumed activation");}',s.ctx);
 const result=s.ctx.api.status(true);assert.equal(requested,true);assert.equal((await result).ready,true);assert.equal(f.files.size,0);
});
test('restored permission without working disk never reports ready',async()=>{
 const s=setup(),f=s.folder('unwritable',{sizeMismatch:true});s.ctx.values.set('folder',f);await s.ctx.api.status();
 await assert.rejects(s.ctx.api.status(true),/potwierdzić zapisu/);
});
