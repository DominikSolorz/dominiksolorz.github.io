# HOME SECURITY: redesign interfejsu

## Jak nazywa się ten zakres

To jest **redesign UI/UX aplikacji**. UI oznacza wygląd i elementy widoczne na ekranie: kolory, typografię, przyciski, ikony, karty, logo, miniatury i układ. UX oznacza sposób korzystania: kolejność ekranów, nazwy, czytelność, obsługę telefonu i komputera oraz to, czy użytkownik wie, co nacisnąć.

## Stały język dla kolejnych zleceń

„Zmień UI/UX panelu HOME SECURITY. Zachowaj funkcje, identyfikatory HTML, logowanie, PIN, WebRTC, nagrywanie, mapę i zdalną rozmowę. Zmień wyłącznie warstwę prezentacji: layout, spacing, kolory, typografię, przyciski, karty, ikony, logo i miniatury. Sprawdź telefon pionowo i poziomo oraz komputer.”

## Obszary interfejsu

| Obszar | Znaczenie |
| --- | --- |
| Design system | wspólne kolory, fonty, promienie, cienie i stany przycisków |
| Layout | rozmieszczenie nagłówka, kamery, sterowania, zdarzeń i nawigacji |
| Component UI | przyciski, karty kamery, listy zdarzeń, selektory i komunikaty |
| Responsive UI | automatyczne dopasowanie do telefonu, tabletu, laptopa i dużego monitora |
| Brand UI | logo, nazwa HOME SECURITY, ikony i miniatury |
| UX copy | krótkie, jednoznaczne nazwy przycisków i statusów |

## Zasada wdrażania

Zmiany wizualne trafiają do `kamera/visual-refresh.css`, a funkcje pozostają w istniejących modułach. Dzięki temu kolejny agent dostaje jeden plik odpowiedzialny za nowy wygląd i nie musi zgadywać, które elementy wolno zmienić.
