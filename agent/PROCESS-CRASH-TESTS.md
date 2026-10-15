# Forced process termination acceptance test

2026-10-15: all 72 assertions passed (34 existing plus 38 process-crash
assertions). All five checkpoints were reached in separate child processes,
forcibly killed and recovered. The three running-state cases respected the real
lease before expiry and succeeded on attempt 2; queued/completed cases finished
with exactly one attempt. SQLite integrity and foreign-key checks passed after
each kill. Evidence directories remain in Windows Temp as HomeSecurityCrash-*.

Build the agent, then run the existing test executable with:

```powershell
dotnet build agent/HomeSecurityAgent.csproj
dotnet run --project agent-tests/HomeSecurity.Agent.Tests.csproj -- --process-crash agent/bin/Debug/net10.0-windows/HomeSecurityAgent.dll
```

The parent launches a separate dotnet process executing the actual agent assembly.
Only the explicit `--crash-harness` entry point accepts fault checkpoints. It requires
an isolated `HomeSecurityCrash-*` directory and test-only marker. No camera, network,
Drive, WebView2 or production agent process is used. The harness holds the usual
instance lock and uses the actual database, queue and worker implementation.

At queued, claimed, partial temporary output, durable receipt, and completed
checkpoints, the child flushes a stdout notification and blocks. The parent kills
that exact child process tree, waits for exit, then verifies persisted state,
SQLite integrity and foreign keys. For running jobs a second process first proves
that an unexpired lease is not reclaimed. The test waits for the real 30-second
lease to expire before launching recovery. It never rewrites expiry timestamps.
Finally it checks terminal success, exact attempts and a single receipt with the
correct SHA256. Leftover partial files are evidence, not valid receipts.

The harness creates only test directories and retains them. It is not a test of
power failure, storage-controller flush behavior, malicious same-user processes,
or repeated randomized fault injection. It does not test camera/Drive recovery.
Existing lease-token fencing tests remain in the ordinary suite. No production
startup flag enables these checkpoints implicitly, and IPC cannot invoke them.

Next: introduce an integrationId-based native credential provider using DPAPI
CurrentUser, with a fake provider only. SQLite should contain metadata, never
tokens; panel responses should contain status only. Provisioning and removal need
explicit native operations and recovery rules for interruption between metadata
and encrypted-file updates. Do not reuse PIN as encryption material or migrate
Apps Script credentials automatically.
