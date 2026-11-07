import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('old archive URLs open the private panel even without a remembered device entry',async()=>{
 const script=await read('kamera/public-entry.js');
 for(const search of ['?section=recordings','?wroc=nagrania']){
  let destination;const location={search,hash:'',href:'https://dominiksolorz.github.io/kamera/'+search,replace:url=>destination=url};
  vm.runInNewContext(script,{location,URL,URLSearchParams,sessionStorage:{getItem:()=>null},window:{matchMedia:()=>({matches:false})},navigator:{}});
  assert.equal(new URL(destination).pathname,'/kamera/panel.html');assert.equal(new URL(destination).search,search);
 }
 assert.match(await read('kamera/nagrania.html'),/location.replace\('panel.html\?section=recordings'\)/);
});
test('local save control is independent from cloud connection and does not expose an obsolete installer',async()=>{
 const html=await read('kamera/panel.html'),app=await read('kamera/app.js');
 assert.match(html,/id="saveCurrentFragment"[^>]*aria-describedby="archiveFolderSelectionStatus"/);
 assert.match(app,/\$\("saveCurrentFragment"\)\.disabled = !CAN_MANAGE_CAMERA;/);
 assert.doesNotMatch(html,/href="downloads\/HOME-SECURITY-Desktop-Setup-/);
 assert.match(html,/href="pobierz.html"/);
});
