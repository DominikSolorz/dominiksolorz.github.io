import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const app = await readFile(new URL('../kamera/app.js', import.meta.url), 'utf8');
const pump = app.slice(app.indexOf('  async function pump() {'), app.indexOf('  // Ręczne „☁️'));
function setup({ preflight = false, missing = false, verifyFails = false } = {}) {
  const deleted = [], timers = [];
  const ctx = vm.createContext({ console, Set, Error, MAX_UPLOAD: 100, errText: String,
    cloud: { enabled: true, big: true, version: async () => { if(preflight) throw Error('offline'); },
      upload: async () => ({id:'remote'}), verifyUploaded: async () => { if(verifyFails) throw Error('not confirmed'); return {id:'remote',name:'recording'}; }, call: async () => ({}) },
    idb: { qKeys: async () => deleted.length ? [] : ['recording'], qGet: async () => ({ref:'recording'}), qDel: async key => deleted.push(key) },
    recstore: {blob: async () => missing ? null : {size:10}, update: async () => {}}, diskstore: {},
    prefs: {retentionDays:30}, render() {}, clearTimeout() {}, setTimeout: fn => timers.push(fn),
  });
  vm.runInContext('let pumping=false, retryTimer=null, queued=0, lastError="", sentToDrive=0, verifiedToDrive=0, lastVerified=""; const oversize=new Set();\n' + pump + '\n globalThis.run=pump; globalThis.state=()=>({pumping,lastError,verifiedToDrive});',ctx);
  return {ctx,deleted,timers};
}
test('preflight failure releases upload lock and schedules retry', async () => {
  const s=setup({preflight:true}); await s.ctx.run();
  assert.equal(s.ctx.state().pumping,false); assert.equal(s.timers.length,1); assert.equal(s.deleted.length,0);
});
test('unavailable local recording is not silently removed from queue', async () => {
  const s=setup({missing:true}); await s.ctx.run(); assert.equal(s.deleted.length,0); assert.equal(s.timers.length,1);
});
test('unconfirmed upload stays queued', async () => {
  const s=setup({verifyFails:true}); await s.ctx.run(); assert.equal(s.deleted.length,0); assert.equal(s.ctx.state().verifiedToDrive,0);
});
test('confirmed upload clears queue only, never local recording', async () => {
  const s=setup(); await s.ctx.run(); assert.deepEqual(s.deleted,['recording']); assert.equal(s.ctx.state().verifiedToDrive,1);
});
