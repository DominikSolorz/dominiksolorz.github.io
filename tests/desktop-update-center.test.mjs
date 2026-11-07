import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../desktop-client/Program.cs',import.meta.url),'utf8');

test('Windows update center is visible only after account and PIN access',()=>{
 assert.match(source,/updateBar\.Visible = panelUnlocked;/);
 assert.match(source,/updateInfo\.Text = \$"Zainstalowana \{DesktopVersion\}/);
 assert.match(source,/lastSuccessfulUpdateCheckUtc/);
 assert.match(source,/checkIntervalHours = 6/);
 assert.match(source,/Interval = 6 \* 60 \* 60 \* 1000/);
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
 assert.match(source,/if \(!panelUnlocked \|\| downloadingUpdate \|\| offeredUpdate is null\) return/);
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
