import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,webcrypto} from 'node:crypto';
globalThis.crypto??=webcrypto;
import {generateHostIdentity,generatePhoneIdentity,exportHostPublicKey,exportPhonePublicKey,encryptUnlockGrant,decryptUnlockGrant,GRANT_TTL_MS} from '../kamera/remote-unlock-crypto.mjs';

const fixture=async()=>{
  const host=await generateHostIdentity(), phone=await generatePhoneIdentity(), stranger=await generatePhoneIdentity();
  const accountId=randomUUID(),hostId=randomUUID(),phoneId=randomUUID();
  const accessKey=randomBytes(32).toString('base64');
  const now=Date.now();
  const grant=await encryptUnlockGrant({accessKey,hostPublicKey:await exportHostPublicKey(host),phonePrivateKey:phone.privateKey,userId:accountId,hostId,phoneId,now});
  const options={hostPrivateKey:host.privateKey,pairedPhonePublicKey:await exportPhonePublicKey(phone),userId:accountId,hostId,phoneId,usedIds:new Set(),now:now+200};
  return {host,phone,stranger,grant,options,accessKey,accountId,hostId,phoneId,now};
};

test('PIN-derived owner key is encrypted for the paired desktop, not sent as PIN or plaintext',async()=>{
 const f=await fixture();
 assert.equal(f.grant.expiresAt-f.grant.issuedAt,GRANT_TTL_MS);
 assert.ok(!JSON.stringify(f.grant).includes(f.accessKey));
 const unlocked=await decryptUnlockGrant(f.grant,f.options);
 assert.equal(unlocked,f.accessKey);
 assert.equal(f.options.usedIds.size,1);
 await assert.rejects(()=>decryptUnlockGrant(f.grant,f.options),/Replayed/);
});
test('wrong account, host, phone or fake signer never unlocks',async()=>{
 const f=await fixture();
 for(const field of ['userId','hostId','phoneId']) {
   await assert.rejects(()=>decryptUnlockGrant(f.grant,{...f.options,[field]:randomUUID(),usedIds:new Set()}),/target mismatch/);
 }
 await assert.rejects(()=>decryptUnlockGrant(f.grant,{...f.options,pairedPhonePublicKey:await exportPhonePublicKey(f.stranger),usedIds:new Set()}),/Untrusted/);
});
test('tampered grants and expired/future messages fail closed',async()=>{
 const f=await fixture();
 await assert.rejects(()=>decryptUnlockGrant({...f.grant,expiresAt:f.grant.expiresAt+1},{...f.options,usedIds:new Set()}),/lifetime/);
 await assert.rejects(()=>decryptUnlockGrant(f.grant,{...f.options,now:f.now+GRANT_TTL_MS+1,usedIds:new Set()}),/Expired/);
 await assert.rejects(()=>decryptUnlockGrant(f.grant,{...f.options,now:f.now-6000,usedIds:new Set()}),/future/);
 await assert.rejects(()=>decryptUnlockGrant({...f.grant,ciphertext:f.grant.ciphertext.slice(0,-2)+'AA'},{...f.options,usedIds:new Set()}));
});
test('grant requires a real 32-byte key and nonextractable device private keys',async()=>{
 const f=await fixture();
 assert.equal(f.host.privateKey.extractable,false);
 assert.equal(f.phone.privateKey.extractable,false);
 for(const bad of ['1234','123456','',randomBytes(12).toString('base64')]){
   await assert.rejects(()=>encryptUnlockGrant({accessKey:bad,hostPublicKey:await exportHostPublicKey(f.host),phonePrivateKey:f.phone.privateKey,userId:f.accountId,hostId:f.hostId,phoneId:f.phoneId,now:f.now}),/Invalid unlocked access key/);
 }
});
