import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {driveFolderId,storageDescription,RecordingStorageClient} from '../kamera/recording-storage.mjs';
globalThis.crypto ??= webcrypto;
test('Drive folder input rejects foreign hosts and accepts real folder URLs',()=>{
  assert.equal(driveFolderId('https://drive.google.com/drive/u/0/folders/abcdefghijk'),'abcdefghijk');
  assert.throws(()=>driveFolderId('https://drive.google.com.evil.test/drive/folders/abcdefghijk'));
  assert.throws(()=>driveFolderId('https://example.com/folder'));
  assert.throws(()=>driveFolderId('../file'));
});
test('storage presentation distinguishes confirmed Google copies from temporary bytes',()=>{
  const text=storageDescription({mode:'cloud',connected:true,counts:{succeeded:2,queued:1,running:1}});
  assert.match(text,/Potwierdzone na Drive: 2/);assert.match(text,/Oczekujące: 2/);assert.match(text,/dopiero po potwierdzeniu/);
  assert.match(storageDescription(null),/nie zostało jeszcze potwierdzone/);
});
function host({failComplete=false}={}){
  let listener,offset=0;const parts=[],messages=[];
  const bridge={addEventListener:(type,fn)=>listener=fn,removeEventListener:()=>{},postMessage:message=>{
    messages.push(message);let result;
    if(message.name==='begin')result={transfer:'test-transfer'};
    if(message.name==='chunk'){const bytes=Buffer.from(message.args.data,'base64');assert.equal(message.args.offset,offset);offset+=bytes.length;parts.push(bytes);result={offset};}
    if(message.name==='complete')result={queued:true,name:'kamera-2026-10-29_20-00-00.mp4',bytes:offset};
    queueMicrotask(()=>listener({data:{type:'storage.result',id:message.id,result,error:failComplete&&message.name==='complete'?'DISK_FULL':null}}));
  }};return{bridge,parts,messages};
}
test('closed segment transfers exact bytes in bounded acknowledged chunks',async()=>{
  const fixture=host(),client=new RecordingStorageClient(fixture.bridge);
  const bytes=new Uint8Array(1048576+37);webcrypto.getRandomValues(bytes.subarray(0,50000));bytes[1048576]=123;
  const receipt=await client.save(new Blob([bytes]),'kamera-2026-10-29_20-00-00.mp4',{revision:7});
  assert.equal(receipt.bytes,bytes.length);assert.deepEqual(Buffer.concat(fixture.parts),Buffer.from(bytes));
  assert.equal(fixture.messages.filter(m=>m.name==='chunk').length,2);client.dispose();
});
test('native failure never acknowledges a completed recording',async()=>{
  const fixture=host({failComplete:true}),client=new RecordingStorageClient(fixture.bridge);
  await assert.rejects(client.save(new Blob(['bytes']),'kamera-2026-10-29_20-00-00.mp4',{revision:7}),/DISK_FULL/);client.dispose();
});
