import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {shouldRecord,createLocationStore,groupRoutes,deviceInfo} from '../kamera/location-history.mjs';

const OWNER='11111111-1111-4111-8111-111111111111';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('recording is throttled by time and distance',()=>{
 const a={lat:52.2297,lon:21.0122,at:1000000};
 assert.equal(shouldRecord(null,a),true);
 assert.equal(shouldRecord(a,{...a,at:a.at+5000,lat:52.2307}),false,'too soon');
 assert.equal(shouldRecord(a,{...a,at:a.at+60000}),false,'not moved');
 assert.equal(shouldRecord(a,{lat:52.2307,lon:21.0122,at:a.at+60000}),true);
 assert.equal(shouldRecord(a,{lat:NaN,lon:1,at:a.at+60000}),false);
});

test('store refuses invalid owner and writes only own rows',async()=>{
 assert.equal(createLocationStore({client:{},ownerId:'x'}),null);
 const calls=[];
 const client={from:t=>({insert:async row=>{calls.push([t,row]);return {error:null};}}),rpc:async n=>{calls.push([n]);return {error:null};}};
 const store=createLocationStore({client,ownerId:OWNER,device:{id:'22222222-2222-4222-8222-222222222222',label:'Telefon'}});
 assert.deepEqual(await store.start(),{ok:true});
 assert.deepEqual(await store.save({lat:1,lon:2,accuracy:12.6,at:1000}),{ok:true});
 assert.deepEqual(await store.save({lat:1,lon:2,at:1001}),{skipped:true});
 const row=calls.find(c=>c[0]==='hs_location_points')[1];
 assert.equal(row.owner_id,OWNER);assert.equal(row.accuracy,13);assert.equal(row.device_label,'Telefon');
 assert.deepEqual(calls[0],['hs_prune_location_points']);
});

test('missing table is reported as unavailable, not as a crash',async()=>{
 const client={from:()=>({insert:async()=>({error:{code:'42P01'}})}),rpc:async()=>({error:{code:'PGRST202'}})};
 const store=createLocationStore({client,ownerId:OWNER,device:{id:'22222222-2222-4222-8222-222222222222',label:'Komputer'}});
 assert.deepEqual(await store.save({lat:1,lon:2,at:1}),{unavailable:true});
 assert.deepEqual(await store.start(),{unavailable:true});
});

test('routes are grouped per device and bad points dropped',()=>{
 const r=groupRoutes([{device_id:'a',device_label:'Telefon',lat:1,lon:2,recorded_at:'2026-11-08T10:00:00Z'},{device_id:'b',lat:3,lon:4,recorded_at:'2026-11-08T10:01:00Z'},{device_id:'a',lat:'x',lon:2},{lat:1,lon:1}],'a');
 assert.equal(r.length,2);assert.equal(r[0].own,true);assert.equal(r[0].points.length,1);assert.equal(r[1].label,'Urządzenie');
 assert.deepEqual(groupRoutes(null,'a'),[]);
});

test('device id is stable and labelled',()=>{
 const mem=new Map();const storage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)};
 const a=deviceInfo(storage,{userAgent:'iPhone Mobile'}),b=deviceInfo(storage,{userAgent:'Windows'});
 assert.equal(a.id,b.id);assert.equal(a.label,'Telefon');assert.equal(b.label,'Komputer');
});

test('migration is owner-only, append-only, retained 30 days and never open to anon',async()=>{
 const sql=await read('supabase/migrations/20261108140000_location_history.sql');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.hs_location_points from anon/);
 assert.match(sql,/grant select,insert,delete on public\.hs_location_points to authenticated/);
 assert.ok(!/for update|grant[^;]*update/.test(sql));
 assert.equal((sql.match(/owner_id=\(select auth\.uid\(\)\)/g)||[]).length>=4,true);
 assert.match(sql,/interval '30 days'/);
 assert.match(sql,/on delete cascade/);
});

test('app wires history only for the signed-in phone owner and service worker precaches it',async()=>{
 const [app,sw,map]=await Promise.all(['kamera/app.js','kamera/sw.js','kamera/mobile-map.mjs'].map(read));
 assert.match(app,/setLocationStore\(createLocationStore\(\{client:accountClient,ownerId:panelAccount\.id\}\)\)/);
 assert.ok(sw.includes('./location-history.mjs?v=1'));
 assert.ok(map.includes('name="record"')&&/checked = false/.test(map),'recording is opt-in and unchecked on every open');
});
