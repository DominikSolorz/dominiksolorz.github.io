# Native fake integration credentials

Verification 2026-10-15: combined suite passed all 87 assertions: 34 baseline,
15 credential/migration checks, and 38 existing forced worker-process crash
checks. Release agent build completed with zero warnings/errors. Evidence:
Windows Temp/HomeSecurityAgent-tests-6ccb5c3531a84e5d9395ec7ba64913a7.

Schema 3 adds `integrations`: integrationId, provider (`fake` only), immutable
credential revision, configured_unverified/disabled, and update timestamp.
There are no token, PIN, email or password columns. Existing schema 2 tables
are preserved by the transactional migration. Back up closed databases before
deployment; unknown future schemas are still refused.

`IntegrationCredentials` is native code, constructed by the agent. No new IPC
commands, frontend methods, secret-returning APIs or Apps Script adapters exist.
`ConfigureFake(Guid, byte[])` provisions/rotates a fake credential, `GetMetadata`
returns safe metadata, `ProbeFake` verifies local DPAPI readability only, and
`Disable` prevents subsequent resolution. Fake verification does not claim
network connectivity or successful authentication to any cloud service.

## Storage and recovery

DPAPI CurrentUser encryption uses the existing private-directory SecretStore in
`integration-secrets`. The encrypted payload binds integrationId and revision to
the credential. A substituted encrypted revision fails binding verification.
Reads reject oversized and reparse-point files. Plaintext working buffers are
cleared in finally; callers must clear their own provisioning buffer. No guarantee
is made that managed-memory copies or crash dumps contain no plaintext.

Provisioning writes and flushes a NEW encrypted revision first, then atomically
commits its pointer in SQLite. Before that commit the old revision stays active;
after it the new revision is active. Failure before commit can leave an encrypted
orphan; orphans are never auto-selected. Old revisions are intentionally retained,
not automatically deleted during rotation. Disk quota/garbage collection and
explicit credential erasure remain future work. Disable is logical revocation,
NOT deletion or revocation of a real provider's token. In-flight probes may finish
using the revision they already loaded. There is no distributed transaction
between NTFS and SQLite and no claimed power-loss guarantee.

Missing/corrupt credentials return sanitized codes, without raw exceptions or
secrets. They do not affect PIN or camera state. PIN is not accepted by this API,
used as key material, or needed to load the fake integration after restart.

## Security boundary

DPAPI and ACLs bind access to the Windows user, not to a unique executable.
Other code running as that same user (or a privileged administrator) is not
excluded. This iteration does not establish a service identity or sandbox.
The application boundary is native-only resolution with an unchanged read-only
IPC allowlist. No real credentials are imported and no network calls are made.

## Tests

CredentialTests covers missing integration, local fake verification, encrypted
storage, absence of the marker in SQLite/WAL and metadata, reopen, orphan revision,
rotation, revision substitution, corruption, missing file, disable, ID separation
and migration from a schema-2 fixture. Existing command tests reject secret reads.
These are fixture tests, not process-kill tests during credential provisioning;
the earlier process-crash suite exercises the job worker only.

Run `dotnet run --project agent-tests/HomeSecurity.Agent.Tests.csproj`.
For the combined job process-crash suite use the command in PROCESS-CRASH-TESTS.md.
