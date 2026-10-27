# Installer and website releases

The Windows application is a locally installed EXE with a local `Panel` bundle.
WebView2 renders that bundle; it does not launch or depend on a running Chrome.
Account services, remote video connections, Drive and release checks remain online.
This distinction does not prove that recording continues after closing the panel.

`desktop-scheduled-release.yml` checks application sources every six hours, four
times daily. GitHub may delay a scheduled job. `workflow_dispatch` allows an
additional check. An unchanged source fingerprint skips compilation and publishing.

If tracked runtime files changed, the workflow increments the desktop patch,
updates the native project and public download references, builds the EXE, agent,
ZIP and Inno Setup installer, runs agent/crash and frontend/release tests, then
commits the complete release atomically. A concurrent change on main aborts the
release instead of overwriting newer work. Failed builds keep the current release.
The commit explicitly dispatches Pages because token-created commits do not trigger
ordinary push workflows. No credentials or personal computer state are read.

Pages fetches only the current installer/ZIP and rollback ZIP from its immutable
source commit. The release manifest and public download links ship together.
The public download button also refreshes from the manifest at load, focus,
periodically and immediately before download. Metadata bypasses the offline cache.
The web page updates on a normal main push; it does not wait six hours for Windows.

The installed application only checks availability in the background. It never
installs on the schedule. Its update button is available after login and PIN unlock;
the user clicks once, then download, checksum validation, recording flush and
restart proceed. Failure to acknowledge a safe flush blocks the update.

Initial baseline: published Desktop 1.4.11 / web build 221. The first scheduled
release includes the manifest-driven download control and metadata cache fix.
