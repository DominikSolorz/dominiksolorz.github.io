import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAgentTelemetry} from '../kamera/communication/agent-telemetry.mjs';
import {createStore} from '../kamera/core/store.mjs';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup(execute){
 const store=createStore();let disposed=false,cancelled=false;
 const monitor=createAgentTelemetry({client:{execute,dispose(){disposed=true;}},store,interval:()=>1,cancel:()=>{cancelled=true;}});
 return {monitor,store,closed:()=>disposed&&cancelled};
}
test('real ping and snapshot confirm agent only, never camera or recording',async()=>{
 const calls=[];const x=setup(async name=>{calls.push(name);return {status:'succeeded',result:{mediaEngine:'not_implemented'}};});
 await settle();assert.deepEqual(calls,['agent.ping','system.snapshot']);
 assert.equal(x.store.read('agent').status,'healthy');assert.match(x.store.read('agent').message,/nie agent/);
 assert.equal(x.store.read('capture').status,'unknown');assert.equal(x.store.read('recording').status,'unknown');
 x.monitor.dispose();assert.equal(x.closed(),true);
});
test('unavailable agent does not change recording or cloud state',async()=>{
 const x=setup(async()=>({status:'unknown',code:'TIMEOUT'}));await settle();
 assert.equal(x.store.read('agent').status,'disconnected');assert.equal(x.store.read('cloudAccess').status,'unknown');
 x.monitor.dispose();
});
test('unconfirmed snapshot is degraded, not healthy',async()=>{
 const x=setup(async name=>({status:name==='agent.ping'?'succeeded':'unknown'}));await settle();
 assert.equal(x.store.read('agent').status,'degraded');x.monitor.dispose();
});
test('Drive telemetry uses persisted native component heartbeat and preserves counts',async()=>{
 const updatedAt=new Date().toISOString();const x=setup(async name=>name==='agent.ping'?{status:'succeeded',result:{mediaEngine:'not_implemented'}}:{status:'succeeded',result:{components:{'drive.sync':{state:{status:'uploading',counts:{succeeded:1,running:1}},updatedAt}}}});
 await settle();assert.equal(x.store.read('nativeDrive').counts.succeeded,1);assert.equal(x.store.read('nativeDrive').updatedAt,updatedAt);assert.equal(x.store.read('capture').status,'unknown');x.monitor.dispose();
});
test('late reply after disposal never updates state',async()=>{
 let resolve;const x=setup(()=>new Promise(r=>{resolve=r;}));x.monitor.dispose();
 resolve({status:'succeeded'});await settle();assert.equal(x.store.read('agent').status,'unknown');
});
test('release includes agent and CI checks before deployment',async()=>{
 const root=new URL('../',import.meta.url);
 const [runtime,installer,workflow,build]=await Promise.all(['desktop-client/AgentRuntime.cs','desktop-client/installer/HomeSecurityDesktop.iss','.github/workflows/pages.yml','desktop-client/build-release.ps1'].map(p=>readFile(new URL(p,root),'utf8')));
 assert.ok(runtime.includes('"Agent", version, "HomeSecurityAgent.exe"'));assert.ok(!/\.Kill\(/.test(runtime));
 assert.ok(installer.includes('#error'));assert.ok(build.includes('HomeSecurityAgent.csproj'));
 assert.ok(workflow.includes('needs: verify'));assert.ok(workflow.includes('node --test'));assert.ok(workflow.includes('agent-tests/HomeSecurity.Agent.Tests.csproj'));
});
