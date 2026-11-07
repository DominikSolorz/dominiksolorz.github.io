import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Windows one-click update stages all files and retains existing binaries for rollback',async()=>{
 const program=await read('desktop-client/Program.cs');
 const updater=program.slice(program.indexOf('private static void ApplyPreparedUpdate('),program.indexOf('private static void CleanupOldUpdaterCopies('));
 const required=[
  'SHA256.HashData(input)',
  'pending.Sha256',
  'ZipFile.ExtractToDirectory(package, staging)',
  'File.Exists(Path.Combine(staging, "HomeSecurityDesktop.exe"))',
  'File.Exists(Path.Combine(staging, "Panel", "index.html"))',
  'Path.Combine(staging, "Agent", pending.Version, "HomeSecurityAgent.exe")',
  'var plan = Directory.EnumerateFiles(staging',
  'if (File.Exists(file.Destination))',
  'File.Copy(file.Destination, backup, true)',
  'startedReplacing = true',
  'File.Copy(file.Source, file.Destination, true)',
  'foreach (var original in originals.AsEnumerable().Reverse())',
  'File.Copy(original.Backup, original.Destination, true)',
  'update-rollback-failed',
  'if (rollbackOk && parentStopped)',
  'File.Delete(pendingPath)'
 ];
 for(const p of required)assert.ok(updater.includes(p),'Updater rollback protection missing: '+p);
 assert.ok(updater.indexOf('File.Copy(file.Destination, backup, true)')<updater.indexOf('startedReplacing = true'),'backups must happen before any file is replaced');
 assert.ok(updater.indexOf('SHA256.HashData(input)')<updater.indexOf('startedReplacing = true'),'package must be reverified before copying');
 assert.ok(updater.indexOf('File.Delete(pendingPath)')<updater.indexOf('UseShellExecute = true, WorkingDirectory = installDirectory }) is null'),'pending must be cleared before new app starts');
});

test('Windows cannot apply an arbitrary file or continue with a corrupt pending request',async()=>{
 const src=await read('desktop-client/Program.cs');
 const apply=src.slice(src.indexOf('private static void ApplyPreparedUpdate('),src.indexOf('private static void CleanupOldUpdaterCopies('));
 const begin=src.slice(src.indexOf('private static bool StartPreparedUpdateIfAny()'),src.indexOf('private static void ApplyPreparedUpdate('));
 assert.ok(apply.includes('package.StartsWith(updateRoot'));
 assert.ok(apply.includes('pendingPath, Path.GetFullPath(PendingUpdatePath)'));
 assert.ok(apply.includes('destination.StartsWith(root'));
 assert.ok(apply.includes('Path.IsPathRooted(relative)'));
 assert.ok(apply.includes('!parent.WaitForExit(60000)'),'running parent must prevent replacement');
 assert.ok(begin.includes('pending.Sha256?.Length != 64'));
 assert.ok(begin.includes('File.Delete(PendingUpdatePath)'),'obsolete pending requests must not block all future checks');
 assert.ok(src.includes('new PendingUpdate(packagePath, manifest.Version, manifest.Sha256)'));
 assert.ok(src.includes('private sealed record PendingUpdate(string PackagePath, string Version, string Sha256)'));
 assert.ok(src.includes('File.Move(temporaryPath, packagePath, true)'),'incomplete downloads may not become active packages');
});

test('background updates verify integrity and never stop recording',async()=>{
 const src=await read('desktop-client/Program.cs');
 const update=src.slice(src.indexOf('private async Task DownloadAndPrepareOfferedUpdateAsync()'),src.indexOf('private sealed record DesktopUpdateManifest'));
 assert.ok(src.includes('updateButton.Click += async (_, _) => await DownloadAndPrepareOfferedUpdateAsync()'));
 assert.ok(update.includes('if (!panelUnlocked || downloadingUpdate) return;'));
 assert.ok(update.includes('if (offeredUpdate is null) return;'));
 assert.ok(update.indexOf('SHA256.HashDataAsync(packageStream)')<update.indexOf('File.Move(pendingTemporaryPath, PendingUpdatePath, true)'));
 assert.ok(update.includes('await RestartIntoPreparedUpdateAsync();'),'verified download must immediately attempt a safe native restart');
 assert.ok(src.includes('type = "desktop.update.prepare"'),'recording must acknowledge safe shutdown');
 assert.ok(src.includes('updatePrepared.Task.WaitAsync(TimeSpan.FromMinutes(2))'),'native host must wait for recording save acknowledgement');
 assert.ok(!update.includes('Application.Restart'));
 const visibility=src.split('if (type.GetString() == "desktop.update.visibility")')[1]?.split('if (type.GetString() == "desktop.update.query")')[0];
 assert.ok(visibility,'visibility handler must remain');
 assert.ok(!visibility.includes('DownloadAndPrepareOfferedUpdateAsync()'),'unlock never authorizes an unattended download');
 const check=src.split('private async Task CheckForUpdateAsync()')[1]?.split('// Download only after explicit owner click')[0];
 assert.ok(check&&!check.includes('DownloadAndPrepareOfferedUpdateAsync()'),'background check never authorizes download');
 assert.ok(update.includes('if (File.Exists(PendingUpdatePath))'),'a staged package must be recognized');
 assert.ok(update.includes('await RestartIntoPreparedUpdateAsync();'),'repeated click should install without another download');
 assert.ok(update.includes('if (offeredUpdate is null) return;'),'no new or verified release means no install');
 assert.ok(!update.includes('MessageBox.Show'),'one click must not require a second confirmation');
});

test('a changed Windows app or agent is checked for an official release on push, not only four times a day',async()=>{
 const workflow=await read('.github/workflows/desktop-scheduled-release.yml');
 for(const token of ['branches: [main]','desktop-client/**','agent/**','agent-client/**','agent-contracts/**','kamera/*.js','kamera/core/**','kamera/communication/**','node scripts/desktop-release.mjs plan','git push origin HEAD:main','gh workflow run pages.yml'])
  assert.ok(workflow.includes(token),token);
 assert.ok(workflow.includes('cron:'),'retain a periodic fallback for missed events');
 assert.ok(workflow.includes("if: steps.plan.outputs.changed == 'true'"),'do not rebuild unchanged releases');
});
