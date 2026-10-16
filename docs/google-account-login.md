# Google account login

This is account authentication through Supabase, not the native Drive integration.

## Configured services

- Google Cloud project: `intricate-abbey-511811-d3` (HOME SECURITY).
- Web client: `HOME SECURITY Login Web`. The Desktop client is not used here.
- Authorized Google redirect: `https://ksacbcrzuwdahnmggfxg.supabase.co/auth/v1/callback`.
- Google provider enabled in Supabase. Client secret is stored only in provider settings, never in frontend code.
- Browser request scopes: `openid email profile`. No Drive permission is requested by login.
- Production site URL remains `https://dominiksolorz.github.io/kamera/`.
- An exact development redirect `http://127.0.0.1:4173/` was added; remove when local testing is no longer needed.
- Nonce checking remains enabled, and users without an email remain disallowed.

## Flow and verification

1. User selects Google on the login form.
2. Supabase redirects to Google, then exchanges the authorization code server-side.
3. The existing browser client detects the returned Supabase session.
4. `getUser()` validates the account with Supabase. Google-linked accounts without `email_confirmed_at` are rejected by the account gate.
5. Missing profile and terms acceptance are completed explicitly, then device selection and the existing PIN gate apply.

Google confirmation is not an application-controlled email OTP or guaranteed Google MFA challenge on every login. Google controls its own account challenges. Mandatory application MFA would require a separate implementation.

## Limits of this iteration

- Live Chrome acceptance on 2026-10-16: Google sign-in returned to the existing account. After explicit user authorization, application terms/privacy acceptance was submitted through the profile form. Computer selection opened the existing PIN gate, and the user-supplied PIN opened the desktop dashboard. A fresh entry again required device selection and PIN, without repeating profile consent. A controlled invalid PIN produced `Zły PIN. Spróbuj ponownie.` while the gate remained visible; screenshot evidence was saved locally. The user's PIN was neither reset nor written to source/test files. This is a local browser acceptance result, not a full server-authorization audit or EXE acceptance.
- Google Cloud remains in Testing. Do not describe the app as Google-verified or publicly production-ready.
- No GitHub Pages deployment or EXE installer rebuild was performed.
- Embedded WebView2 login is intentionally blocked; use the existing email/password method in Windows until a system-browser session handoff is implemented. Never bypass Google's embedded-user-agent restrictions or copy tokens through public URLs.
- Existing email verification remains in place; no role, RLS, camera, or Drive token changes were made.

## Local checks

Release alignment: panel manifest/runtime/script version 185, auth module 10, styles 180 and service-worker build/cache 87. `tests/release-consistency.test.mjs` verifies those relationships. Different module counters are deliberate; the release manifest and runtime must agree.

2026-10-16 Drive migration acceptance: two byte-identical Desktop JSON files for HOME SECURITY were validated. After explicit approval to continue the unverified-app test, native Picker consent completed for integration `2d54d15d-2dd4-476b-9f1a-6b9c77ac48a1`. The agent confirmed the selected folder through Drive API and saved credentials with DPAPI. Harmless fixture upload job `f8f5869f-3684-4ff7-ac54-7457da58df34` succeeded on attempt 1; remote file ID `1XGDefpE7JOVZ9NFtbVjMEOZIa_RM6yJz`, 248 bytes, correct parent folder. Connector metadata independently confirmed the file. The prior DS MAIL integration and existing jobs were preserved. This does not automatically migrate the legacy app.js/Apps Script recorder or choose a global default integration.

Folder privacy acceptance: initial independent metadata reported public `anyone`/`writer` access. After retrying the sharing dialog, general access was changed to restricted. Google confirmed the permission update, and independent API readback returned only the owner permission, with no `anyone` entry. Screenshot evidence was saved locally. Only the harmless fixture was uploaded. New-project OAuth remains in Testing; no production-readiness claim is made.

Run `node tests/device-entry.cjs` and `node --test tests/frontend-core.test.mjs` from the repository root.
