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

## Android 0.2 phone interface and emulator checks

Android now starts on a native phone dashboard with four bottom destinations, 48dp+ touch targets and a scrollable single-column layout. Account/PIN and private media stay in the existing phone panel. Native retry/error screens replace raw WebView network errors. Duplicate web navigation is hidden in the Android client.

`android-emulator.yml` installs and runs the actual APK on Android API 30 and 35 phone emulators. Instrumentation covers home/navigation, narrow screen and font scale, landscape, background/resume, offline retry, a fresh public login page, and synthetic canvas-to-WebRTC-to-video playback. The debug-only fixture explicitly labels its video as test media. It does not authenticate a real account or prove production signaling, Windows capture or recordings. The separate instrumentation APK verifies FLAG_SECURE when each Activity is created and clears it before drawing fresh/synthetic test data, avoiding stale secure surfaces during capture. The override is never part of the application APK. Release APKs do not contain the fixture asset, ignore its debug intent, and keep screen-capture protection.

The emulator's Android 11 image contains WebView 83 (2020), which cannot execute the app's modern panel modules. The app now presents an explicit system-component update screen below WebView 124, instead of opening a broken viewer. API 30 tests verify this compatibility guard and native UI; synthetic WebRTC and public account login are exercised on the supported engine in API 35. The ordinary OS remains supported once its WebView is updated. Account entry URLs include auth=login so they open the private gate instead of the marketing homepage. Native Android tab changes reuse the existing gated page and dispatch only its view-selection controls, without bypassing account/PIN.
