# Desktop 1.3.5 / web 189

Prepared 2026-10-16. Native updater now checks every 15 minutes while the app is
open, exposes availability/progress through a trusted WebView message bridge and
shows the notification at the bottom of the desktop navigation. Native top bar is
a fallback only until the page acknowledges sidebar support. No update icon is
shown before an actual newer manifest is found. Download percent uses received
bytes and Content-Length; unknown length displays an indeterminate bar/MB, not
fabricated percent. SHA256 verification precedes installation preparation.

Before writing a pending update and restarting, the host requests a correlated
recording-save acknowledgement. Timeout/failure blocks restart and sends abort;
the recorder resumes on abort. Camera capture is not stopped during this save,
but restarting WebView2 still causes a recording interruption. No claim of an
independent media agent is made. Both installed and portable EXEs share this code.

Mobile Nagrania now includes a storage card fed by transmitter heartbeat with a
45-second freshness limit. Missing/stale telemetry is unknown, not success. Folder
change/create/disconnect buttons are visibly disabled and explained: remote native
folder selection/write bridging is not implemented. No phone-local picker is used
to pretend it changes a Windows folder. Google Drive camera integration remains
separate unfinished work; this release does not verify an actual camera upload.

Verification: 36 frontend/folder/queue/update tests pass. Windows compile succeeds
with existing WindowsBase/WebView2 dependency warning. Native UI update acceptance
(real older app -> 1.3.5, interrupted download, save failure, installed and portable
targets) is still required before promoting the public desktop-update manifest.
The manifest must remain at its previous version until that acceptance. A local
installer/package is not proof of successful installation or update.
