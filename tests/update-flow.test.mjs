import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../kamera/app.js',import.meta.url),'utf8');
const native=await readFile(new URL('../desktop-client/Program.cs',import.meta.url),'utf8');
const mobile=await readFile(new URL('../kamera/mobile.js',import.meta.url),'utf8');
const prepare=app.slice(app.indexOf('  async function prepareUpdate()'),app.indexOf('  const gb ='));
function setup(fail=false){const calls=[];const ctx=vm.createContext({Error,calls});vm.runInContext('let localSaveFailures=0, updateSource=null, source={camera:true}; async function stop(){calls.push("stop-recording");source=null;'+(fail?'localSaveFailures++;':'')+'} async function flush(done){await done;calls.push("saved");} async function resume(){calls.push("resume");}\n'+prepare+'\nglobalThis.prepare=prepareUpdate;globalThis.abort=abortUpdate;',ctx);return{ctx,calls};}
test('update waits for recording save before readiness',async()=>{const s=setup();await s.ctx.prepare();assert.deepEqual(s.calls,['stop-recording','saved']);});
test('failed final save blocks update and resumes recorder',async()=>{const s=setup(true);await assert.rejects(s.ctx.prepare());assert.deepEqual(s.calls,['stop-recording','saved','resume']);});
test('aborted installation resumes recording',async()=>{const s=setup();await s.ctx.prepare();await s.ctx.abort();assert.equal(s.calls.at(-1),'resume');});
test('native update verifies download and stages atomically without touching recording',()=>{
 const code=native.slice(native.indexOf('private async Task DownloadAndPrepareOfferedUpdateAsync'));
 assert.ok(code.indexOf('SHA256.HashDataAsync')<code.indexOf('File.Move(pendingTemporaryPath, PendingUpdatePath, true)'));
 assert.ok(code.includes('HttpCompletionOption.ResponseHeadersRead'));
 assert.ok(code.includes('source.ReadAsync(buffer, downloadDeadline.Token)'));
 assert.ok(code.includes('await RestartIntoPreparedUpdateAsync();'),'one click must continue to install and relaunch');
 assert.ok(!code.includes('Application.Restart'),'host must use existing independently verified installer');
});
test('phone cloud route contains host storage status and remote chooser, separate from recordings',()=>{assert.match(mobile,/cloud: \["mobileCloudHeading", "mobileRecordingStorage"\]/);assert.match(mobile,/recordings: \["dvrCard", "dvrListCard"\]/);assert.ok(mobile.includes('id="mobileRecordingState"'));assert.ok(mobile.includes('id="mobileChooseComputerFolder"'));assert.ok(!mobile.includes('showDirectoryPicker'));});

test('one click starts the native update without a second confirmation dialog',()=>{
 const begin=native.indexOf('private async Task DownloadAndPrepareOfferedUpdateAsync');
 const end=native.indexOf('private sealed record DesktopUpdateManifest',begin);
 const flow=native.slice(begin,end);
 assert.ok(!flow.includes('MessageBox.Show'), 'the update button must not require a second click');
 assert.ok(flow.includes('if (!panelUnlocked || downloadingUpdate) return;'));
 assert.ok(flow.includes('if (offeredUpdate is null) return;'));
 assert.ok(flow.includes('File.Move(pendingTemporaryPath, PendingUpdatePath, true)'));
 assert.ok(!flow.includes('Application.Restart'));
 assert.ok(flow.includes('await RestartIntoPreparedUpdateAsync();'),'install automatically after verified download');
 assert.ok(native.includes('Interval = 10 * 60 * 1000'));
});
test('native update notification and start require the unlocked account panel',()=>{
 assert.ok(native.includes('updateBar.Visible = panelUnlocked && HasUpdateOffer;'),'update center must be available only after account and PIN unlock');
 assert.ok(native.includes('updateButton.Visible = offeredUpdate is not null || File.Exists(PendingUpdatePath);'),'offer must appear only for a newer version or already verified pending package');
 assert.ok(native.includes('webView.CoreWebView2.NavigationStarting += (_, _) => { panelUnlocked = false; updateBar.Visible = false; accountOAuthCancellation?.Cancel(); }'),'navigation and logout must re-lock native controls');
 const query=native.slice(native.indexOf('if (type.GetString() == "desktop.update.query")'),native.indexOf('if (type.GetString() == "desktop.update.request")'));
 assert.ok(!query.includes('updateBar.Visible = false'));
});
test('update visibility follows login, PIN unlock and logout',async()=>{
 const desktop=await readFile(new URL('../kamera/desktop.js',import.meta.url),'utf8');
 const source=desktop.slice(desktop.indexOf('  let updatePanelVisible = false;'),desktop.indexOf('  const updateAccessObserver'));
 const messages=[];const panel={hidden:true};const flags=new Set(['accessPending']);
 const ctx=vm.createContext({Boolean,$:id=>id==='app'?panel:null,document:{body:{classList:{contains:name=>flags.has(name)}}},window:{chrome:{webview:{postMessage:m=>messages.push(m)}}}});
 vm.runInContext(source+'\nglobalThis.sync=syncUpdateAccess;',ctx);
 ctx.sync(); // Public home, no account panel.
 panel.hidden=false;ctx.sync(); // Account selected, PIN still required.
 flags.delete('accessPending');ctx.sync(); // Successful unlock.
 panel.hidden=true;ctx.sync(); // Logout.
 assert.deepEqual(messages.map(m=>m.visible),[false,false,true,false]);
});
