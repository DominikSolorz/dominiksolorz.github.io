# HOME SECURITY — projekt graficzny (wersja demonstracyjna)

Własna implementacja HTML/CSS/JS na podstawie makiet właściciela (paczka z 21 osobnymi
obrazami). **To nie jest działający panel ani kod żadnej innej strony.** Folder nie jest
publikowany (`pages.yml` wyklucza `/design/`) i nie uruchamia wydania Windows.

Podgląd: otwórz `index.html` w przeglądarce. Przycisk **„Ekrany (21)”** w prawym dolnym
rogu prowadzi do każdego widoku; adresy mają postać `index.html#pulpit`, `#logowanie` itd.

## Pliki

| Plik | Rola |
| --- | --- |
| `index.template.html` | Źródło struktury wszystkich 21 ekranów (edytuj ten plik). |
| `index.html` | Wynik `build.mjs` — szablon + dokumenty prawne + dane kontaktowe. |
| `style.css` | Wygląd, kolory, układ responsywny (komputer, tablet, telefon). |
| `app.js` | Przełączanie ekranów, menu, PIN demo, filtry, FAQ, formularze demo, oś czasu. Bez żądań sieciowych. |
| `build.mjs` | `node design/home-security-redesign/build.mjs` — buduje `index.html`; `--check` sprawdza aktualność. |
| `verify.mjs` | `node design/home-security-redesign/verify.mjs` — kontrola oznaczeń DEMO, braku sieci, zgodności treści prawnych. |
| `assets/demo-*.webp` | Kadry wycięte z makiet właściciela (dom, 6 kamer, plan obiektu, archiwum). |

## Ekrany i ich stan

| Nr | Ekran | Adres | Co jest prawdziwe | Co jest wyłącznie makietą |
| --- | --- | --- | --- | --- |
| 1 | Strona główna | `#start` | Opis produktu z obecnej strony | Zdjęcia — ilustracje z makiet |
| 2 | Logowanie | `#logowanie` | Kolejność: konto → PIN | Nie loguje; „Nie pamiętasz hasła” i Google tylko pokazują komunikat |
| 3 | Rejestracja | `#rejestracja` | Zasada min. 10 znaków, zgody z linkami do dokumentów | Nie tworzy konta; prawdziwy formularz ma też adres i kod pocztowy |
| 4 | PIN | `#pin` | 4 lub 6 cyfr | PIN nie jest sprawdzany ani zapisywany |
| 5 | Pulpit główny | `#pulpit` | Układ | Kamery, alerty, mapa, statystyki, stan systemu, „92%” — **DEMO** |
| 6 | Kamery | `#kamery` | Układy siatki, pełny ekran kafelka | Wszystkie kamery i obraz — **DEMO** (zdjęcia z makiet) |
| 7 | Archiwum | `#archiwum` | Oś czasu jako wskaźnik | Brak nagrań; odtwarzanie i eksport — **DEMO** |
| 8 | Zdarzenia i alerty | `#zdarzenia` | Filtry działają na liście przykładowej | Wszystkie wpisy — **DEMO**; rozpoznawanie osób/pojazdów nie istnieje w HOME SECURITY |
| 9 | Ustawienia | `#ustawienia` | Zapis w localStorage tej przeglądarki | Nie wpływa na kamerę ani konto |
| 10 | Jak działa | `#jak-dziala` | Treść z `design/marketing/jak-dziala.html` | — |
| 11 | Możliwości | `#mozliwosci` | Treść z `design/marketing/mozliwosci.html` | — |
| 12 | Pierwsze uruchomienie | `#pierwsze-uruchomienie` | Skrót poradnika | — |
| 13 | Wymagania | `#wymagania` | Tabela z `design/marketing/wymagania.html` | — |
| 14 | Pobierz | `#pobierz` | Link do prawdziwej strony pobierania; sklepy oznaczone jako nieopublikowane | — |
| 15 | Kontakt i pomoc | `#kontakt` | E-mail i telefon z `design/documents/operator.json` | Formularz **DEMO** — nic nie wysyła |
| 16 | FAQ | `#faq` | Pytania i odpowiedzi z `design/marketing/pytania.html`, wyszukiwarka | — |
| 17 | Dokumenty | `#dokumenty` | Spis dokumentów | — |
| 18 | Stan projektu | `#stan-projektu` | Treść z `design/marketing/stan-projektu.html` | — |
| 19–21 | Polityka prywatności, RODO, Regulamin | `#polityka-prywatnosci`, `#rodo`, `#regulamin` | Treść **1:1** z `design/documents/` (kontrolowane w `verify.mjs`) | — |

## Czego z makiet świadomie nie przeniesiono

Makiety zawierały elementy, których HOME SECURITY nie ma albo nie może obiecać. Nie
przeniesiono: „Kompleksowa ochrona 24/7”, „50 000+ użytkowników”, „98% skuteczności”,
„4,9/5”, opinii klientów, „Wypróbuj za darmo przez 14 dni”, cennika, przycisków App Store
i Google Play jako dostępnych aplikacji, czatu na żywo, adresu `pomoc@homesecurity.pl`,
numerów +48 22 / +48 800, logowania przez Apple i Microsoft, „Zapamiętaj mnie”.
Kontakt pochodzi z `operator.json`.

## Następny krok (wymaga zgody)

Przeniesienie wyglądu do prawdziwej strony (`design/marketing/`, `kamera/marketing.css`)
lub panelu (`kamera/`) to osobne zadanie z planem, testami i publikacją.
