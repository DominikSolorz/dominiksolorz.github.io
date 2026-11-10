import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
globalThis.crypto??=webcrypto;
import {deriveKey} from '../kamera/pin.js';
import {keyHash,wrapAccessKey} from '../kamera/account-security.mjs';
import {createPairingCode,pairingProof,equalsConstantTime,unlockWithDerivedPinKey,isFreshRequest,createUnlockReceipt} from '../kamera/remote-unlock-protocol.mjs';
import {generateHostIdentity,generatePhoneIdentity,exportHostPublicKey,exportPhonePublicKey,encryptUnlockGrant,decryptUnlockGrant} from '../kamera/remote-unlock-crypto.mjs';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('physically shown pairing code binds exactly one phone, owner, PC and request',async()=>{
 const code=createPairingCode(); assert.match(code,/^[A-HJ-NP-Z2-9]{20}$/);
 const pair=await generatePhoneIdentity(),phonePublicKey=await exportPhonePublicKey(pair);
 const owner=randomUUID(),host=randomUUID(),phone=randomUUID(),req=randomUUID();
 const args={code,requestId:req,userId:owner,hostId:host,phoneId:phone,phonePublicKey};
 const proof=await pairingProof(args);
 assert.equal(proof.length,64);assert.ok(equalsConstantTime(proof,await pairingProof(args)));
 for(const variant of [{code:createPairingCode()},{hostId:randomUUID()},{phoneId:randomUUID()},{requestId:randomUUID()}]) {
   assert.equal(equalsConstantTime(proof,await pairingProof({...args,...variant})),false);
 }
});
test('phone sends derived PIN verifier encrypted, Windows re-verifies current PIN and unseals actual account key',async()=>{
 const owner=randomUUID(),hostId=randomUUID(),phoneId=randomUUID(),host=await generateHostIdentity(),phone=await generatePhoneIdentity();
 const pin='123456',salt='random-test-salt',pinKey=await deriveKey(pin,salt),accessKey=randomBytes(32).toString('base64');
 const security={pin_hash:await keyHash(pinKey),pin_wrapped_access_key:await wrapAccessKey(accessKey,pinKey,owner)};
 const grant=await encryptUnlockGrant({accessKey:pinKey,hostPublicKey:await exportHostPublicKey(host),phonePrivateKey:phone.privateKey,userId:owner,hostId,phoneId});
 assert.ok(!JSON.stringify(grant).includes(pin));assert.ok(!JSON.stringify(grant).includes(pinKey));
 assert.ok(!JSON.stringify(grant).includes(accessKey));
 const usedIds=new Set();
 const proofKey=await decryptUnlockGrant(grant,{hostPrivateKey:host.privateKey,pairedPhonePublicKey:await exportPhonePublicKey(phone),userId:owner,hostId,phoneId,usedIds});
 assert.equal(proofKey,pinKey);
 assert.equal(await unlockWithDerivedPinKey(proofKey,security,owner),accessKey);
 const pairedPhonePublicKey=await exportPhonePublicKey(phone);
 await assert.rejects(()=>decryptUnlockGrant(grant,{hostPrivateKey:host.privateKey,pairedPhonePublicKey,userId:owner,hostId,phoneId,usedIds}),/Replayed/);
 const nextPinKey=await deriveKey('654321','different-salt');
 const changed={pin_hash:await keyHash(nextPinKey),pin_wrapped_access_key:await wrapAccessKey(accessKey,nextPinKey,owner)};
 assert.equal(await unlockWithDerivedPinKey(proofKey,changed,owner),null,'a rotated PIN cancels earlier proof even when original owner access key stays the same');
 assert.equal(await unlockWithDerivedPinKey(nextPinKey,changed,owner),accessKey);
});
test('request transport requires bounded TTL',()=>{
 const now=Date.now();
 assert.ok(isFreshRequest({created_at:new Date(now-1000).toISOString(),expires_at:new Date(now+59000).toISOString()},now));
 assert.equal(isFreshRequest({created_at:new Date(now-140000).toISOString(),expires_at:new Date(now+10000).toISOString()},now),false);
 assert.equal(isFreshRequest({created_at:new Date(now-1000).toISOString(),expires_at:new Date(now+140000).toISOString()},now),false);
});
test('PWA and native host use same versioned PIN and remote UI without exposing global unlock',async()=>{
 const [app,panel,sw,lock,phone,host,db,version]=await Promise.all([
 'kamera/app.js','kamera/panel.html','kamera/sw.js','kamera/lock.js','kamera/remote-unlock-phone.mjs',
 'kamera/remote-unlock-host.mjs','supabase/migrations/20261107103600_remote_phone_unlock.sql','kamera/version.json'].map(source));
 assert.match(app,/createRemoteUnlockHost/);assert.match(app,/mountRemoteUnlockPhone/);
 assert.match(app,/requireAccess\(\{bindRemote:callback=>remoteHost\?\.bindUnlock\(callback\)\}\)/);
 assert.match(panel,/app\.js\?v=285/);assert.match(sw,/\.\/app\.js\?v=285/);
 assert.match(sw,/kamera-domowa-shell-v205/);assert.match(app,/SERVICE_WORKER_BUILD = "205"/);
 assert.equal(JSON.parse(version).version,'285');
 assert.match(panel,/remote-unlock-ui\.css\?v=1/);
 assert.match(lock,/sessionStorage\.setItem\('kamera-dostep',key\)/);
 assert.doesNotMatch(lock,/window\.__HOME_SECURITY_REMOTE_UNLOCK/,'never install global unlock callback');
 assert.match(phone,/awaitHost\(grant\.id,'approved',expectedReceipt\)/);
 assert.match(phone,/PIN pozostaje na telefonie/);
 assert.match(host,/window\.confirm\('HOME SECURITY/,'physical confirmation on Windows must be mandatory');
 assert.match(host,/unlockWithDerivedPinKey\(pinKey,security,ownerId\)/);
 assert.match(db,/enable row level security/i);
 assert.match(db,/owner_id=\(select auth\.uid\(\)\)/);
 assert.doesNotMatch(phone,/payload:\{pin\}/);
});

test('Windows approval requires PIN-derived HMAC receipt bound to this exact request',async()=>{
 const pinKey=randomBytes(32).toString('base64');
 const ctx={requestId:randomUUID(),userId:randomUUID(),hostId:randomUUID(),phoneId:randomUUID()};
 const expected=await createUnlockReceipt(pinKey,ctx);
 assert.match(expected,/^[a-f0-9]{64}$/);
 assert.equal(equalsConstantTime(expected,await createUnlockReceipt(pinKey,ctx)),true);
 assert.equal(equalsConstantTime(expected,undefined),false,'plain approved row is NOT confirmation');
 assert.equal(equalsConstantTime(expected,'0'.repeat(64)),false,'forged receipt fails closed');
 for(const field of Object.keys(ctx)){
   assert.equal(equalsConstantTime(expected,await createUnlockReceipt(pinKey,{...ctx,[field]:randomUUID()})),false,'receipt must bind '+field);
 }
 assert.equal(equalsConstantTime(expected,await createUnlockReceipt(randomBytes(32).toString('base64'),ctx)),false,'another account key cannot acknowledge Windows');
});
test('live phone rejects database-approved state without cryptographic host proof',async()=>{
 const [phone,host,sw]=await Promise.all(['kamera/remote-unlock-phone.mjs','kamera/remote-unlock-host.mjs','kamera/sw.js'].map(source));
 assert.match(phone,/equalsConstantTime\(data\.payload\?\.receipt,expectedReceipt\)/);
 assert.match(phone,/awaitHost\(grant\.id,'approved',expectedReceipt\)/);
 assert.match(host,/if\(callback\(accessKey\)\)/);
 assert.match(host,/await mark\(row,'approved',receipt\)/);
 for(const module of ['remote-unlock-phone.mjs?v=2','remote-unlock-host.mjs?v=2','remote-unlock-protocol.mjs?v=2']) assert.ok(sw.includes(module));
});
