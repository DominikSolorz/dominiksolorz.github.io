# Native Google Drive API adapter

2026-10-15 verification: combined suite passed 102 assertions (49 existing,
15 Drive protocol/queue assertions, 38 existing synthetic process-crash checks).
Release build: zero warnings/errors. Isolated evidence directory:
Windows Temp/HomeSecurityAgent-tests-e7167d12a6d74fc5a5cc148eb6ba1061.
No live OAuth grant or upload was performed in this run.

This code uses real OAuth and Drive v3 endpoints. It is not an Apps Script wrapper
and makes no changes to camera capture or the installed desktop app. On 2026-10-16
the existing Desktop client completed native Picker consent for the requested
folder `15c9XPFi55XkQnCjfW_cvDHqhEXo_M5V2`. The agent verified write capability
through the real API, and credentials were saved using DPAPI.

Live upload evidence: job `7df6229f-3c90-4bbd-a18d-78fed538f412` succeeded on
attempt 1, remote ID `1s31zGpf8MYNuMz9dww6IKV5PceSsx-SV`, file
`home-security-drive-verification.txt`. The worker checked server-side MD5, size,
parent and job appProperty. The file was also visibly present in the Drive folder.
Only a harmless fixture was uploaded, not camera footage. This proves the basic
live path, NOT production readiness, sustained recording uploads or live fault recovery.

SECURITY BLOCKER before private footage: Drive's folder details showed anyone
on the internet with the link can edit its contents. This run did not change
sharing. Owner approval is required to restrict it. Do not send private recordings
until destination access has been secured and rechecked.

## Implementation

### Dedicated HOME SECURITY project acceptance, 2026-10-16

The Desktop client from project `intricate-abbey-511811-d3` was authorized through
native Picker for integration `2d54d15d-2dd4-476b-9f1a-6b9c77ac48a1`. The real folder
preflight passed and DPAPI credentials were saved. Harmless fixture upload job
`f8f5869f-3684-4ff7-ac54-7457da58df34` succeeded on attempt 1, remote ID
`1XGDefpE7JOVZ9NFtbVjMEOZIa_RM6yJz`. Independent connector metadata confirmed
248 bytes in the expected parent folder. The existing DS MAIL integration was
not overwritten and legacy recorder/Apps Script routing was not migrated.

Initial folder metadata showed public `anyone`/`writer` access. A subsequent browser
sharing retry succeeded: general access was changed to restricted, Google confirmed
the update, and independent API readback returned only the owner permission.
The current adapter does not enforce an automatic privacy gate; recheck destination
permissions before private-footage use. Earlier public-access warnings below describe
the historical test state, not the final permission readback on this date.


Schema 4 preserves integrations and adds a separate drive_uploads queue. Jobs store
integrationId, local file identity (path, size, MD5), folder, reserved remote ID,
lease, attempts and safe error code. OAuth refresh credentials are DPAPI encrypted
immutable revisions. Access tokens are short-lived in-memory values, invalidated
on 401 and credential revision changes; disabled integrations reject new requests.
Managed strings cannot be reliably zeroed. No token/secret commands are exposed by
the panel/Named Pipe. SQLite has NO access token, refresh token or session URL.

The queue reserves a Google-generated ID and commits it BEFORE creating a remote
file. Every retry uses that same ID. An ambiguous create/conflict causes readback,
not allocation of a different ID. Confirmation requires matching size, MD5,
destination parent, non-trashed state and job appProperty. MD5 is used for Drive's
binary-file checksum comparison, not as a security signature.

Resumable uploads send 1-MiB chunks and honor the server's Range. Session URLs are
encrypted under `drive-sessions`, bound to integration and remote ID. A retry
queries the existing session; an expired session starts over with the SAME file ID.
No conversion to Google Docs formats is supported. Local input must remain
unchanged; mutation blocks the job. Ordinary binary files, 1 byte to 1 GiB, are
supported by this iteration. Windows read sharing prevents writers during upload.
Same-user filesystem races/hard links remain outside the isolation guarantee.

Leases last five minutes and renew between network operations/chunks. Requests
have a 60-second timeout with bounded response bodies. Cancellation leaves a lease
for recovery. Network errors, 429, eligible 403 rate limits, 409 and 5xx retry with
backoff/jitter, capped at ten attempts. Missing permissions, invalid grants,
unavailable credentials and content conflicts block for operator intervention.
ResumeBlocked retains the same remote ID. Re-enqueueing a file creates a NEW job
and intentional new upload; it is not how to retry an existing job.

The worker currently runs through an explicit native console command. It is not
auto-started, wired to recordings, or installed as a Windows service. Existing
instance lock prevents simultaneous native agent/worker processes in the same data
directory. No live process is stopped automatically. Old encrypted sessions and
credential revisions are retained, not garbage-collected in this iteration.

