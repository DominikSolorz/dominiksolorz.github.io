# HOME SECURITY Desktop 1.3.4 — local release candidate

Prepared 2026-10-16. This is a locally built release candidate, not a deployed
update and not a successful installed-app acceptance test.

## Included

- Native shell build marker 185, aligned with the web release manifest.
- Restricted native page telemetry; arbitrary page payloads are not persisted.
- Runtime, project and installer version alignment tests.
- Existing installer identity and separate user data folder are preserved.

## Artifacts

- `desktop-client/installer-output/HOME-SECURITY-Desktop-Setup-1.3.4.exe`
- `desktop-client/installer-output/HomeSecurityDesktop-1.3.4-win-x64.zip`
- ZIP SHA256: `BE4F5F5F1844B120DAE53FDB13A5C402B6B573A849F4D1877FA05690F6A898E9`

The ZIP contains the single-file Windows x64 executable and bridge test assets.
The executable reports file version 1.3.4.0. No OAuth JSON, tokens or user data
are included in the update archive.

## Verification and release boundary

Self-contained publish completed; 16 frontend/release checks passed. The build
still emits the existing WebView2/WPF WindowsBase dependency warning. Installer
compilation is a packaging check, not proof of successful installation or camera
operation. The running application was not replaced or stopped.

The public update manifest remains 1.3.3. Publish the matching web assets and ZIP,
verify their public contents/hash, then change the public manifest to 1.3.4.
Do not announce an update before its package is available.

Google account login in an external browser does not yet hand its session back
to WebView2. The native agent recorder migration is also not included.
