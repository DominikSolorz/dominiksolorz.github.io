# HOME SECURITY — 100 usprawnień

To jest **plan prac**, nie deklaracja wdrożenia 100 funkcji. Każde zadanie wymaga implementacji i weryfikacji. Nie zmieniać produkcyjnego uwierzytelniania, RLS ani transmisji bez testów.

## Zweryfikowane 27.10.2026

- [x] Supabase: dodano indeks `public.camera_status(owner_id)` i potwierdzono jego istnienie. Nowy indeks może początkowo figurować jako nieużywany.
- [x] Sprawdzono dostępne alerty Supabase: ochrona przed ujawnionymi hasłami jest wyłączona. Wymaga ustawienia w Supabase Auth.
- [x] Sprawdzono ostrzeżenie RLS dotyczące `home_support_budget`. Bez znajomości docelowych uprawnień nie dodano polityki.
- [x] Potwierdzono, że `.github/workflows/pages.yml` wykonuje testy frontendowe, testy agenta i kompilację przed deployem.

## Bezpieczeństwo kont
- [ ] 001. Włączenie ochrony przed ujawnionymi hasłami
- [ ] 002. Przegląd zasad resetowania haseł
- [ ] 003. Limitowanie prób logowania
- [ ] 004. Przegląd polityki długości PIN
- [ ] 005. Wygaszanie sesji po bezczynności
- [ ] 006. Unieważnianie sesji po zmianie hasła
- [ ] 007. Ochrona ekranu PIN przed podglądaniem
- [ ] 008. Test konta bez dostępu do obcych kamer
- [ ] 009. Weryfikacja logowania Google
- [ ] 010. Przegląd walidacji formularzy

## Supabase i RLS
- [ ] 011. Indeks camera_status.owner_id
- [ ] 012. Analiza RLS home_support_budget
- [ ] 013. Test polityk camera_status
- [ ] 014. Test polityk user_profiles
- [ ] 015. Test polityk user_security
- [ ] 016. Test polityk user_recording_preferences
- [ ] 017. Test polityk user_cameras
- [ ] 018. Test polityk user_access_roles
- [ ] 019. Kontrola uprawnień realtime.messages
- [ ] 020. Dokumentacja macierzy uprawnień

## Baza i wydajność
- [ ] 021. Analiza niewykorzystanego indeksu user_cameras
- [ ] 022. Indeksy według rzeczywistych zapytań
- [ ] 023. Pomiar wolnych zapytań
- [ ] 024. Kontrola planów EXPLAIN
- [ ] 025. Paginate listy kamer
- [ ] 026. Paginate listy nagrań
- [ ] 027. Retencja danych diagnostycznych
- [ ] 028. Weryfikacja ograniczeń i typów kolumn
- [ ] 029. Monitorowanie rozmiaru bazy
- [ ] 030. Kontrola zdarzeń blokujących

## Połączenie kamery
- [ ] 031. Automatyczne ponawianie WebRTC
- [ ] 032. Backoff przy rozłączeniach
- [ ] 033. Stan połączenia w UI
- [ ] 034. Weryfikacja STUN/TURN
- [ ] 035. Próby po zmianie Wi-Fi na LTE
- [ ] 036. Test Safari iOS
- [ ] 037. Test Firefox Android
- [ ] 038. Opóźnienia transmisji
- [ ] 039. Diagnostyka ICE
- [ ] 040. Zapobieganie równoległym połączeniom

## Nagrywanie
- [ ] 041. Kontrola startu nagrania
- [ ] 042. Kontrola końca nagrania
- [ ] 043. Spójność statusów zapisu
- [ ] 044. Wykrywanie braku miejsca na dysku
- [ ] 045. Wykrywanie niedostępnego folderu
- [ ] 046. Naprawa po awarii procesu
- [ ] 047. Potwierdzanie pliku po zamknięciu
- [ ] 048. Ochrona przed nadpisaniem pliku
- [ ] 049. Test długiego nagrania
- [ ] 050. Walidacja integralności metadanych

## Archiwum
- [ ] 051. Filtrowanie po dacie
- [ ] 052. Wyszukiwanie po nazwie
- [ ] 053. Sortowanie nagrań
- [ ] 054. Czytelny stan pustej listy
- [ ] 055. Wskaźnik ładowania
- [ ] 056. Obsługa błędu odtwarzania
- [ ] 057. Informacja o źródle pliku
- [ ] 058. Pobieranie pliku na telefonie
- [ ] 059. Podgląd rozmiaru pliku
- [ ] 060. Obsługa usuniętego pliku

## Interfejs iPhone
- [ ] 061. Test VoiceOver
- [ ] 062. Rozmiary obszarów dotykowych
- [ ] 063. Obsługa safe-area
- [ ] 064. Orientacja pozioma
- [ ] 065. Obsługa małych ekranów
- [ ] 066. Czytelne stany alarmowe
- [ ] 067. Nawigacja klawiaturą
- [ ] 068. Kontrast tekstu
- [ ] 069. Wskaźnik aktywnej zakładki
- [ ] 070. Test dodawania PWA do ekranu

## Powiadomienia
- [ ] 071. Stan kamery offline
- [ ] 072. Stan powrotu online
- [ ] 073. Błąd nagrywania
- [ ] 074. Błąd dysku
- [ ] 075. Błąd chmury
- [ ] 076. Potwierdzenie uploadu
- [ ] 077. Unikanie wielokrotnych alarmów
- [ ] 078. Filtry zdarzeń
- [ ] 079. Historia alarmów
- [ ] 080. Dostępność komunikatów

## CI/CD i testy
- [ ] 081. Testy routera
- [ ] 082. Testy pamięci widoku
- [ ] 083. Testy logiki PIN
- [ ] 084. Testy uprawnień
- [ ] 085. Testy formularzy konta
- [ ] 086. Testy formatów dat
- [ ] 087. Testy WebRTC mock
- [ ] 088. Testy błędów archiwum
- [ ] 089. Testy manifestu PWA
- [ ] 090. Test publikacji Pages

## Dokumentacja i utrzymanie
- [ ] 091. Opis konfiguracji lokalnej
- [ ] 092. Instrukcja odzyskiwania dostępu
- [ ] 093. Instrukcja diagnostyki iOS
- [ ] 094. Opis modelu uprawnień
- [ ] 095. Lista wymagań Windows
- [ ] 096. Polityka backupu bazy
- [ ] 097. Plan odzyskania po awarii
- [ ] 098. Wersjonowanie zmian
- [ ] 099. Rejestr znanych ograniczeń
- [ ] 100. Checklistę przed wydaniem