## OAuth setup and consent

1. In your Google Cloud project enable Google Drive API.
2. Configure Google Auth Platform consent/audience and a Desktop app OAuth client.
   If the app is in testing, add the consenting account as a test user. Google
   testing-mode refresh-token lifetime and production verification requirements
   must be checked before unattended production deployment.
3. Download the Desktop client JSON to a private local path. Do not commit it,
   email it here, or pass refresh tokens as command-line arguments.
4. Default authorization requests drive.file, not all files. An existing folder
   URL alone does not grant this application access. With drive.file, the folder
   must be app-authorized. The native Google-hosted Picker is available through
   --drive-pick-folder (see below). Folder preflight blocks rather than broadening permission.
5. `--drive-authorize-full` is an explicit alternative for an existing folder. It
   grants ALL Drive access, not just that folder; it requires typing
   ALLOW_ALL_FILES locally and Google's consent. Do not use it without accepting
   this broader scope. It is never selected automatically. Production apps using
   broad scope may require Google's additional verification/security assessment.

Native authorization uses the system browser, loopback 127.0.0.1 on an ephemeral
port, state validation, PKCE S256 and a five-minute timeout. Denied consent does
not provision a credential. PIN and Apps Script tokens are not consulted.

## Native commands

### Native desktop folder Picker

Google's desktop/mobile Picker flow can be invoked directly in OAuth without an
additional API key/web client. Enable Google Picker API in the same project first,
reviewing its terms. The existing Desktop OAuth client and drive.file are reused.

```powershell
dotnet run --project agent/HomeSecurityAgent.csproj -- --drive-pick-folder <integration-guid> <absolute-client-json-path> 15c9XPFi55XkQnCjfW_cvDHqhEXo_M5V2
```

The system browser opens Google's consent and Picker. Only folders are shown,
multi-select is disabled and file_ids filters the expected folder. State and
PKCE remain enabled. A missing/different picked_file_ids callback is rejected
before replacing credentials. Granted scopes are not accumulated. After exchange
the agent verifies the selected folder via Drive API and stores non-secret
folder_verified metadata. No full Drive scope, extra client, or API key is created.
Cancelling leaves existing credentials unchanged. A failed post-exchange folder
preflight does not mark the destination ready.

Five new unit checks cover narrow parameters and accepted/rejected picked IDs.
The browser flow still requires live acceptance; unit checks are not proof of
folder access. Reference (desktop flow, updated 2026-10-12):
https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker

### Other commands

From the repository, after building the agent. Choose and keep one integration GUID:

```powershell
dotnet run --project agent/HomeSecurityAgent.csproj -- --drive-authorize <integration-guid> <absolute-client-json-path>
dotnet run --project agent/HomeSecurityAgent.csproj -- --drive-enqueue <integration-guid> <absolute-file-path> 15c9XPFi55XkQnCjfW_cvDHqhEXo_M5V2
dotnet run --project agent/HomeSecurityAgent.csproj -- --drive-worker
```

The enqueue command returns a job ID. Stop the console worker with Ctrl+C before
using the following commands (they share the instance lock):

```powershell
dotnet run --project agent/HomeSecurityAgent.csproj -- --drive-status <job-guid>
dotnet run --project agent/HomeSecurityAgent.csproj -- --drive-resume <blocked-job-guid>
```

Status includes remote ID, code, attempts and destination folder, never a session
URI or token. For live acceptance: authorize, enqueue one explicitly selected small
file, wait for succeeded, then inspect the actual remote file/folder and checksum.
Revoke consent and verify blocked; reauthorize and explicitly resume. Do not run
live acceptance on private recordings before these checks pass.

`--drive-check-folder <integration-guid> <folder-id>` performs read-only destination
preflight. `--drive-worker-once` executes one eligible queued job and exits; inspect
the job status separately, because completing an iteration does not imply success.

## Verification boundaries

DriveTests sends the real adapter through an injected in-memory HTTP handler to
test lost intermediate/final responses, persisted DPAPI sessions, server-offset
resume after adapter reconstruction, no duplicate create, checksum confirmation,
401 refresh, revoked grants, rate limits, changed inputs and disabled integrations.
No fake provider is used for the production Drive execution path. These automated
protocol tests are NOT evidence of a file uploaded to Google's servers.
Existing process-kill tests cover the synthetic worker, NOT the new Drive worker.
OAuth browser consent, live upload, Drive-worker process-kill and power-loss tests
remain acceptance tasks. Do not describe this revision as production-verified yet.

Primary specifications:
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
- https://developers.google.com/workspace/drive/api/guides/create-file
- https://developers.google.com/identity/protocols/oauth2/native-app
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/guides/handle-errors
