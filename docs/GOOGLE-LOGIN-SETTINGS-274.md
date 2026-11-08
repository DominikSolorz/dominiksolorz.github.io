# HOME SECURITY: Google i ustawienia — panel 274

Repozytorium: DominikSolorz/dominiksolorz.github.io. Gałąź: fix/settings-and-google-sign-in.

## Przyczyna i zmiana

Przeglądarkowe przekierowanie Google działało, lecz wersja Windows celowo odrzucała przycisk Google: brakowało przekazania sesji z systemowej przeglądarki do WebView2. Nowy host otwiera systemową przeglądarkę i odbiera jednorazowy kod OAuth przez port przydzielony na 127.0.0.1. Supabase SDK w pierwotnym WebView przechowuje weryfikator PKCE i wymienia kod przy użyciu identyfikatora właściwego przepływu. JWT i weryfikator nie przechodzą przez komunikaty natywne ani stronę powrotną. Logowanie nadal prowadzi przez sprawdzenie konta, zgód i PIN-u.

Dozwolony pozostaje istniejący adres powrotu https://dominiksolorz.github.io/kamera/. Nie zmieniono sekretów Google, reguł RLS ani schematu Supabase. Sprawdzony endpoint Supabase zwracał przekierowanie 302 do Google, a Google był włączony w konfiguracji Auth.

Pliki mostu: desktop-client/DesktopAccountOAuth.cs, desktop-client/Program.cs, kamera/auth.js, kamera/desktop-oauth.mjs, kamera/desktop-auth.html i kamera/desktop-auth-return.js. Skrypt powrotny działa przed inicjalizacją panelu i przekierowaniem publicznej strony. Starszy EXE pokazuje konieczność aktualizacji. Anulowanie, nawigacja i zamknięcie programu kończą oczekiwanie. Port jest jednorazowy; limit oczekiwania wynosi trzy minuty. Adres usługi, metoda S256, odbiorca, Host, stan, metoda HTTP i parametry są sprawdzane.

Ustawienia: kamera/mobile.js i kamera/mobile-app-look.css. Siedem kategorii prowadzi do istniejących funkcji. Obraz i dźwięk mają osobne zakładki wewnątrz kategorii. W ustawieniach znika czwarta pozycja nawigacji; pozostają Pulpit, Kamery, Nagrania. Oryginalny element wideo i kontrolki nagrywania są zachowane.

## Weryfikacja i granice

- node --test tests/*.test.mjs kamera/tests/*.test.mjs
- node scripts/verify-real-mobile-layout.cjs — rzeczywiste moduły i PBKDF2, poprawny/błędny PIN, ustawienia, trzy pozycje nawigacji; cztery rozmiary ekranu. Odpowiedzi konta są izolowanymi atrapami.
- node scripts/verify-google-login.cjs — rzeczywisty Supabase SDK i PKCE, kod i oryginalny weryfikator, zachowany PIN. Odpowiedzi konta oraz natywny komunikat są atrapami.
- agent-tests/DesktopAccountOAuthTests.cs — walidacja i rzeczywiste połączenie TCP do loopback, błędny stan, równoległe próby, anulowanie. Testy włączone do istniejących testów Windows; ten sam kod uruchomiony także w izolowanym projekcie .NET 10 na Linux.

To nie jest test fizycznego komputera użytkownika ani logowanie na rzeczywiste konto Google. Aktualny EXE musi zostać zbudowany i opublikowany przez standardowy workflow wydania Windows; numerów i sum pakietów nie zmienia się ręcznie. Panel 274 / cache PWA 194 wymusza nowe zasoby.
