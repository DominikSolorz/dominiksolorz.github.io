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

- Live Chrome acceptance on 2026-10-16: Google sign-in returned to the local application and opened the existing profile. A read-only database check confirmed one matching account, a linked Google identity, confirmed email and an existing PIN. Both profile consent timestamps were absent. The flow correctly stops for explicit application-terms acceptance; no consent was fabricated and the PIN was not changed. An explanatory message was added and verified in Chrome. The subsequent device/PIN/panel acceptance test remains pending.
- Google Cloud remains in Testing. Do not describe the app as Google-verified or publicly production-ready.
- No GitHub Pages deployment or EXE installer rebuild was performed.
- Embedded WebView2 login is intentionally blocked; use the existing email/password method in Windows until a system-browser session handoff is implemented. Never bypass Google's embedded-user-agent restrictions or copy tokens through public URLs.
- Existing email verification remains in place; no role, RLS, camera, or Drive token changes were made.

## Local checks

Release alignment: panel manifest/runtime/script version 185, auth module 10, styles 180 and service-worker build/cache 87. `tests/release-consistency.test.mjs` verifies those relationships. Different module counters are deliberate; the release manifest and runtime must agree.

2026-10-16 migration preparation: two byte-identical Desktop JSON files for the new project were found on the Desktop and validated without printing their secrets. New candidate integration ID: `2d54d15d-2dd4-476b-9f1a-6b9c77ac48a1`. The native Picker authorization reached Google's unverified-app warning. It was not bypassed, no new successful authorization or upload is claimed, and the prior integration was not replaced. Explicit approval is required before proceeding past the warning. Application-terms acceptance and entry of the user's existing PIN remain separate user actions.

Run `node tests/device-entry.cjs` and `node --test tests/frontend-core.test.mjs` from the repository root.
