# HOME SECURITY Desktop 1.4.6

This release packages the actual new marketing homepage, blog, contact page and server-backed support chat into the installed Windows application. The browser website remains independently published. There are no new native Android or iOS store binaries in this release.

## Changes

- Current public HTML, DS artwork, marketing styles and support modules are included in `Panel/` in the installer and update ZIP.
- Native shell-cache generation now includes both desktop release and web protocol build. Updating HTML/CSS no longer requires incrementing the live transmitter's protocol version to invalidate an old native shell cache.
- Cache refresh targets only browser cache, service workers and Cache Storage; account session, local storage, IndexedDB, PIN and recordings are preserved.
- The isolated WebView2 bundle test checks all support resources and actually mounts the dialog, including six topic options. The test denies camera permissions and uses a separate profile, without loading recording/account runtime or submitting AI requests.
- Installer, desktop metadata, update manifest and homepage download links agree on 1.4.6. Previous 1.4.5 remains the published rollback ZIP.

## Evidence

- 152 frontend/regression tests passed locally.
- Native self-contained publish succeeded on .NET SDK 10.0.400. The pre-existing WindowsBase assembly-reference warning remains; no new compilation errors.
- Isolated WebView2 bundle result: `ok=true`, 13 files HTTP 200, missing file 404, `supportMounted=true`, `topics=6`.
- ZIP checked for native EXE, versioned agent and support assets; no `.env` or Apps Script files.
- ZIP SHA256: `2A90B0FADF16FD5E33E824391D1D4FFA53F5980DD769E376C88E94CB8FCD5DF4`.
- Installer SHA256: `B41C1B9B44E572AFF82FAE9618FBC77687439D8832D6AF260F21A8A4FC0535FE`.

The release was compiled from tracked HEAD source plus reviewed release changes in an isolated output directory. Unfinished native recorder files in the working directory were not included. This release does not migrate capture to the independent agent or claim new real-camera/Drive recording verification.

The public chat already has live you.bot verification. Its contact handoff pre-fills the contact form; automatic server-side email sending is still not enabled. See `HOME-SUPPORT.md` for rate limits and privacy.

Runtime inventory before installation identified a still-running development EXE 1.2.0 and separately installed 1.4.5. Installation and launching from the installed path must be verified separately from package creation. The old transmitter must not be force-killed simply to update the public homepage.
