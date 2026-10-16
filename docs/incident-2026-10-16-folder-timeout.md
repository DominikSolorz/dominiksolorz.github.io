# Live incident: folder chooser timeout and local-save failure

Read-only account-scoped camera_status telemetry at 2026-10-16 19:25 UTC
confirmed running transmitter web version 177, live/recording true, selected
folder unset, saved count 0 and InvalidBlob from IndexedDB writing. The phone
had the new folder UI. Version 177 does not implement folder commands; this
explains the timeout despite an active camera. The version mismatch is confirmed,
not merely inferred from the screenshot.

Windows C: free bytes were 426659840 (about 407 MiB); no other physical filesystem
drive was returned. IndexedDB quota's reported 10 GB is not actual physical free
space. Disk exhaustion is a plausible contributor to InvalidBlob, not a proven
sole cause. Existing browser archive reports 57 recordings / 44.7 GB.

No recording, browser database or private file was removed. Cleanup of four
known generated build folders (about 361 MiB combined) was rejected before process
creation; no deletion occurred. Installers and update archives remain intact.
No forced program restart/page reload was performed with pending save failure.

Web 191 checks fresh transmitter version before issuing folder operations,
reports old-host version explicitly, marks local-save errors and disables useless
folder navigation before listing succeeds. 53 automated tests passed. This
improves diagnosis but does not free disk, grant a folder or upgrade the running
transmitter. Recovery requires space reclamation approved by owner, safe recording
finalization, loading current host panel and explicit local folder permission,
followed by a real recording file readback. Real camera-to-Drive upload remains
unverified and the legacy Drive-auto setting is disabled in the running host.
