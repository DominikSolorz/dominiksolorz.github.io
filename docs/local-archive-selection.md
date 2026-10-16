# Per-device local archive selection

Web build 187 / diskstore 6. No user-specific Windows path is hardcoded.

Recording settings support choosing an existing directory and creating a named
subdirectory under a location explicitly selected by the user. The picker starts
at Desktop, but the user can navigate to other accessible locations and drives.
The choice is remembered in this origin's browser/WebView profile, not shared
globally across users or devices. Filesystem permission may need renewal after
restart. Unsupported browsers report a limitation rather than pretending a local
folder was selected. The current implementation uses showDirectoryPicker, not a
native WinForms folder dialog; live installed-WebView acceptance remains required.

Changing the archive clears old file handles and refreshes its listing. Old files
are not moved or deleted. Cancelling or denied permission leaves the prior choice.
New folder names reject path separators, traversal, reserved Windows names and
invalid characters. Existing same-name subfolders can be selected without deletion.

Disk save reports success only after writable close and file-size readback.
This verifies size, not a content checksum. If disk access fails, the existing
recorder falls back to IndexedDB and reports the disk problem. It must not be
described as durable disk backup until an actual filesystem save is confirmed.
Pending browser recordings are not automatically migrated when choosing a folder.

Google Drive backup remains optional and must follow completed local recording
save; local files are not removed after upload. The native agent/DPAPI upload
integration is not connected by this folder-selection change.

Verification: seven diskstore tests cover existing folder, create subfolder,
folder switch, cancellation, denied permission, invalid paths and size mismatch.
Changes are local source changes, not a published installer or live acceptance.
