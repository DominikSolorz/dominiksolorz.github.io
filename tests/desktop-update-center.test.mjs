import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../desktop-client/Program.cs',import.meta.url),'utf8');

test('Windows update center is visible only after account and PIN access',()=>{
 assert.match(source,/updateBar\.Visible = panelUnlocked;/);
 assert.match(source,/updateInfo\.Text = \$"Zainstalowana \{DesktopVersion\}/);
 assert.match(source,/lastSuccessfulUpdateCheckUtc/);
 assert.match(source,/checkIntervalMinutes = 10/);
 assert.match(source,/Interval = 10 \* 60 \* 1000/);
 assert.match(source,/checkUpdateButton\.Click \+= async/);
 assert.match(source,/if \(panelUnlocked\) await CheckForUpdateAsync\(\)/);
});

test('unlocked panel does not trigger unattended download',()=>{
 const visibility=source.split('if (type.GetString() == "desktop.update.visibility")')[1]?.split('if (type.GetString() == "desktop.update.query")')[0];
 assert.ok(visibility);
 assert.doesNotMatch(visibility,/DownloadAndPrepareOfferedUpdateAsync/);
 const check=source.split('private async Task CheckForUpdateAsync()')[1]?.split('// Download only after explicit owner click')[0];
 assert.ok(check);
 assert.doesNotMatch(check,/DownloadAndPrepareOfferedUpdateAsync/);
 assert.match(source,/updateButton\.Click \+= async \(_, _\) => await DownloadAndPrepareOfferedUpdateAsync\(\)/);
 assert.match(source,/if \(!panelUnlocked \|\| downloadingUpdate\) return/);
 assert.match(source,/if \(offeredUpdate is null\) return/);
});

test('manual checks distinguish installed build, latest offer and transient errors',()=>{
 assert.match(source,/desktop\.update\.check/);
 assert.match(source,/lastCheckedUtc = lastSuccessfulUpdateCheckUtc/);
 assert.match(source,/PublishUpdateState\("checking"/);
 assert.match(source,/PublishUpdateState\("current"/);
 assert.match(source,/PublishUpdateState\("available"/);
 assert.match(source,/PublishUpdateState\("error"/);
 assert.match(source,/Version\.TryParse\(manifest\.Version, out var available\)/);
 assert.match(source,/packageUri\.Host != PublicHost/);
 assert.match(source,/manifest\.Sha256\?\.Length != 64/);
});

test('staged update can be cancelled without accessing recordings',()=>{
 const cancel=source.split('private void CancelPreparedUpdate()')[1]?.split('private async Task DownloadAndPrepareOfferedUpdateAsync()')[0];
 assert.ok(cancel);
 assert.match(cancel,/if \(!panelUnlocked \|\| downloadingUpdate\) return/);
 assert.match(cancel,/File\.Delete\(PendingUpdatePath\)/);
 assert.match(cancel,/offeredUpdate = null/);
 assert.deepEqual(cancel.match(/File\.Delete\([^)]+\)/g),['File.Delete(PendingUpdatePath)']);
 assert.match(source,/desktop\.update\.cancel/);
 assert.match(source,/PublishUpdateState\("staged"/);
});

test('the existing checksum and next-startup update/rollback path is retained',()=>{
 assert.match(source,/SHA256\.HashDataAsync\(packageStream\)/);
 assert.match(source,/File\.Move\(pendingTemporaryPath, PendingUpdatePath, true\)/);
 assert.match(source,/StartPreparedUpdateIfAny\(\)/);
 assert.match(source,/update-rollback-failed/);
 assert.doesNotMatch(source,/Application\.Restart/);
});

test('failed manifest discovery retries the check instead of a no-op download',()=>{
 const handler=source.split('if (type.GetString() == "desktop.update.request")')[1]?.split('if (type.GetString() == "desktop.update.prepared")')[0];
 assert.ok(handler,'native update request handler must exist');
 assert.match(handler,/if \(!panelUnlocked\) return/,'locked panels cannot trigger update checks');
 assert.match(handler,/if \(offeredUpdate is null\) await CheckForUpdateAsync\(\)/,'retry must recheck the manifest without an offered version');
 assert.match(handler,/else await DownloadAndPrepareOfferedUpdateAsync\(\)/,'offered versions still download after explicit click');
});

test('Windows checks at startup, every 10 minutes, and after returning to the window',()=>{
 assert.match(source,/\b_ = CheckForUpdateAsync\(\);/,'initial version check occurs without waiting for a timer');
 assert.match(source,/updateCheckTimer\.Tick \+= async \(_, _\) => await CheckForUpdateAsync\(\)/);
 assert.match(source,/Interval = 10 \* 60 \* 1000/);
 assert.match(source,/Activated \+= async \(_, _\) =>/);
 assert.match(source,/DateTimeOffset\.UtcNow - lastAttemptedUpdateCheckUtc\.Value < TimeSpan\.FromMinutes\(2\)/);
 assert.match(source,/checkIntervalMinutes = 10/);
 assert.doesNotMatch(source,/co 6 godzin/,'new releases should not be hidden behind six-hour messaging');
});

test('new Windows version triggers a clear native prompt once per version only after unlock',()=>{
 const prompt=source.split('private void PromptForAvailableUpdate()')[1]?.split('private void CancelPreparedUpdate()')[0];
 assert.ok(prompt);
 assert.match(prompt,/if \(!panelUnlocked \|\| offeredUpdate is null \|\| downloadingUpdate/);
 assert.match(prompt,/File\.Exists\(PendingUpdatePath\)/);
 assert.match(prompt,/lastPromptedUpdateVersion == version/);
 assert.match(prompt,/lastPromptedUpdateVersion = version/);
 assert.match(prompt,/MessageBox\.Show\(this,/);
 assert.match(prompt,/MessageBoxButtons\.YesNo/);
 assert.match(prompt,/MessageBoxDefaultButton\.Button2/,'defer is the default to protect recordings');
 assert.match(prompt,/answer == DialogResult\.Yes\)[\s\S]*await DownloadAndPrepareOfferedUpdateAsync\(\)/);
 const visibility=source.split('if (type.GetString() == "desktop.update.visibility")')[1]?.split('if (type.GetString() == "desktop.update.query")')[0];
 assert.match(visibility,/if \(panelUnlocked\) PromptForAvailableUpdate\(\)/);
 assert.match(source,/private void ShowUpdateOffer\(string version\)[\s\S]*PromptForAvailableUpdate\(\)/);
 assert.doesNotMatch(prompt,/Application\.Restart/,'a notice never forces a restart');
});

test('network checks fail fast and slow home downloads have a bounded retry path',()=>{
 const check=source.split('private async Task CheckForUpdateAsync()')[1]?.split('private void ShowUpdateOffer')[0];
 const download=source.split('private async Task DownloadAndPrepareOfferedUpdateAsync()')[1]||'';
 assert.match(check,/CancellationTokenSource\(TimeSpan\.FromSeconds\(20\)\)/);
 assert.match(check,/manifestDeadline\.Token/);
 assert.match(download,/CancellationTokenSource\(TimeSpan\.FromMinutes\(15\)\)/);
 assert.match(download,/ReadAsync\(buffer, downloadDeadline\.Token\)/);
 assert.match(download,/SHA256\.HashDataAsync\(packageStream\)/);
 assert.match(download,/File\.Move\(pendingTemporaryPath, PendingUpdatePath, true\)/);
 assert.match(source,/if \(offeredUpdate is null\) await CheckForUpdateAsync\(\)/);
});
