// Publiczne dane projektu Supabase "Prywatna Kamera" (klucz publishable jest jawny z założenia;
// dostęp do kanału kamery chroni RLS na realtime.messages).
export const SUPABASE_URL = "https://ksacbcrzuwdahnmggfxg.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_yfQyGJT92z7w6QUvBwhgkw_ckDfGudn";

// Opcjonalny serwer TURN (gdy połączenie przez sieć komórkową nie wychodzi), np.
// { urls: ["turn:global.relay.metered.ca:443?transport=tcp"], username: "...", credential: "..." }
export const TURN_SERVER = null;

// Kanał sygnalizacji wyliczany jest z PIN-u (access.js) — nie ma go w kodzie.

// Odtwarzanie nagrania: wyszukiwanie pliku po nazwie na Google Drive właściciela.
export const driveWatchUrl = name => `https://drive.google.com/drive/search?q=${encodeURIComponent(name)}`;
