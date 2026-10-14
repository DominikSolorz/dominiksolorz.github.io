// Wejście na stronę PIN-em. PIN nie jest zapisany w kodzie: z PIN-u powstaje klucz (PBKDF2),
// a tu jest tylko krótki skrót klucza do sprawdzenia poprawności. Z klucza wyliczana jest też
// nazwa kanału kamery — bez właściwego PIN-u nie da się znaleźć ani obrazu, ani biblioteki.
import { verifyAccountPin } from "./auth.js?v=1";
const STORE = "kamera-dostep";

async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Zwraca klucz dostępu dla poprawnego PIN-u albo null.
export async function unlock(pin) {
  const key = await verifyAccountPin(String(pin).trim());
  if (!key) return null;
  // Nie utrwalamy klucza w localStorage: zamknięcie aplikacji ma ponownie
  // wymagać PIN-u. sessionStorage żyje tylko w bieżącej sesji okna.
  try { localStorage.removeItem(STORE); sessionStorage.setItem(STORE, key); } catch { /* tryb prywatny */ }
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
