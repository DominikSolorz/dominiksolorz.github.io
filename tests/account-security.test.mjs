import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deriveKey } from '../kamera/pin.js';
import { keyHash, unlockSecurity, rotatedSecurity, validPin } from '../kamera/account-security.mjs';
const user='test-user-not-production';
async function legacy(){const pin='123456',salt='unit-test-salt',key=await deriveKey(pin,salt);return {pin,key,row:{pin_salt:salt,pin_hash:await keyHash(key)}};}
test('PIN rotation preserves legacy camera/Drive key and rejects old PIN',async()=>{
 const {pin,key,row}=await legacy();assert.equal(await unlockSecurity(pin,row,user),key);
 const changed=await rotatedSecurity(pin,'654321',row,user);
 assert.equal(await unlockSecurity('654321',changed,user),key);
 assert.equal(await unlockSecurity(pin,changed,user),null);
 assert.ok(!JSON.stringify(changed).includes(key));assert.ok(!JSON.stringify(changed).includes('654321'));
 const again=await rotatedSecurity('654321','6789',changed,user);assert.equal(await unlockSecurity('6789',again,user),key);
});
test('wrapped PIN key is bound to user and rejects tampering',async()=>{
 const {pin,row}=await legacy(),changed=await rotatedSecurity(pin,'987654',row,user);
 await assert.rejects(()=>unlockSecurity('987654',changed,'another-user'));
 const bad=structuredClone(changed);bad.pin_wrapped_access_key.data='AAAA'+bad.pin_wrapped_access_key.data.slice(4);
 await assert.rejects(()=>unlockSecurity('987654',bad,user));
});
test('PIN requires 4 or 6 digits, verifies current PIN and honors lock',async()=>{
 for(const pin of ['123','12345','abcdef','1234567'])assert.equal(validPin(pin),false);
 const {pin,row}=await legacy();await assert.rejects(()=>rotatedSecurity('000000','654321',row,user));
 await assert.rejects(()=>rotatedSecurity(pin,pin,row,user));
 assert.equal(await unlockSecurity(pin,{...row,locked_until:new Date(Date.now()+60000).toISOString()},user),null);
});
test('password update requires recovery event, not query parameters or normal login',async()=>{
 const auth=await readFile(new URL('../kamera/auth.js',import.meta.url),'utf8');
 assert.ok(auth.includes("event === 'PASSWORD_RECOVERY'"));
 assert.ok(auth.includes('user.id!==recoveryUserId'));assert.ok(auth.includes('Date.now()>=recoveryUntil'));
 assert.ok(auth.includes('auth.resetPasswordForEmail'));assert.ok(auth.includes('auth.updateUser({password})'));
 assert.ok(auth.includes(".eq('pin_hash',security.pin_hash)"));
});
