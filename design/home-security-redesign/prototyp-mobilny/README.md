# HOME SECURITY – prototyp wyglądu aplikacji mobilnej (demo)

Czysty HTML + CSS + JS, bez zależności i bez sieci. Otwórz `index.html` w przeglądarce
(najlepiej Chrome na telefonie) albo uruchom: `python3 -m http.server -d design/home-security-redesign/prototyp-mobilny`.
Adres bezpośredni do ekranu: `index.html#login`, `#pin`, `#dash` itd.

## Osiem ekranów

| # | Id | Ekran |
|---|----|-------|
| 1 | `start` | Ekran startowy / ładowanie aplikacji |
| 2 | `intro` | Wprowadzenie |
| 3 | `login` | Logowanie |
| 4 | `pin` | Kod PIN |
| 5 | `dash` | Pulpit |
| 6 | `cams` | Kamery |
| 7 | `recs` | Nagrania |
| 8 | `settings` | Ustawienia |

## Wyłącznie demonstracyjne

- Górny przełącznik ekranów i przyciski „Dalej (demo)”, „Wyloguj (demo)”.
- Pola logowania są wyłączone, klawiatura PIN nie weryfikuje niczego.
- Kamery i nagrania to puste miejsca na obraz, bez transmisji i bez danych.
- Brak imienia użytkownika, liczników zdarzeń, alarmów i statystyk.
- Pasek ładowania jest animacją, nie pokazuje postępu.
- Reklama startowa 30 s NIE jest częścią prototypu (istnieje osobny mechanizm w projekcie).

## Czego prototyp nie dotyka

`kamera/`, logowanie, PIN, baza danych, nagrywanie, aplikacja Windows, PWA, reklama mobilna.

## Do zrobienia przed wdrożeniem

- Integracja z istniejącym panelem po zatwierdzeniu (podpięcie prawdziwego logowania, PIN-u, kamer).
- Podmiana miejsc na obraz prawdziwymi podglądami i miniaturami.
- Funkcje z makiet, których aplikacja nie obsługuje (np. „Chmura”, „Profil”, odcisk palca), wymagają decyzji.
- Test na fizycznych telefonach i w Chrome (pion/poziom, małe ekrany).
- Porównanie 1:1 z oryginalnymi PNG z ZIP-a.
