# Recording upload repair — local implementation, 2026-10-16

This is not end-to-end acceptance. No real camera recording has yet been verified
on Drive in this repair run. Do not interpret unit tests as a successful upload.

## Fixed

- Upload preflight now runs inside the pump's try/finally. A failed preflight
  releases the busy flag and schedules another attempt instead of wedging uploads.
- A temporarily inaccessible local file is retained in the queue instead of being
  silently removed. The diagnostic requests restoring archive-folder access.
- Recording settings expose an explicit opt-in for automatic new-segment backups.
  No new cloud consent is fabricated and historical recordings are not bulk queued.
- A manual action rotates the recording segment, waits for its local save and
  attempts upload without stopping the camera. The next segment starts before the
  previous one stops. Only Drive verification counts as confirmed delivery.

The settings explicitly identify the existing Apps Script transport. This repair
does not silently substitute the native DPAPI integration or claim that its tokens
are used by app.js. That connection still needs a bounded native spool/IPC adapter.

## Verification

`node --test tests/drive-pump.test.mjs tests/frontend-core.test.mjs tests/release-consistency.test.mjs`

20 checks passed, including preflight failure, unavailable local data, failed Drive
verification and successful acknowledgement. Source syntax and diff checks passed.
Web release 186; service worker 88. Existing 1.3.4 packaged artifacts remain the
previous build and were not overwritten.

## Current operational blocker

Windows UI automation can read the running transmitter but cannot obtain capture
geometry; indexed clicks fail and a keyboard probe did not move focus. No forced
process termination or page reload was used, to preserve in-progress recording.
Changes remain local pending deployment and live acceptance. The public update
manifest and installed application were not replaced.
