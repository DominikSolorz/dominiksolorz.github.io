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
test('native update requires hash and save acknowledgement before pending restart',()=>{const begin=native.indexOf('private async Task DownloadAndPrepareOfferedUpdateAsync');const code=native.slice(begin);assert.ok(code.indexOf('SHA256.HashDataAsync')<code.indexOf('updatePrepared.Task.WaitAsync'));assert.ok(code.indexOf('if (!prepared)')<code.indexOf('File.WriteAllText(PendingUpdatePath'));assert.ok(code.includes('HttpCompletionOption.ResponseHeadersRead'));assert.ok(code.includes('source.ReadAsync(buffer, downloadDeadline.Token)'));});
test('phone recordings route contains host storage status and remote chooser',()=>{assert.match(mobile,/recordings: \["dvrCard", "dvrListCard", "mobileRecordingStorage"\]/);assert.ok(mobile.includes('id="mobileRecordingState"'));assert.ok(mobile.includes('id="mobileChooseComputerFolder"'));assert.ok(!mobile.includes('showDirectoryPicker'));});

test('one click starts the native update without a second confirmation dialog',()=>{
 const begin=native.indexOf('private async Task DownloadAndPrepareOfferedUpdateAsync');
 const end=native.indexOf('private void RestartIntoPreparedUpdate',begin);
 const flow=native.slice(begin,end);
 assert.ok(!flow.includes('MessageBox.Show'), 'the update button must not require a second click');
 assert.ok(flow.includes('if (downloadingUpdate || offeredUpdate is null) return;'));
 assert.ok(flow.includes('RestartIntoPreparedUpdate(manifest.Version)'));
 assert.ok(native.includes('Interval = 60 * 1000'));
});
test('a hidden sidebar cannot suppress the native update notification',()=>{
 assert.ok(native.includes('updateBar.Visible = status != "none";'));
 const query=native.slice(native.indexOf('if (type.GetString() == "desktop.update.query")'),native.indexOf('if (type.GetString() == "desktop.update.request")'));
 assert.ok(!query.includes('updateBar.Visible = false'));
});