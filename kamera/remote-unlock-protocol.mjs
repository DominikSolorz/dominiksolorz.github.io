import {keyHash} from './account-security.mjs?v=1';

const encoder=new TextEncoder();
const decoder=new TextDecoder();
const raw=value=>Uint8Array.from(atob(value),character=>character.charCodeAt(0));
const b64=bytes=>btoa(String.fromCharCode(...bytes));

export async function unlockWithDerivedPinKey(pinKey,security,userId,now=Date.now()){
  // The host re-verifies the CURRENT account PIN after decrypting the grant.
  // A previously paired phone cannot unlock using an old PIN after rotation.
  if(typeof userId!=='string'||!/^[a-f0-9-]{36}$/i.test(userId))return null;
  if(typeof pinKey!=='string'||pinKey.length>64)return null;
  let pinBytes;
  try{pinBytes=raw(pinKey);}catch{return null;}
  if(pinBytes.length!==32||!security||typeof security.pin_hash!=='string')return null;
  if(security.locked_until&&Date.parse(security.locked_until)>now)return null;
  const hash=await keyHash(pinKey);
  if(hash!==security.pin_hash)return null;
  const envelope=security.pin_wrapped_access_key;
  if(envelope==null)return pinKey;
  if(envelope.v!==1||typeof envelope.iv!=='string'||typeof envelope.data!=='string'||envelope.data.length>256)throw new Error('Unsupported owner key envelope');
  const wrapping=await crypto.subtle.importKey('raw',pinBytes,'AES-GCM',false,['decrypt']);
  const result=decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:raw(envelope.iv),additionalData:encoder.encode('home-security-pin-v1:'+userId)},wrapping,raw(envelope.data)));
  if(raw(result).length!==32)throw new Error('Invalid owner access key');
  return result;
}

export function createPairingCode(){
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 const bytes=crypto.getRandomValues(new Uint8Array(20));
 return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
}
export function normalizePairingCode(code){return String(code||'').toUpperCase().replace(/[^A-Z2-9]/g,'');}
export async function pairingProof({code,requestId,userId,hostId,phoneId,phonePublicKey}){
 const normalized=normalizePairingCode(code);
 if(!/^[A-HJ-NP-Z2-9]{20}$/.test(normalized))throw new Error('Invalid pairing code');
 if(![requestId,userId,hostId,phoneId].every(v=>/^[0-9a-f-]{36}$/i.test(v)))throw new Error('Invalid pairing identity');
 const token=JSON.stringify(['hs-physical-pairing-v1',normalized,requestId,userId,hostId,phoneId,phonePublicKey?.crv,phonePublicKey?.x,phonePublicKey?.y]);
 const hash=await crypto.subtle.digest('SHA-256',encoder.encode(token));
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
export function equalsConstantTime(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
export function isFreshRequest(row,now=Date.now()){
 const start=Date.parse(row?.created_at),end=Date.parse(row?.expires_at);
 return Number.isFinite(start)&&Number.isFinite(end)&&start>=now-120000&&start<=now+5000&&end>now&&end<=start+120000;
}
