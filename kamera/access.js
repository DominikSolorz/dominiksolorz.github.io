// Wejście na stronę PIN-em. PIN nie jest zapisany w kodzie: z PIN-u powstaje klucz (PBKDF2),
// a tu jest tylko krótki skrót klucza do sprawdzenia poprawności. Z klucza wyliczana jest też
// nazwa kanału kamery — bez właściwego PIN-u nie da się znaleźć ani obrazu, ani biblioteki.
import { deriveKey } from "./pin.js?v=14";

const ACCESS_SALT = "kamera-dostep-v1";
const ACCESS_CHECK = "1422680ea0cdd32e";
const STORE = "kamera-dostep";

async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Zwraca klucz dostępu dla poprawnego PIN-u albo null.
export async function unlock(pin, remember) {
  const key = await deriveKey(String(pin).trim(), ACCESS_SALT);
  if ((await sha256hex(key)).slice(0, 16) !== ACCESS_CHECK) return null;
  try { (remember ? localStorage : sessionStorage).setItem(STORE, key); } catch { /* tryb prywatny */ }
  return key;
}

export function savedKey() {
  try { return localStorage.getItem(STORE) || sessionStorage.getItem(STORE); } catch { return null; }
}

export function lock() {
  try { localStorage.removeItem(STORE); sessionStorage.removeItem(STORE); } catch { /* tryb prywatny */ }
}

export async function channelFor(key) {
  return `cam-${(await sha256hex(`kanal:${key}`)).slice(0, 32)}`;
}
