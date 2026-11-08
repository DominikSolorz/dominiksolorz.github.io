# HOME SECURITY — panel komputera bez zbędnych skrótów, build 276

Repozytorium: DominikSolorz/dominiksolorz.github.io. Gałąź: fix/desktop-clean-sidebar-update-offers.

Na podstawie zdjęć użytkownika usunięto ze stopki panelu komputerowego blok: Instrukcja i dokumenty, Projekty interfejsu, etykieta wersji, Widok Mobile oraz Automatyczny układ. Galeria koncepcji nie ma już przycisku w pulpicie Windows. Dokumentów i samych projektów nie usunięto z repozytorium ani ze strony publicznej.

## Aktualizacje

Przyczyną stale widocznego paska było ustawianie jego widoczności wyłącznie według odblokowania konta/PIN. Dodatkowo panel HTML ukrywał powiadomienie jedynie dla statusu none, przez co current, checking i błąd sieci także wyglądały jak oferta aktualizacji.

- desktop-client/Program.cs: pasek natywny wymaga jednocześnie odblokowania oraz znanej oferty nowszej wersji lub przygotowanego pakietu. Bieżąca wersja, startowe sprawdzanie i błąd bez oferty pozostają ciche. Powiadomienie natywne przekazuje hasUpdate. Sprawdzanie przy uruchomieniu, co 10 minut i po powrocie do programu pozostaje włączone. Pobieranie i instalacja nadal wymagają działania użytkownika, sprawdzenia SHA-256 i bezpiecznego zapisania nagrania.
- kamera/desktop.js: usunięta stopka; przycisk/status korzystają ze wspólnej polityki prezentacji.
- kamera/desktop-update-presentation.mjs: oferty nowszej wersji, trwające pobieranie, ponowienie po błędzie z potwierdzoną ofertą i przygotowany pakiet są widoczne. Równa/starsza wersja i błąd bez oferty nie są pokazywane. Zachowana zgodność z poprzednim hostem Windows. Przygotowany pakiet można zainstalować także przyciskiem panelu HTML bez ponownego pobierania.

## Weryfikacja i publikacja

Testy polityki: tests/desktop-update-presentation.test.mjs. Rzeczywisty panel przeglądarkowy z atrapą komunikatów hosta: scripts/verify-desktop-update-visibility.cjs (stopka nie istnieje; brak oferty/sprawdzanie/aktualna/starsza/równa/błąd nie pokazują powiadomienia; nowsza wersja, pobieranie i instalacja przygotowanego pakietu działają). Test dodany do CI przeglądarki. Pełny zestaw Node oraz kompilacja .NET Desktop są uruchamiane przed PR.

Build web 276, cache PWA 196, desktop.js 52. Instalator Windows i sumy plików publikuje standardowy workflow, bez ręcznej zmiany wersji. Nie wykonano instalacji ani testu na fizycznym komputerze użytkownika; opublikowany instalator trzeba potwierdzić po workflow wydania.
