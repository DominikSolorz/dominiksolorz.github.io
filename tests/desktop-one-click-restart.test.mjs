import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('one click downloads the signed release, then initiates safe restart',async()=>{
 const source=await read('desktop-client/Program.cs');
 const start=source.indexOf('private async Task DownloadAndPrepareOfferedUpdateAsync()');
 const end=source.indexOf('private sealed record DesktopUpdateManifest',start);
 const download=source.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.match(download,/if \(!panelUnlocked \|\| downloadingUpdate\) return/);
 assert.match(download,/if \(offeredUpdate is null\) return/);
 assert.match(download,/SHA256\.HashDataAsync\(packageStream\)/);
 assert.ok(download.indexOf('SHA256.HashDataAsync(packageStream)')<download.indexOf('File.Move(pendingTemporaryPath, PendingUpdatePath, true)'));
 assert.ok(download.indexOf('File.Move(pendingTemporaryPath, PendingUpdatePath, true)')<download.lastIndexOf('await RestartIntoPreparedUpdateAsync();'),'first install can use staged cache, newly downloaded update must verify before restart');
 assert.match(download,/if \(File\.Exists\(PendingUpdatePath\)\)/,'already downloaded packages should retry install');
 assert.match(download,/updateButton.Enabled = panelUnlocked/,'a blocked restart can be retried without redownloading');
 assert.doesNotMatch(download,/Application\.Restart|MessageBox\.Show/,'no second dialog or unverified Application.Restart');
});
test('camera must acknowledge saved recording before native helper or close',async()=>{
 const source=await read('desktop-client/Program.cs');
 const start=source.indexOf('private async Task<bool> RestartIntoPreparedUpdateAsync()');
 const end=source.indexOf('private async Task DownloadAndPrepareOfferedUpdateAsync()',start);
 const method=source.slice(start,end);
 assert.ok(start>0&&end>start);
 for(const token of [
   'if (!panelUnlocked || !File.Exists(PendingUpdatePath)',
   'AgentWebViewBridge.Trusted(webView.CoreWebView2.Source)',
   'new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously)',
   'type = "desktop.update.prepare"',
   'updatePrepared.Task.WaitAsync(TimeSpan.FromMinutes(2))',
   'if (!recorderReady)',
   'if (!panelUnlocked || IsDisposed || !File.Exists(PendingUpdatePath))',
   'if (!StartPreparedUpdateIfAny())',
   'Close();',
   'type = "desktop.update.abort"',
   'PublishUpdateState("staged"',
 ]) assert.ok(method.includes(token),'Missing safe update stage: '+token);
 assert.ok(method.indexOf('if (!recorderReady)')<method.indexOf('if (!StartPreparedUpdateIfAny())'),'helper must never start before final save');
 assert.ok(method.indexOf('if (!StartPreparedUpdateIfAny())')<method.indexOf('Close();'),'helper must start before closing window');
 assert.ok(method.includes('return false;'),'failed preparation should leave the program running');
});
test('real JS recorder finishes and acknowledges or explicitly refuses update',async()=>{
 const app=await read('kamera/app.js');
 const prepare=app.slice(app.indexOf('  async function prepareUpdate()'),app.indexOf('  const gb ='));
 const handler=app.slice(app.indexOf('window.chrome?.webview?.addEventListener("message"'),app.indexOf('// ---------- Kanał sygnalizacji',app.indexOf('window.chrome?.webview?.addEventListener("message"')));
 assert.match(prepare,/await flush\(stop\(\)\)/);
 assert.match(prepare,/if \(localSaveFailures !== failures\)/);
 assert.match(prepare,/await abortUpdate\(\)/);
 assert.match(handler,/if \(!CAN_MANAGE_CAMERA/);
 assert.match(handler,/if \(message.type === "desktop.update.abort"\)/);
 assert.match(handler,/await archive.prepareUpdate\(\); ok = true/);
 assert.match(handler,/type:"desktop.update.prepared", id:message.id, ok/);
});
test('app applies SHA-256 verified package after process exit, with rollback and automatic relaunch',async()=>{
 const source=await read('desktop-client/Program.cs');
 const helper=source.slice(source.indexOf('private static void ApplyPreparedUpdate('),source.indexOf('private static void CleanupOldUpdaterCopies('));
 for(const token of [
  'parent.WaitForExit(60000)',
  'SHA256.HashData(input)',
  'ZipFile.ExtractToDirectory(package, staging)',
  'File.Copy(file.Destination, backup, true)',
  'startedReplacing = true',
  'File.Copy(file.Source, file.Destination, true)',
  'File.Delete(pendingPath)',
  'Path.Combine(installDirectory, "HomeSecurityDesktop.exe")',
  'UseShellExecute = true, WorkingDirectory = installDirectory',
  'foreach (var original in originals.AsEnumerable().Reverse())',
  'update-rollback-failed'
 ])assert.ok(helper.includes(token),token);
 assert.ok(helper.indexOf('File.Copy(file.Destination, backup, true)')<helper.indexOf('startedReplacing = true'));
 assert.ok(helper.indexOf('File.Delete(pendingPath)')<helper.indexOf('UseShellExecute = true, WorkingDirectory = installDirectory'));
});
