# HOME SECURITY / tests — testy według funkcji

Pliki `*.test.mjs` w tym katalogu są testami regresji. Ich nazwy odpowiadają częściom aplikacji, które chronią. **Nie edytuj testów zamiast naprawiać usterkę w kodzie.**

| Obszar | Przykładowe testy |
| --- | --- |
| Konto, logowanie, dostęp i PIN | [auth-session.test.mjs](auth-session.test.mjs), [account-security.test.mjs](account-security.test.mjs), [remote-phone-pin-e2e.test.mjs](remote-phone-pin-e2e.test.mjs) |
| Kamery, obraz i strumień | [camera-workspace.test.mjs](camera-workspace.test.mjs), [camera-fit.test.mjs](camera-fit.test.mjs), [streaming.test.mjs](streaming.test.mjs) |
| Telefon / PWA | [mobile-camera-frame.test.mjs](mobile-camera-frame.test.mjs), [mobile-camera-status.test.mjs](mobile-camera-status.test.mjs), [mobile-updates.test.mjs](mobile-updates.test.mjs) |
| Nagrywanie i archiwum | [recording-init.test.mjs](recording-init.test.mjs), [recording-storage.test.mjs](recording-storage.test.mjs), [dvr-time-navigation.test.mjs](dvr-time-navigation.test.mjs), [archive-entry-regression.test.mjs](archive-entry-regression.test.mjs) |
| Windows, instalator i aktualizacje | [desktop-bundle.test.mjs](desktop-bundle.test.mjs), [desktop-update-center.test.mjs](desktop-update-center.test.mjs), [scheduled-release.test.mjs](scheduled-release.test.mjs), [release-consistency.test.mjs](release-consistency.test.mjs) |
| Strona publiczna i nawigacja | [marketing.test.mjs](marketing.test.mjs), [marketing-navigation.test.mjs](marketing-navigation.test.mjs), [public-subpages.test.mjs](public-subpages.test.mjs), [public-seo.test.mjs](public-seo.test.mjs) |
| Wygląd panelu | [premium-dark-pro.test.mjs](premium-dark-pro.test.mjs), [workspace-ui.test.mjs](workspace-ui.test.mjs), [interface-theme.test.mjs](interface-theme.test.mjs) |
| Pomoc, kontakt i dokumenty | [support.test.mjs](support.test.mjs), [contact.test.mjs](contact.test.mjs), [document-generation.test.mjs](document-generation.test.mjs) |

Ta tabela jest punktem wejścia, nie pełnym spisem wszystkich testów. Pozostałe pliki są widoczne w tym katalogu.

## Jak sprawdzać zmiany

Workflow GitHub Pages używa polecenia:

```bash
node --test tests/*.test.mjs
```

Do pojedynczego testu można użyć np. `node --test tests/mobile-camera-frame.test.mjs`. Przed uruchomieniem sprawdź wymagania środowiskowe konkretnego testu. Dodatkowe testy są w [../kamera/tests/](../kamera/tests/) i [../agent-tests/](../agent-tests/). Kompilacja .NET ma osobny proces.

Agent powinien najpierw wskazać plik funkcji, potem testy tej funkcji, a na końcu pokazać wynik uruchomienia. Sam opis w dokumentacji nie oznacza, że test rzeczywiście przeszedł.
