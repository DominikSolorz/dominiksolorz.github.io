import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../kamera/auth.js',import.meta.url),'utf8');
const flow=source.slice(source.indexOf('async function continueWithSession('),source.indexOf('window.__ensureAccountReady'));
async function run({user={id:'verified'},profile={first_name:'A',last_name:'B',address_line:'C',postal_code:'00-001',privacy_accepted_at:'yes',terms_accepted_at:'yes'},security={pin_hash:'hash'},failure=null}={}){
 const steps=[];const context={continuing:false,currentAccountUser:async()=>{if(failure)throw failure;return user;},profileFor:async()=>profile,securityForCurrentUser:async()=>security,section:s=>steps.push(s),message:()=>{},enterPanel:()=>steps.push('existing-PIN-gate'),$:()=>({first_name:{},last_name:{},address_line:{},postal_code:{},phone:{}})};
 vm.runInNewContext(flow,context);await context.continueWithSession();return steps;
}
test('verified existing account goes straight to existing PIN gate without device chooser',async()=>assert.deepEqual(await run(),['existing-PIN-gate']));
test('automatic device selection cannot replace sign in',async()=>assert.deepEqual(await run({user:null}),['login']));
test('first account still must set its PIN',async()=>assert.deepEqual(await run({security:null}),['pin']));
test('missing profile or consent still requires completion',async()=>assert.deepEqual(await run({profile:null}),['profile']));
test('server verification errors do not open the panel',async()=>assert.rejects(run({failure:Error('server rejected session')}),/server rejected/));
