# HOME SECURITY / scripts — generowanie, publikacja i kontrola

Skrypty w tym katalogu są **narzędziami wykonującymi określone czynności**. Nie są samodzielnymi aplikacjami. Część jest uruchamiana przez GitHub Actions; dlatego zmiana nazwy pliku może przerwać publikację.

| Co chcesz zrobić | Plik |
| --- | --- |
| Zbudować wspólne strony publiczne | [build-marketing.mjs](build-marketing.mjs) |
| Przygotować dokumenty | [build-documents.mjs](build-documents.mjs) |
| Obsłużyć pobieranie i weryfikację wydania Windows | [desktop-release.mjs](desktop-release.mjs) |
| Zabezpieczyć publikowane strony | [harden-public-pages.mjs](harden-public-pages.mjs) |
| Spakować zasoby publiczne | [bundle-public-enhancements.mjs](bundle-public-enhancements.mjs) |
| Zmniejszyć zasoby strony | [minify-web-assets.mjs](minify-web-assets.mjs), [optimize-marketing-images.mjs](optimize-marketing-images.mjs) |
| Sprawdzić linki strony | [verify-site-links.mjs](verify-site-links.mjs) |
| Sprawdzić publicznie opublikowaną stronę | [verify-live-marketing.mjs](verify-live-marketing.mjs), [verify-public-browser.cjs](verify-public-browser.cjs) |
| Zrobić audyt strony i jej elementów | [audit-page.mjs](audit-page.mjs), [audit-page-inventory.mjs](audit-page-inventory.mjs) |
| Sprawdzić wydajność / wyniki Lighthouse | [summarize-lighthouse.mjs](summarize-lighthouse.mjs) |
| Przygotować podgląd aplikacji Windows | [preview-desktop-product.cjs](preview-desktop-product.cjs) |
| Sprawdzić podgląd aplikacji Windows | [verify-desktop-product.cjs](verify-desktop-product.cjs) |
| Uruchomić serwer podglądu | [preview-server.mjs](preview-server.mjs) |
| Sprawdzić układ dokumentów | [verify-document-layout.cjs](verify-document-layout.cjs) |
| Sprawdzić przeglądanie katalogów | [verify-folder-browser.cjs](verify-folder-browser.cjs) |
| Sprawdzić wdrożenie galerii | [verify-gallery-deployment.cjs](verify-gallery-deployment.cjs) |
| Sprawdzić widok mobilny i kamerę | [verify-mobile-viewer.cjs](verify-mobile-viewer.cjs), [verify-mobile-camera-frame.cjs](verify-mobile-camera-frame.cjs) |
| Sprawdzić funkcję obrazu w obrazie | [verify-pip-browser.cjs](verify-pip-browser.cjs) |
| Sprawdzić start nagrywania | [verify-recording-start.cjs](verify-recording-start.cjs) |
| Sprawdzić przewijanie strony | [verify-scroll.mjs](verify-scroll.mjs) |

## Zasada dla agentów

Przed uruchomieniem skryptu sprawdź jego argumenty, wymagane środowisko, efekty uboczne i miejsca użycia. Szczególnie ostrożnie traktuj skrypty pobierające lub publikujące wydania. Automaty są w [../.github/workflows/](../.github/workflows/), a testy w [../tests/](../tests/).

**Nie przenoś ani nie zmieniaj nazwy skryptu** bez zaktualizowania odwołań w workflow, testach, dokumentacji i innych skryptach.
