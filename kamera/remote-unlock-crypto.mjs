// HOME SECURITY remote PIN unlock v1: cryptographic transport only.
// Activation requires separately verified user consent and physical device pairing.
// Never transmit PIN, plaintext access key, JWT or passwords through Supabase.
const codec=new TextEncoder();
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{16,64}$/i.test(id);
const bytes=base64=>Uint8Array.from(atob(base64.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-base64.length%4)%4)),c=>c.charCodeAt(0));
const base64=buffer=>{const u=new Uint8Array(buffer);let s='';for(const value of u)s+=String.fromCharCode(value);return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');};
const context=grant=>codec.encode(JSON.stringify(['home-security-remote-unlock-v1',grant.id,grant.userId,grant.hostId,grant.phoneId,grant.issuedAt,grant.expiresAt]));
const signed=grant=>codec.encode(JSON.stringify([grant.v,grant.id,grant.userId,grant.hostId,grant.phoneId,grant.issuedAt,grant.expiresAt,grant.ciphertext]));
export const GRANT_TTL_MS=60000;

export async function generateHostIdentity(){
  // Private RSA key is nonextractable: store only as a CryptoKey in the host's own IndexedDB.
  return crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:3072,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},false,['encrypt','decrypt']);
}
export async function generatePhoneIdentity(){
  // Phone private signing key is nonextractable; a public key is pinned after physical pairing.
  return crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
}
export async function exportHostPublicKey(pair){return crypto.subtle.exportKey('jwk',pair.publicKey);}
export async function exportPhonePublicKey(pair){return crypto.subtle.exportKey('jwk',pair.publicKey);}

function validateShape(grant,now){
  if(!grant||grant.v!==1||!validId(grant.id)||!validId(grant.userId)||!validId(grant.hostId)||!validId(grant.phoneId))throw new Error('Invalid grant identity');
  if(!Number.isSafeInteger(grant.issuedAt)||!Number.isSafeInteger(grant.expiresAt)||grant.expiresAt-grant.issuedAt!==GRANT_TTL_MS)throw new Error('Invalid grant lifetime');
  if(grant.issuedAt>now+5000||grant.expiresAt<=now)throw new Error('Expired or future grant');
  if(typeof grant.ciphertext!=='string'||grant.ciphertext.length<100||grant.ciphertext.length>1024||typeof grant.signature!=='string'||grant.signature.length<40||grant.signature.length>256)throw new Error('Invalid grant payload');
}
// Called only after verifyAccountPin(pin) succeeded and after physical pairing was approved.
export async function encryptUnlockGrant({accessKey,hostPublicKey,phonePrivateKey,userId,hostId,phoneId,now=Date.now()}){
  if(!validId(userId)||!validId(hostId)||!validId(phoneId)||!Number.isSafeInteger(now))throw new Error('Invalid device or account');
  if(typeof accessKey!=='string')throw new Error('Missing unlocked access key');
  const raw=bytes(accessKey);
  if(raw.length!==32)throw new Error('Invalid unlocked access key');
  const grant={v:1,id:crypto.randomUUID(),userId,hostId,phoneId,issuedAt:now,expiresAt:now+GRANT_TTL_MS};
  const publicKey=await crypto.subtle.importKey('jwk',hostPublicKey,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
  grant.ciphertext=base64(await crypto.subtle.encrypt({name:'RSA-OAEP',label:context(grant)},publicKey,raw));
  grant.signature=base64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},phonePrivateKey,signed(grant)));
  return grant;
}
// Desktop must supply the phone's PUBLIC key that was approved on its own screen.
// It must never trust an unverified public key supplied in the incoming grant.
export async function decryptUnlockGrant(grant,{hostPrivateKey,pairedPhonePublicKey,userId,hostId,phoneId,usedIds,now=Date.now()}){
  validateShape(grant,now);
  if(grant.userId!==userId||grant.hostId!==hostId||grant.phoneId!==phoneId)throw new Error('Grant target mismatch');
  if(!(usedIds instanceof Set)||usedIds.has(grant.id))throw new Error('Replayed grant');
  const signer=await crypto.subtle.importKey('jwk',pairedPhonePublicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const verified=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},signer,bytes(grant.signature),signed(grant));
  if(!verified)throw new Error('Untrusted phone authorization');
  const data=await crypto.subtle.decrypt({name:'RSA-OAEP',label:context(grant)},hostPrivateKey,bytes(grant.ciphertext));
  const key=new Uint8Array(data);
  if(key.length!==32)throw new Error('Invalid decrypted key');
  usedIds.add(grant.id);
  // Return in the same base64 alphabet as existing account-security.mjs and access.js.
  let s='';for(const b of key)s+=String.fromCharCode(b);
  return btoa(s);
}
