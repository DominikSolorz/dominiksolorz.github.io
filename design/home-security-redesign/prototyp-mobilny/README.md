# HOME SECURITY – prototyp wyglądu aplikacji mobilnej (demo)

Czysty HTML + CSS + JS, bez zależności i bez sieci. Otwórz `index.html` w przeglądarce
(najlepiej Chrome na telefonie) albo uruchom: `python3 -m http.server -d design/home-security-redesign/prototyp-mobilny`.
Adres bezpośredni do ekranu: `index.html#login`, `#pin`, `#dash` itd.

## Osiem ekranów

| # | Id | Ekran |
|---|----|-------|
| 1 | `start` | Oczekiwanie: 3 banery reklamowe 16:9 (co 10 s), „Pomiń”, po 30 s → wprowadzenie |
| 2 | `intro` | Wprowadzenie |
| 3 | `login` | Logowanie |
| 4 | `pin` | Kod PIN |
| 5 | `dash` | Pulpit |
| 6 | `cams` | Kamery |
| 7 | `recs` | Nagrania |
| 8 | `settings` | Ustawienia |

Domyślnie prototyp wygląda jak aplikacja (bez paska przełączania). Przełącznik ekranów pojawia się po dodaniu `?demo=1` do adresu. „Dodaj do ekranu głównego” w Chrome otwiera go pełnoekranowo (`manifest.webmanifest`, osobny zakres, bez wpływu na istniejące PWA).

## Wyłącznie demonstracyjne

- Górny przełącznik ekranów i przyciski „Dalej (demo)”, „Wyloguj (demo)”.
- Pola logowania są wyłączone, klawiatura PIN nie weryfikuje niczego.
- Zdjęcia w kamerach i nagraniach (`zdjecia/`) to przykładowe kadry z wcześniejszych makiet (kopie z `../assets/demo-*.webp`), oznaczone jako „Przykład”. To nie jest transmisja ani prawdziwe nagranie.
- Brak imienia użytkownika, liczników zdarzeń, alarmów i statystyk.
- Banery w `reklama/` to kopie zatwierdzonych grafik z `kamera/assets/` (`home-security-loading`, `-ad-02`, `-ad-03`). Pliki w `kamera/` nie zostały zmienione.
- Rotacja 10 s / 30 s i „Pomiń” na ekranie 1 tylko pokazują kolejność. Prawdziwa reklama mobilna (przy odświeżeniu strony głównej w Chrome) działa w istniejącym mechanizmie i nie została tu zastąpiona ani zduplikowana.
- Pasek pod banerem to wskaźnik czasu demo (30 s).

## Czego prototyp nie dotyka

`kamera/`, logowanie, PIN, baza danych, nagrywanie, aplikacja Windows, PWA, reklama mobilna.

## Do zrobienia przed wdrożeniem

- Integracja z istniejącym panelem po zatwierdzeniu (podpięcie prawdziwego logowania, PIN-u, kamer).
- Podmiana miejsc na obraz prawdziwymi podglądami i miniaturami.
- Funkcje z makiet, których aplikacja nie obsługuje (np. „Chmura”, „Profil”, odcisk palca), wymagają decyzji.
- Test na fizycznych telefonach i w Chrome (pion/poziom, małe ekrany).
- Porównanie 1:1 z oryginalnymi PNG z ZIP-a.
