# STRONA WWW — HOME SECURITY

To jest punkt wejścia do publicznej strony WWW. **HTML, CSS i JavaScript strony pozostają pod publicznym adresem `/kamera/`**, ponieważ GitHub Pages, linki użytkowników, PWA i instalator korzystają z tych adresów. Przeniesienie ich bez warstwy zgodności zepsułoby istniejące URL.

## HTML
- `kamera/index.html` — strona główna.
- `kamera/o-systemie.html` — o systemie.
- `kamera/pobierz.html` — pobieranie.
- `kamera/pomoc.html`, `kamera/kontakt.html`, `kamera/faq.html` — pomoc i kontakt.
- `kamera/regulamin.html`, `kamera/polityka-prywatnosci.html`, `kamera/rodo.html` — dokumenty.

## CSS
- `kamera/marketing.css`
- `kamera/marketing-navigation.css`
- `kamera/marketing-motion.css`
- `kamera/marketing-shell.css`

## JavaScript
- `kamera/public-entry.js`
- `kamera/marketing-navigation.mjs`
- `kamera/marketing-motion.mjs`
- `kamera/support-view.mjs`

## Generator i publikacja
- `scripts/build-marketing.mjs` — wspólne generowanie stron.
- `scripts/harden-public-pages.mjs` — zabezpieczenia publicznych stron.
- `.github/workflows/pages.yml` — GitHub Pages.
- `hosting/public-site/` — osobna statyczna prezentacja Vercel; nie prywatny panel.

Agentowi można powiedzieć: **„STRONA WWW: zmień stronę główną”**. Powinien pracować wyłącznie na powyższym obszarze, chyba że zmiana świadomie wymaga wspólnego panelu/PWA.
