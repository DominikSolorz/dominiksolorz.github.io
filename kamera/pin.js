// PIN do usuwania nagrań z telefonu. PIN nigdy nie jest wysyłany: z PIN-u powstaje klucz (PBKDF2),
// a każde polecenie usunięcia jest podpisane (HMAC) jednorazowym numerem od komputera-kamery.
const enc = new TextEncoder();
export const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 150000 }, base, 256);
  return b64(bits);
}

export async function sign(keyB64, message) {
  const key = await crypto.subtle.importKey("raw", unb64(keyB64), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

export const targetString = t => `${t.day || ""}|${t.hour || ""}|${t.name || ""}`;
