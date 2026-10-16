// Folder paths and replies must not be readable by viewer-link recipients.
const encoder = new TextEncoder(), decoder = new TextDecoder();
const encode = bytes => btoa(Array.from(new Uint8Array(bytes), n => String.fromCharCode(n)).join(''));
const decode = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
async function key(secret) {
  const base = await crypto.subtle.importKey('raw', decode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'HKDF', hash:'SHA-256', salt:encoder.encode('HOME-SECURITY'), info:encoder.encode('folder-channel-v1')}, base, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
}
export async function sealFolder(value, secret, clientId, commandId) {
  const text=JSON.stringify(value);
  if (encoder.encode(text).length>48000) throw Error('Folder response too large');
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(JSON.stringify([clientId,commandId]))},await key(secret),encoder.encode(text));
  return {id:commandId,iv:encode(iv),data:encode(bytes)};
}
export async function openFolder(envelope, secret, clientId, commandId) {
  if (!envelope || envelope.id!==commandId || typeof envelope.iv!=='string' || typeof envelope.data!=='string' || envelope.data.length>65000 || envelope.iv.length!==16) throw Error('Invalid folder envelope');
  const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv),additionalData:encoder.encode(JSON.stringify([clientId,commandId]))},await key(secret),decode(envelope.data));
  return JSON.parse(decoder.decode(bytes));
}
