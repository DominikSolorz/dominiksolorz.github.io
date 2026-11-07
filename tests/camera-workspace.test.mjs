import test from 'node:test';
import assert from 'node:assert/strict';
import {createCameraCatalog,createCameraConnections,cameraConfig,cameraColumns} from '../kamera/core/camera-catalog.mjs';
import {cameraSourceAdapters} from '../kamera/core/camera-sources.mjs';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const memory=()=>{const rows=new Map();return{getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v),rows};};
const input=n=>({kind:'system',name:'Kamera '+n,deviceId:'device-'+n});
test('50 independent cameras persist with stable IDs and account isolation',()=>{
 const storage=memory();let n=0;const catalog=createCameraCatalog({storage,ownerId:owner,makeId:()=>id(++n)});
 for(let i=0;i<50;i++)catalog.add(input(i));
 assert.equal(catalog.list().length,50);assert.equal(new Set(catalog.list().map(c=>c.id)).size,50);
 assert.equal(createCameraCatalog({storage,ownerId:owner}).list().length,50);
 assert.equal(createCameraCatalog({storage,ownerId:other}).list().length,0);
});
test('camera edits and removals preserve all other cameras and reject duplicate sources',()=>{
 const storage=memory();let n=0;const c=createCameraCatalog({storage,ownerId:owner,makeId:()=>id(++n)});
 const a=c.add(input(1)),b=c.add(input(2));c.update(a.id,{name:'Wejście'});
 assert.equal(c.list()[0].name,'Wejście');assert.throws(()=>c.add(input(2)),/już/);
 assert.throws(()=>c.update(a.id,{deviceId:b.deviceId}),/innej/);
 assert.equal(c.remove(a.id),true);assert.deepEqual(c.list(),[b]);
});
test('failed configuration writes never claim that a camera was added or removed',()=>{
 const storage=memory();const c=createCameraCatalog({storage,ownerId:owner,makeId:()=>id(1)});const a=c.add(input(1));
 storage.setItem=()=>{throw Error('Quota');};assert.throws(()=>c.remove(a.id));assert.equal(c.list().length,1);
 assert.throws(()=>c.update(a.id,{name:'Changed'}));assert.equal(c.list()[0].name,'Kamera 1');
});
test('an old window cannot overwrite a configuration edited by another window',()=>{
 const storage=memory();const first=createCameraCatalog({storage,ownerId:owner,makeId:()=>id(1)}),second=createCameraCatalog({storage,ownerId:owner,makeId:()=>id(2)});
 first.add(input(1));assert.throws(()=>second.add(input(2)),/innym oknie/);
 assert.equal(createCameraCatalog({storage,ownerId:owner}).list()[0].deviceId,'device-1');
});
test('corrupt saved configuration is retained instead of silently being erased',()=>{
 const storage=memory();storage.setItem('home-security-cameras:v1:'+owner,'not-json');
 assert.throws(()=>createCameraCatalog({storage,ownerId:owner}),/Zachowano/);assert.equal(storage.rows.values().next().value,'not-json');
});
test('credentials and unsupported camera protocols cannot be persisted as camera URLs',()=>{
 for(const url of ['https://u:p@camera.example/live','https://camera.example/live?access_token=secret','http://camera.example/live','rtsp://camera.example/live','javascript:alert(1)'])
   assert.throws(()=>cameraConfig({id:id(1),kind:'whep',name:'IP',url}));
 assert.equal(cameraConfig({id:id(1),kind:'mjpeg',name:'IP',url:'https://camera.example/live#unused'}).url,'https://camera.example/live');
 assert.throws(()=>createCameraCatalog({storage:memory(),ownerId:''}),/Zaloguj/);
});
test('removing one connection never closes a different camera or the primary camera',async()=>{
 const closed=[],states=[];const c=createCameraConnections({openers:{system:async camera=>({close:()=>closed.push(camera.id)})},onState:(id,s)=>states.push([id,s.status])});
 await c.connect({...input(1),id:id(1)},{});await c.connect({...input(2),id:id(2)},{});c.stop(id(1));
 assert.deepEqual(closed,[id(1)]);assert.equal(c.active(id(2)),true);c.dispose();assert.deepEqual(closed,[id(1),id(2)]);
});
test('a late device connection is immediately released after removal or logout',async()=>{
 let finish,closed=0;const c=createCameraConnections({openers:{system:()=>new Promise(resolve=>{finish=resolve;})}});
 const pending=c.connect({...input(1),id:id(1)},{});c.stop(id(1));finish({close:()=>closed++});await pending;
 assert.equal(closed,1);assert.equal(c.active(id(1)),false);
});
test('a failed preview frees its slot so retry works',async()=>{
 let attempts=0;const c=createCameraConnections({openers:{system:async()=>{attempts++;if(attempts===1)throw Error('busy');return{close(){}};}}});
 await c.connect({...input(1),id:id(1)},{});assert.equal(c.active(id(1)),false);
 await c.connect({...input(1),id:id(1)},{});assert.equal(c.active(id(1)),true);c.dispose();
});
test('transport failure disposes only its own resources and permits reconnection',async()=>{
 let report,closed=0;const c=createCameraConnections({openers:{system:async(_c,_t,_s,emit)=>{report=emit;return{close:()=>closed++};}}});
 await c.connect({...input(1),id:id(1)},{});report({status:'offline'});assert.equal(closed,1);assert.equal(c.active(id(1)),false);
});
test('pending connections respect the preview budget without starting extra devices',async()=>{
 let opens=0;const c=createCameraConnections({maxActive:2,openers:{system:async()=>{opens++;return{close(){}};}}});
 await c.connect({...input(1),id:id(1)},{});await c.connect({...input(2),id:id(2)},{});
 await assert.rejects(c.connect({...input(3),id:id(3)},{}),/2 dodatkowych/);assert.equal(opens,2);c.dispose();
});
test('cancelled system acquisition stops late tracks without touching any primary tracks',async()=>{
 let finish,stops=0;const abort=new AbortController();const adapters=cameraSourceAdapters({native:true,primaryVideo:{srcObject:{getVideoTracks:()=>[{getSettings:()=>({deviceId:'primary'})}]}},mediaDevices:{getUserMedia:()=>new Promise(resolve=>{finish=resolve;})}});
 const opening=adapters.system({...input(2),id:id(2)},{},abort.signal,()=>{});abort.abort();finish({getTracks:()=>[{stop:()=>stops++}]});
 await assert.rejects(opening,{name:'AbortError'});assert.equal(stops,1);
});
test('system cameras are not acquired in a web viewer and primary devices are not opened twice',async()=>{
 let calls=0;const mediaDevices={getUserMedia:()=>{calls++;}};
 await assert.rejects(cameraSourceAdapters({native:false,mediaDevices}).system(input(1),{},new AbortController().signal,()=>{}));
 await assert.rejects(cameraSourceAdapters({native:true,mediaDevices,primaryVideo:{srcObject:{getVideoTracks:()=>[{getSettings:()=>({deviceId:'device-1'})}]}}}).system(input(1),{},new AbortController().signal,()=>{}));
 assert.equal(calls,0);
});
test('the default primary device is protected even before its stream has started',async()=>{
 let opens=0;const adapters=cameraSourceAdapters({native:true,primaryVideo:{},mediaDevices:{enumerateDevices:async()=>[{kind:'videoinput',deviceId:'device-1'}],getUserMedia:()=>{opens++;}}});
 await assert.rejects(adapters.system(input(1),{},new AbortController().signal,()=>{}));assert.equal(opens,0);
});
test('system quality controls request the selected profile and preserve track ownership on cancellation',async()=>{
 for(const [quality,width,height,fps] of [['low',640,360,10],['balanced',1280,720,15],['high',1920,1080,25]]){
   let request,finish,stops=0;const abort=new AbortController();
   const adapters=cameraSourceAdapters({native:true,primaryVideo:{srcObject:{getVideoTracks:()=>[{getSettings:()=>({deviceId:'primary'})}]}},mediaDevices:{getUserMedia:constraints=>{request=constraints;return new Promise(resolve=>{finish=resolve;});}}});
   const opening=adapters.system({...input(2),quality},{},abort.signal,()=>{});
   assert.equal(request.video.width.ideal,width);assert.equal(request.video.height.ideal,height);assert.equal(request.video.frameRate.max,fps);assert.equal(request.audio,false);
   abort.abort();finish({getTracks:()=>[{stop:()=>stops++}]});await assert.rejects(opening,{name:'AbortError'});assert.equal(stops,1);
 }
});
test('automatic layout expands from one to two cameras without mock camera tiles',()=>{
 assert.equal(cameraColumns(1),1);assert.equal(cameraColumns(2),2);assert.equal(cameraColumns(4),2);assert.equal(cameraColumns(9),3);
});
