# Drugi etap przygotowania Androida

Wspólny kod wariantów direct/play otrzymuje obsługę geolokalizacji WebView.
Żądanie z innej domeny lub poza aktywnym panelem jest odrzucane. Systemowa zgoda
pojawia się dopiero przy żądaniu lokalizacji przez mapę; odmowa nie blokuje kamer
ani nagrań. Android 12+ może udostępnić lokalizację przybliżoną zamiast dokładnej.
Nie dodano ACCESS_BACKGROUND_LOCATION ani usługi lokalizacji w tle.
Zgoda WebView nie jest zapisywana na stałe. Przy wyjściu do ekranu głównego,
zmianie zakładki lub zatrzymaniu Activity mapa jest zamykana, co wywołuje jej
istniejące clearWatch. Zapis trasy nadal wymaga oddzielnego wyboru w panelu.

Natywny ekran błędu odróżnia błąd HTTP serwera od błędu połączenia. Ładowanie ma
limit 30 sekund i przycisk ponowienia. To limit oczekiwania na stronę, nie na
połączenie z prywatną kamerą.

Ikona launchera ma oddzielne warstwy tła i tarczy z kamerą, bez zmiany znaku marki.
Android 13+ otrzymuje również warstwę monochromatyczną do ikon tematycznych.

Testy emulatora obejmują oba kanały direct/play na API 30/35. Dodatkowo sprawdzają
typ ikony, reakcję na HTTP 503, odmowę systemowej zgody, akceptację samej zgody
przybliżonej, obce źródło i zamykanie mapy przy przejściu w tło. Test zgód używa
tylko jednorazowego środowiska emulatora, nie prywatnej lokalizacji właściciela.
Nie zastępuje to próby GPS i mapy na fizycznym telefonie ani deklaracji Data safety.

Ten etap bazuje na gałęzi etapu pierwszego (PR #210). Nie scalać przed nim.
