# Mobile web application 273

The mobile layout is now part of the real account/PIN application. It is not a redirect to the isolated demonstration.

- Phone entry at `/kamera/`: the existing three promotional banners (30 seconds total), followed by a mobile welcome page with real login and registration links. A separate, explicit link opens the account-free preview.
- Login and PIN use the existing account and verification modules. No credentials, demo PIN or authenticated session are injected into the production application. A normal anonymous visit no longer displays a false session-restoration warning.
- After verification, the real overview offers six tiles: cameras, recordings, events, settings, cloud storage and profile. Tiles and four navigation tabs route to existing functions. Profile reuses the original account button; cloud opens the existing recording storage panel.
- Video and recorder elements are retained; camera viewing still requires an explicit camera action.
- The phone theme is loaded after the shared operator stylesheet and scopes overrides to `mobileOwnerMode`. The overview uses its real ID in selectors because the shared theme's `:is()` includes an ID and therefore has higher specificity than plain class selectors.
- A plain mobile `/kamera/panel.html` requests account verification rather than falling back to the old marketing page. Owner and receiver security gates remain intact.
- Web manifest version: 273. Service worker generation: 193. Mobile module: 31, account module: 16, mobile stylesheet: 2. The new asset URLs avoid reusing the old cached mobile shell; no account storage or recordings are cleared.

A fresh mobile-layout entry is `/kamera/?layout=manual&ui=phone&hs_release=273`; it also permits testing the phone layout in a desktop browser. Automatic phone detection remains active for the ordinary `/kamera/` URL. `hs_release` uses the existing fresh-navigation mechanism, not a PIN or authorization shortcut.

Verification: `node --test tests/*.test.mjs kamera/tests/*.test.mjs`; `CHROMIUM_PATH=/usr/bin/chromium node scripts/verify-real-mobile-layout.cjs`. Browser tests use isolated account responses with the real PBKDF2 PIN flow and confirm that a wrong PIN does not expose the app, a valid fixture PIN does, profile opens and navigation preserves the original video element. With `HS_REAL_MOBILE_LIVE=1` the same checks target deployed assets. No physical-phone or real-camera test is implied.
