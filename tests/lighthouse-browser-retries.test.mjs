import test from 'node:test';
import assert from 'node:assert/strict';
import {transientLighthouseFailure,auditPage} from '../scripts/audit-page.mjs';

test('transient browser startup and missing paint are retryable; real audit findings are not',()=>{
 for(const failure of ['NO_FCP','waiting for dynamic debugging port in chrome-err.log','Unable to connect to Chrome','PROTOCOL_TIMEOUT']){
  assert.ok(transientLighthouseFailure(failure),failure);
 }
 for(const failure of ['Broken link','Accessibility failed','Page returned HTTP 404']){
  assert.equal(transientLighthouseFailure(failure),false,failure);
 }
});

test('auth page browser crash retries in a fresh invocation, then audits desktop and mobile',async()=>{
 let calls=0,attempts=[],removed=[],rows;
 const fakeReport={finalUrl:'https://dominiksolorz.github.io/kamera/panel.html?auth=login',
  audits:{'color-contrast':{score:0,title:'Contrast'}},
  categories:{performance:{score:.74},accessibility:{score:.89},'best-practices':{score:1},seo:{score:.5}}};
 rows=await auditPage({id:'panel-login',path:'panel.html?auth=login',indexable:false},{
  spawn:(_exe,args)=>{calls++;attempts.push(args);return calls===1?
   {status:1,stdout:'',stderr:'NO_FCP: The page did not paint any content'}:{status:0,stdout:'',stderr:''};},
  read:async()=>JSON.stringify(fakeReport),
  remove:async p=>removed.push(p),
  wait:async()=>{},
  write:async()=>{},
  append:async()=>{},
  dir:'test-lighthouse-results'
 });
 assert.equal(calls,3,'one crashed Chrome plus successful desktop and mobile');
 assert.equal(rows.length,2);
 assert.equal(rows[0].mode,'desktop');
 assert.equal(rows[1].mode,'mobile');
 assert.equal(rows[0].scores.accessibility,89);
 assert.equal(rows[0].failures.length,1,'real accessibility findings remain visible');
 assert.ok(attempts[0].some(x=>x.includes('panel.html?auth=login')));
 assert.ok(attempts[0].includes('--max-wait-for-load=60000'));
 assert.ok(attempts[0].includes('--preset=desktop'));
 assert.ok(!attempts[2].includes('--preset=desktop'));
 assert.equal(removed.length,3,'never reuse a previous JSON report');
});

test('persistent NO_FCP remains a hard failure, not a green test',async()=>{
 let calls=0;
 await assert.rejects(
  auditPage({id:'panel-register',path:'panel.html?auth=register',indexable:false},{
   spawn:()=>{calls++;return {status:1,stdout:'',stderr:'NO_FCP'};},
   remove:async()=>{},wait:async()=>{},write:async()=>{},read:async()=>'{ }',
   dir:'test-lighthouse-results'
  }),
  /panel.html\?auth=register desktop, attempt 3\/3/
 );
 assert.equal(calls,3);
});

test('unrelated permanent Lighthouse failure stops immediately',async()=>{
 let calls=0;
 await assert.rejects(
  auditPage({id:'bad-page',path:'panel.html?auth=login',indexable:false},{
   spawn:()=>{calls++;return {status:1,stdout:'HTTP 404 response',stderr:''};},
   remove:async()=>{},wait:async()=>{},write:async()=>{},
   dir:'test-lighthouse-results'
  }),
  /attempt 1\/3/
 );
 assert.equal(calls,1);
});
