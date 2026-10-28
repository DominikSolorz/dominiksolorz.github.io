# HOME SECURITY mobile 0.1 — preview clients

These are real Android and iOS application projects. They load the authenticated owner panel from its existing HTTPS origin. They do not move accounts, copy passwords, bypass PIN, capture the phone camera or act as the Windows recorder.

## Current scope

- Android 11+ APK; iOS/iPadOS 17+ SwiftUI application.
- Native navigation for live view, recordings, settings and reload.
- Strict main-frame HTTPS/host/path allowlist; foreign pages open outside the app only after a deliberate link activation. No JavaScript-to-native credential bridge or TLS exceptions.
- Android prevents screenshots/recents capture and hides the web view in the background.
- iOS covers the panel when inactive and offers an optional Face ID/device-passcode gate. This is additional to the existing account/PIN, not an alternative.
- Sessions remain in the OS application's own WebView/WKWebView store. Browser sign-in is not transferred to the application.
- Preview authentication: email/password and the existing PIN. Embedded Google OAuth is deliberately blocked until a system-browser PKCE callback flow is implemented and its callback registered in the backend. Never copy browser tokens into the application.

## Build and verify

`.github/workflows/mobile-preview.yml` compiles Android, runs navigation unit tests and Android lint, and compiles/tests iOS on a simulator. It produces a debug-signed Android APK, unsigned Android release packages, an iOS simulator application, and an unsigned physical-device archive. The physical-device archive still requires owner signing; it is not an installable IPA. A simulator application cannot be installed on an iPhone.

The debug APK is for test devices, not customers. Hosted CI debug signing keys are disposable: do not use this package for long-term updates or store publication. Its application ID ends in `.preview`, separate from a future production app. Release APK/AAB requires an owner-controlled, durable signing key; never commit the key or its password.

## Release gates still open

1. Verify on physical Android and iPhone: account creation/confirmation, email login, PIN, live WebRTC video/audio, reconnect after backgrounding, recording playback/download, sign out and deletion of the account from within the app.
2. Complete Google OAuth using a system authentication session with PKCE, and configure the backend callbacks. Account deletion and Apple sign-in requirements must be assessed before App Review.
3. Validate iOS review guideline 4.2: do not submit a thin website wrapper as a completed native product. Native controls/privacy protections do not guarantee approval. No Apple/Google approval is claimed.
4. Add production app artwork, accessibility/device screenshots, privacy policy/Data Safety/App Privacy declarations based on actual data flows, and a review account with non-private test footage.
5. Sign Android with an owner-controlled release key (Play App Signing/upload key for Play), then test upgrades. Sign iOS with the owner's Apple Developer team and distribute first via TestFlight. Enrollment fees and agreements require the owner's decision.
6. Only replace website store placeholders with real App Store/Google Play URLs after the listings exist. Only advertise a signed, tested release APK as a customer download.

The current website's mobile panel links are web access, not these APK/IPA packages. Do not represent this preview work as a finished mobile release.
