# Remote host-folder picker — web 190

The browser/phone opens a custom Foldery komputera dialog, not its own native
directory picker. Owner commands list subdirectories, create one directory and
select the active recording directory on the running Windows transmitter.
The existing WebRTC/Supabase owner-command transport is used; no public filesystem
HTTP server, new database grants or broad drive permission is introduced.

## Boundary

The host must first select/grant a root folder through its existing local picker.
That capability is persisted as browseRoot in this origin's Windows WebView
profile. Legacy selected folders may serve as the initial root. It is not a grant
to C:/D: or the whole Desktop; only the explicitly selected directory and children.
The scope belongs to the Windows/browser profile, not a new per-Supabase-user ACL.
Permission renewal must happen on the host. If no permission, offline or timeout,
the browser reports the problem and does not claim the change succeeded.

All remote paths are arrays of validated single names, bounded to 12 levels.
Resolution must remain beneath the granted root. Listings are directory-only,
paged at 100 entries; file contents are never returned. The existing File System
Access permission model is relied on; this is not a native agent filesystem sandbox
or a symlink/TOCTOU guarantee against a hostile local Windows user.

Requests are owner-HMAC signed including encrypted arguments, command/client IDs
and expiry. Requests and folder replies use domain-separated HKDF/AES-GCM with
client/command-associated data, so a viewer link alone cannot read navigation
paths. Existing heartbeat telemetry still includes the selected archive name.
Result deduplication is in the current dispatcher process, not a durable native
filesystem journal. Creation of an existing same-name folder is non-destructive.

Selecting a destination refreshes the recorder's real disk state without stopping
capture, clearing cached old-folder handles. Pending Drive queue entries block
remote switching because legacy queue records lack a stable per-folder capability.
Old recordings are not moved/deleted, and this dialog has no recursive deletion.

## Acceptance

49 automated frontend/folder/crypto/UI tests cover root traversal rejection,
creation/selection, pagination, revocation, ciphertext tampering, viewer keys,
argument signature binding and picker interaction/offline states. These use
isolated mocked directory handles and DOM; they are not a real Windows permission
or phone-to-running-EXE acceptance test. Live acceptance still requires: grant root
on host, open phone dialog, create/select subfolder, then verify actual segment
appears in that selected directory. Existing installed EXE/installer was not
replaced in this iteration. Google Drive native adapter remains separate.
