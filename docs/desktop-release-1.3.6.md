# HOME SECURITY 1.3.6 / web 194

Prepared 2026-10-17. Actual interface controls, not image-based overlays.

## Implemented

- Desktop six-module routing: live, controls, alarms, recordings, settings,
  diagnostics. Archive may be left through sidebar navigation without stopping
  capture. Existing live video instance is retained.
- Controls has a muted preview sharing the existing stream (no second capture),
  existing single Start/Stop/Restart set and existing camera/device controls.
- Alarm workspace renders actual camera-event telemetry: date and motion/sound
  filters, detail selection and session-only read acknowledgement. New events can
  contain bounded JPEG frames captured from the authorized camera. No invented
  cameras, people/car classification or alarm arming state.
- Settings has vertical existing categories and contextual help. Unsupported
  hardware settings are not fabricated to match mockups.
- Diagnostics renders component cards and a filtered actual Store log. Unknown
  and stale data never become healthy; durable auth/error states remain failures.
- Mobile reuses actual event/detail and diagnostic modules and existing four-tab
  routing. Browser version remains supported; no App Store/Play listing claimed.
- DVR gets actual decoded thumbnails when a recording is opened, retains up to
  64 frame previews in this UI session and shows available previews in a strip.
  No background download of every video or fabricated stock thumbnail. Historical
  recordings are not retroactively indexed with thumbnails. No persistent
  per-second thumbnail sidecar/index was implemented in this iteration.
- Original DS artwork converted deterministically into EXE/installer icon and
  branded installer banners. Program remains WebView2, not Chrome and not yet a
  fully native WPF/WinUI media client.

## Verification

66 frontend tests, including mounted event/detail/filter and diagnostic/log
interaction tests. 73 isolated native tests passed. Publish of Windows x64
self-contained application succeeded with pre-existing WindowsBase warning.
Inno Setup 6.7.3 compiled installer successfully.

Installer SHA256:
81F60AE02A6AD5B7386BFFAF821502686DEC8EBD29C33C389F937AE4E2AE58FB

Portable ZIP SHA256:
701479205546AE0E870D87E438A6BB2C65E8472C116A8F9D2390B2871DE0073A

## Acceptance still required

Real authenticated installed-app and phone visual inspection at actual viewport
sizes; every hardware control against an actual device; installer upgrade and
restart after confirmed recording save. Existing app was not forcibly closed or
replaced, and credentials/PIN/recordings were not cleared. Public automatic-update
manifest remains 1.3.3 pending updater acceptance; new installer is a separately
downloadable artifact. Builds/tests are not proof of installation or camera upload.

The earlier 193 deployment failed at GitHub Pages Deploy (run 38961253348,
annotation "Deployment failed, try again later"). It was not merely propagation.
Publication of this release must be checked against public version.json and files.
