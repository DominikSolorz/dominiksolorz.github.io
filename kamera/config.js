// Publiczne dane projektu Supabase "Prywatna Kamera" (klucz publishable jest jawny z założenia;
// dostęp do kanału kamery chroni RLS na realtime.messages).
export const SUPABASE_URL = "https://ksacbcrzuwdahnmggfxg.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_yfQyGJT92z7w6QUvBwhgkw_ckDfGudn";

// Opcjonalny serwer TURN (gdy połączenie przez sieć komórkową nie wychodzi), np.
// { urls: ["turn:global.relay.metered.ca:443?transport=tcp"], username: "...", credential: "..." }
export const TURN_SERVER = null;

// Kanał sygnalizacji wyliczany jest z PIN-u (access.js) — nie ma go w kodzie.

// Zapis nagrań prosto na Google Drive przez skrypt Google Apps Script (kamera/drive-skrypt.gs).
// Adres aplikacji internetowej (…/exec). Pusty = stary tryb: zapis do folderu Dysku Google na komputerze.
export const DRIVE_SCRIPT_URL = "";

// Odtwarzanie nagrania: plik na Google Drive (po identyfikatorze, a bez niego wyszukiwanie po nazwie).
export const driveWatchUrl = (name, id) => id
  ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`
  : `https://drive.google.com/drive/search?q=${encodeURIComponent(name)}`;
