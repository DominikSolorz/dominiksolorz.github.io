# HOME SECURITY — gotowość strony i produktu do udostępnienia klientom
Data audytu: 27.10.2026 · Obowiązuje wydanie internetowe 219 po publikacji odpowiedniego commita.

## Zakres i dowody
Repozytorium: https://github.com/DominikSolorz/dominiksolorz.github.io
Produkt: https://dominiksolorz.github.io/kamera/o-systemie.html
Galeria koncepcji: https://dominiksolorz.github.io/kamera/galeria.html
Test realnych stron: `scripts/verify-live-marketing.mjs` uruchamiany po wdrożeniu, plus publiczne zrzuty przeglądarkowe z GitHub Actions. Zrzuty z Actions są ZRZUTAMI WITRYNY lub publicznych formularzy logowania, nie nagraniem kamery.

## Etapy prac

### 1. Prawdziwe zdjęcia ekranów produktu
- [x] Istniejące materiały koncepcyjne 193 zostały opisane uczciwie jako projekty i są dostępne w galeriach.
- [x] Po wdrożeniu proces CI próbuje zarejestrować rzeczywiste ekrany publicznej strony głównej, galerii i niewypełnionych formularzy logowania/rejestracji.
- [ ] Prawdziwe zrzuty **autoryzowanego pulpitu Windows, działającego obrazu, archiwum i diagnostyki** nie są dostępne w tej sesji. Nie generować ich syntetycznie i nie zastępować danymi osób trzecich.
- [ ] Po uzyskaniu zgody właściciela i neutralnej kamery testowej zastąpić część makiet rzeczywistymi ekranami aktualnego wydania; zachować widoczne etykiety „projekt” tam, gdzie makiety pozostaną.

### 2. Film demonstracyjny
- [x] Przygotowany jest szczegółowy scenariusz: `docs/home-security-real-demo-shotlist.md`.
- [ ] Autentyczny film pokazujący realne połączenie i zapis: nie można go odpowiedzialnie stworzyć z dostępnych nagrań. Aktualne udostępnione pliki MP4 pokazują inne oprogramowanie. Nie umieszczać fikcyjnego odtwarzacza, napisów „Zobacz demo” z pustym linkiem ani nagrania z obcej kamery.
- [ ] Po zarejestrowaniu poprawnego źródła: montaż, napisy PL, wersja bez dźwięku, krótki kadr pionowy i poziomy, optymalizacja WebM/MP4, dopiero potem publikacja.

### 3. Strona marketingowa
- [x] Pierwszy ekran, wizualizacja panelu, galeria koncepcji, scenariusze, proces Windows/telefon, prawdziwe ograniczenia wydania i FAQ.
- [x] Lista kontrolna wymagań, w całości lokalna w przeglądarce, bez sprawdzania sprzętu i bez wysyłki odpowiedzi.
- [x] Przejrzysta informacja o braku cennika i procesu zakupu. Konto nie jest opłatą.
- [x] Przygotowany responsywny CSS, animacje z trybem prefers-reduced-motion, obsługa klawiatury.
- [ ] Niezależny przegląd jakości wizualnej na prawdziwym Androidzie, iPhonie i komputerze wykonany przez człowieka — nie mylić ze zrzutami syntetycznego viewportu Chromium.

### 4. Sprzedaż i oferta
- [x] Zamiast nieuzgodnionej ceny pokazujemy uczciwą informację i sprawny kanał zapytania.
- [ ] Właściciel musi zdecydować: model bezpłatny/testowy/abonament/jednorazowo, konkretny zakres świadczenia, cena i podatki, rozliczenia, gwarancje i wsparcie.
- [ ] Brak uruchomionej bramki płatniczej i koszyka — nie aktywować przy braku cen i formalnych danych sprzedawcy.
- [ ] Dane identyfikacyjne podmiotu oferującego usługę, kontakt reklamacyjny, zasady rozwiązywania umowy, zwrotów/odstąpienia i ograniczeń odpowiedzialności wymagają zatwierdzenia przez właściciela i specjalistę.

### 5. Bezpieczeństwo i prawo
- [x] Kontrola zgodności linków dokumentów prawnych: powrót prowadzi do marketingu, nie do logowania.
- [x] Dokumenty `polityka-prywatnosci.html`, `rodo.html`, `regulamin.html` nadal oznaczone jako SZABLONY i `noindex` — nie przedstawiać ich jako finalnie zatwierdzonych.
- [ ] RODO, art. 13: zweryfikować tożsamość administratora/kategorie danych/podstawy prawne/odbiorców i przekazania danych/okres retencji/prawa osób oraz odrębnie rolę operatora kont i właściciela kamery. Źródło: https://eur-lex.europa.eu/eli/reg/2016/679/oj/pol
- [ ] Sprzedaż na odległość: pełna tożsamość usługodawcy, cena z podatkami, czas i zakres świadczenia, reklamacje, odstąpienie itd. Źródło: https://biznes.gov.pl/pl/portal/00146
- [ ] Doradca bezpieczeństwa Supabase (27.10.2026) zgłosił: **auth_leaked_password_protection = disabled**. Funkcja dostępna na planie Pro i wyższym. Sprawdzić abonament i włączyć w Authentication/Password Security, następnie uruchomić advisors ponownie: https://supabase.com/docs/guides/auth/password-security
- [ ] Supabase: informacyjne ostrzeżenie o tabeli `public.home_support_budget` z włączonym RLS bez polityk. Jeśli tabela jest tylko wewnętrzna, brak publicznych polityk może być celowy; nie odblokowywać jej użytkownikom bez sprawdzenia modelu dostępu.
- [ ] Zewnętrzne połączenia: zweryfikować w polityce cookies, Supabase Auth, kontakt, Google Drive i dostawców hostingu oraz realistyczne terminy retencji.

### 6. Test końcowy ścieżki użytkownika
- [x] Automatyczne testy jednostkowe/regresyjne, generowania stron i kompletności aktywów.
- [x] Dodany read-only smoke HTTP produkcji po deployu: prawdziwe adresy, błędy HTTP 404, galeria, regulaminy, instalator.
- [x] Dodane zrzuty rzeczywistych PUBLICZNYCH ekranów przeglądarki wykonywane po deployu jako artefakty CI (o ile przeglądarka jest na runnerze).
- [ ] Zgłoszenie kontaktowe musi zostać przetestowane z faktycznym doręczeniem tylko za świadomą zgodą adresata. Sam kod/OPTIONS nie dowodzą doręczenia.
- [ ] Rejestracja, potwierdzenie e-mail, logowanie Google, nadanie PIN, pierwsze połączenie Windows/WebRTC, zapis lokalny, odtwarzanie, usunięcie konta i odzyskanie hasła wymagają testu na dedykowanych kontach testowych i sprzęcie, bez dotykania prywatnej instalacji.
- [ ] Realne Core Web Vitals/LCP/CLS/INP z testów Lighthouse/RUM nie zostały zmierzone; nie podawać wymyślonych wyników.

## Kryterium ukończenia sprzedażowego
Nie ogłaszać końca prac handlowych, dopóki nie ma: zatwierdzonej oferty z tożsamością sprzedawcy i cenami, uzupełnionych dokumentów prawnych, rzeczywistego filmu z testowej kamery oraz pozytywnych manualnych testów od nowego konta po potwierdzony plik nagrania.

## Zasada kolejności
Wydzielona przyszła przebudowa rzeczywistego programu Windows i panelu mobilnego zgodnie z planszami 193 jest odrębnym, OSTATNIM etapem, nie częścią obecnej pracy nad marketingiem.
