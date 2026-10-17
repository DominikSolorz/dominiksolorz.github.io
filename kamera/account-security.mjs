import { deriveKey, b64 } from './pin.js?v=14';
const encode = new TextEncoder(), decode = new TextDecoder();
const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
export const validPin = value => /^(?:\d{4}|\d{6})$/.test(String(value));
export async function keyHash(key) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encode.encode(key)))].map(b => b.toString(16).padStart(2,'0')).join('');
}
async function wrappingKey(key) { return crypto.subtle.importKey('raw', bytes(key), 'AES-GCM', false, ['encrypt','decrypt']); }
export async function wrapAccessKey(accessKey, pinKey, userId) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encode.encode(`home-security-pin-v1:${userId}`)},await wrappingKey(pinKey),encode.encode(accessKey));
  return {v:1,iv:b64(iv),data:b64(data)};
}
export async function unlockSecurity(pin, security, userId) {
  if (!validPin(pin) || !security || (security.locked_until && new Date(security.locked_until).getTime() > Date.now())) return null;
  const pinKey = await deriveKey(String(pin), security.pin_salt);
  if (await keyHash(pinKey) !== security.pin_hash) return null;
  const envelope = security.pin_wrapped_access_key;
  if (envelope == null) return pinKey; // Original accounts retain their exact camera / Drive key.
  if (envelope.v !== 1 || typeof envelope.iv !== 'string' || typeof envelope.data !== 'string' || envelope.data.length > 256) throw new Error('Nieobsługiwany zapis klucza. Zaktualizuj aplikację.');
  const result = decode.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv),additionalData:encode.encode(`home-security-pin-v1:${userId}`)},await wrappingKey(pinKey),bytes(envelope.data)));
  if (bytes(result).length !== 32) throw new Error('Nieprawidłowy klucz dostępu.');
  return result;
}
export async function rotatedSecurity(currentPin, nextPin, security, userId) {
  if (!validPin(nextPin)) throw new Error('Nowy PIN musi mieć dokładnie 4 lub 6 cyfr.');
  if (String(currentPin) === String(nextPin)) throw new Error('Nowy PIN musi być inny niż obecny.');
  const accessKey = await unlockSecurity(currentPin, security, userId);
  if (!accessKey) throw new Error('Nieprawidłowy obecny PIN lub czasowa blokada.');
  const salt = b64(crypto.getRandomValues(new Uint8Array(24)));
  const pinKey = await deriveKey(String(nextPin), salt);
  return {pin_salt:salt,pin_hash:await keyHash(pinKey),pin_wrapped_access_key:await wrapAccessKey(accessKey,pinKey,userId),pin_updated_at:new Date().toISOString(),failed_attempts:0,locked_until:null};
}
