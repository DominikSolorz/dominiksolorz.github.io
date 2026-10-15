# Durable queue, schema 2

This iteration is native-only. It does not acquire media, execute input files,
upload to Drive, or expose job mutations through the WebView2 bridge.

## Persistence

Migrations run in one immediate transaction. New databases pass through schemas
1 and 2; existing schema 1 databases retain their original tables. Unknown future
or corrupt schema versions are refused. WAL and synchronous FULL are enabled.
Back up a closed database before deploying a migration; there is no automatic downgrade.

Jobs transition queued -> running -> succeeded, or running -> retry_wait -> running.
An exhausted retry budget ends in failed. Each claim gets a unique 30-second lease;
expired leases are recovered on the next claim. Completion is conditional on the
current token and unexpired lease, so an obsolete worker cannot commit a result.
Retry delay doubles by attempt, capped at 300 seconds. History and state updates
are committed together. This is not a general exactly-once side-effect guarantee.

Hourly retention removes results and history older than 30 days, but preserves
command/job IDs and fingerprints. Old command results return RESULT_EXPIRED and
cannot cause re-execution. Admission limits are 100,000 commands and 10,000 jobs;
capacity exhaustion requires operator maintenance rather than silent ID deletion.
Retention does not delete user files or synthetic output artifacts.

## Isolated worker

Run `dotnet run --project agent/HomeSecurityAgent.csproj -- --synthetic-test <absolute-test-directory>`.
Do not use the production data directory. This mode has its own test pipe namespace.
Native code can enqueue with `SyntheticJobs.Enqueue(id, flatFilename, maxAttempts)`;
there is deliberately no browser/API enqueue command yet.

Only `<test-directory>/synthetic/inbox` is read and `synthetic/output` is written.
Input is limited to 16 MiB. Flat ASCII names, reserved-name rejection, reparse-point
checks, private directory ACLs and exclusive output creation constrain access.
These checks are not an isolation boundary against a malicious process running
as the same Windows user (including filesystem race or hard-link manipulation).
Use only fixtures created for the test, never secrets or production recordings.

The worker hashes a file and atomically renames a flushed JSON receipt into place.
The receipt is keyed by job ID; a retry after output creation reuses that receipt,
even if the original input has since changed. A new input revision requires a new
job ID. Interrupted temporary files are retained for inspection, not auto-deleted.
Cancellation leaves the lease for recovery. Long jobs exceeding the lease cannot
commit; this small synthetic worker has no heartbeat/lease extension yet.

## Verification

`dotnet run --project agent-tests/HomeSecurity.Agent.Tests.csproj`

34 assertions passed on 2026-10-15, including existing real Named Pipe/DPAPI tests,
enqueue deduplication/conflicts, backoff, retry success, exhausted attempts,
lease fencing, cancellation, receipt recovery, retention and future-schema refusal.
Crash testing here injects an exception after the durable receipt and reopens the
database. It is NOT an OS process-kill/power-loss test or a new live WebView2 test.
Separate-process termination and migration-from-a-real-schema-1 fixture remain
additional acceptance checks before production deployment.
