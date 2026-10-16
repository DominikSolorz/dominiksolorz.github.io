# HOME SECURITY UI 193

Otwórz index.html, aby obejrzeć osiem plansz. To projekty wygenerowane wbudowanym
narzędziem imagegen, nie zrzuty uruchomionego programu. Nie zawierają prywatnego
obrazu użytkownika ani rzeczywistych poświadczeń. Oryginalne logo jest dołączone
jako ds-logo-original.jpg; złote herby wygenerowane w makietach są uproszczeniami.

## Zaimplementowane w tej iteracji

- Osobny, późno ładowany workspace-ui.css: wspólny czarno-czerwony motyw,
  stonowane karty, odstępy, focus klawiatury, stany disabled, responsywne dialogi.
- Osobna zakładka Alarmy na komputerze korzysta z rzeczywistej listy zdarzeń.
- Pełne menu przy pierwszym uruchomieniu; świadome zwinięcie jest zapamiętywane.
- Zachowane oryginalne kontrolki, instancja live video, PIN i źródła telemetrii.
- 59 testów automatycznych JS przeszło; nie jest to test wizualny każdego ekranu.

## Niezaimplementowane przez same grafiki

Wielokamerowy podgląd, klasyfikacja osób/pojazdów, czujniki drzwi, uzbrajanie,
wszystkie sprzętowe parametry obrazu, rozbudowana oś z miniaturami i nowy model
powiadomień. Nie dodano atrap przycisków ani fikcyjnych statystyk z ilustracji.

Nie wymieniono działającego EXE/instalatora i nie przeładowano aktywnego nadajnika.
Nie migrowano interfejsu do WPF/WinUI. Obecny EXE korzysta z WebView2, a nie Chrome.
Usunięcie zależności od silnika WWW wymaga migracji capture/recording do agenta,
natywnego odtwarzacza i ekranów oraz zgodnego klienta uwierzytelniania.

## Kolejność dalszej migracji

1. Zachować aktualny działający zapis i zweryfikować rzeczywisty plik.
2. Agent jako jedyny właściciel kamery, segmentów i kolejki; panel tylko polecenia.
3. Natywny interfejs WPF/WinUI i odtwarzacz live/DVR korzystające z kontraktu IPC.
4. Migracja istniejącego konta, PIN-u i folderu bez przenoszenia sekretów do UI.
5. Test równoległy i bezpieczna aktualizacja instalatora dopiero po testach.

## Prompty

Zestaw wejściowy do generowania znajduje się w PROMPTS.md. Obrazy są referencją
wizualną, nie są wstawiane zamiast działających kontrolek ani obrazu kamery.
