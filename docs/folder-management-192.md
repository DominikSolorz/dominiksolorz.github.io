# Folder management 192

The Windows host asks the owner to choose an archive directory using the existing
system directory picker. Before accepting a location, it writes, closes, checks
the size of and removes a unique temporary test file. Failed checks preserve the
previous selection. Existing recordings are not moved or deleted.

Authenticated owner browsers use the existing signed and encrypted folder channel
to browse, create and select subdirectories below that approved root. They do not
call a picker on the phone. Host version 192 is required. Empty child directories
can be removed after explicit confirmation. Root, active archive and its ancestors,
nonempty directories and traversal paths are rejected. Deletion is never recursive.

This is an extension to the existing WebView-hosted recorder, not a completed
migration of recording or filesystem access into the independent native agent.
Firefox can act as the remote client; the Windows host still needs its supported
directory picker and valid permission. Account pairing and owner PIN protections
remain unchanged. No broader filesystem or cloud permissions are granted.

Release acceptance still requires the running host to load 192, local owner folder
consent, recording readback and remote operations against that actual host.
Automated tests do not establish those live outcomes.
