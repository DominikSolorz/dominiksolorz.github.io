import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../kamera/app.js',import.meta.url),'utf8');
const html=await readFile(new URL('../kamera/index.html',import.meta.url),'utf8');
const code=app.slice(app.indexOf('$("chooseArchiveDir").addEventListener'),app.indexOf('$("createArchiveDir").disabled'));
function setup({host=true,choose=async()=> 'nagrania',regrant=async()=>true}={}) {
 const elements=new Map(),calls=[];
 const $=id=>{if(!elements.has(id)) elements.set(id,{textContent:'Wybierz folder',disabled:false,addEventListener(type,fn){this[type]=fn;}});return elements.get(id);};
 const ctx=vm.createContext({$,CAN_MANAGE_CAMERA:host,canControlCamera:()=>true,toastMsg:message=>calls.push(message),errText:e=>e.message,archive:{diskNeedsGrant:true,chooseDisk:choose,regrantDisk:regrant},remoteFolderPicker:{open:()=>calls.push('remote')}});
 vm.runInContext(code,ctx);return {$,calls};
}
test('folder picker starts in original click even when previous folder needs permission',async()=>{
 let called=false,resolve;const pending=new Promise(r=>resolve=r);
 const s=setup({choose:()=>{called=true;return pending;},regrant:()=>{throw Error('must not preflight');}});
 const task=s.$('chooseArchiveDir').click();assert.equal(called,true);assert.equal(s.$('chooseArchiveDir').disabled,true);
 resolve('nagrania');await task;assert.match(s.$('archiveFolderSelectionStatus').textContent,/nagrania.*Sprawdzono/);assert.equal(s.$('chooseArchiveDir').disabled,false);
});
test('cancel preserves folder and displays result beside picker',async()=>{const e=Object.assign(Error('cancel'),{name:'AbortError'});const s=setup({choose:async()=>{throw e;}});await s.$('chooseArchiveDir').click();assert.match(s.$('archiveFolderSelectionStatus').textContent,/Poprzednia lokalizacja pozostaje/);});
test('write or permission failure does not claim selected folder',async()=>{const s=setup({choose:async()=>{throw Error('Brak miejsca');}});await s.$('chooseArchiveDir').click();assert.match(s.$('archiveFolderSelectionStatus').textContent,/Nie ustawiono folderu: Brak miejsca/);});
test('phone uses host folder picker not its own local disk',async()=>{const s=setup({host:false,choose:()=>{throw Error('wrong machine');}});await s.$('chooseArchiveDir').click();assert.deepEqual(s.calls,['remote']);});
test('permission restoration never chains a second picker without another click',async()=>{const s=setup({choose:()=>{throw Error('unexpected picker');},regrant:async()=>false});await s.$('restoreArchiveDir').click({currentTarget:s.$('restoreArchiveDir')});assert.match(s.$('archiveFolderSelectionStatus').textContent,/Nie przywrócono/);});
test('folder settings expose connected action and accessible inline status',()=>{assert.match(html,/id="chooseArchiveDir"[^>]*aria-describedby="archiveFolderSelectionStatus"/);assert.match(html,/id="archiveFolderSelectionStatus"[^>]*role="status"/);assert.ok(html.includes('Pulpit → nagrania'));});
