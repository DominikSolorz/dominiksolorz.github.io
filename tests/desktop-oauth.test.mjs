import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {validAuthorizeUrl, validHandoff, beginBrowserHandoff,desktopGoogleCode} from '../kamera/desktop-oauth.mjs';
const nonce='N'.repeat(43);
const authorize=new URL('https://ksacbcrzuwdahnmggfxg.supabase.co/auth/v1/authorize');
for(const [key,value] of Object.entries({provider:'google',redirect_to:'https://dominiksolorz.github.io/kamera/',code_challenge:nonce,code_challenge_method:'s256',prompt:'select_account',scopes:'openid email profile'}))authorize.searchParams.set(key,value);
test('desktop OAuth allows only our Google PKCE endpoint and exact callback',()=>{
 assert.equal(validAuthorizeUrl(authorize.href),true);
 for(const change of [u=>u.hostname='evil.example',u=>u.port='444',u=>u.username='user',u=>u.searchParams.set('redirect_to','https://evil.example/'),u=>u.searchParams.set('provider','github'),u=>u.searchParams.set('code_challenge_method','plain'),u=>u.searchParams.delete('code_challenge'),u=>u.searchParams.append('provider','google'),u=>u.searchParams.set('access_token','private')]){const u=new URL(authorize);change(u);assert.equal(validAuthorizeUrl(u.href),false,u.href);}
});
test('browser handoff stores only loopback routing and never the verifier or tokens',()=>{
 const handoff={url:authorize.href,nonce,port:49152};const records=new Map();let destination;
 assert.equal(beginBrowserHandoff({hash:Buffer.from(JSON.stringify(handoff)).toString('base64url'),storage:{setItem:(k,v)=>records.set(k,v)},navigate:u=>destination=u,now:12345}),true);
 assert.equal(destination,authorize.href);assert.deepEqual(JSON.parse(records.values().next().value),{nonce,port:49152,at:12345});
 for(const port of [80,0,65536,1.5,'49152'])assert.equal(validHandoff({...handoff,port}),false);
});
const script=readFileSync(new URL('../kamera/desktop-auth-return.js',import.meta.url),'utf8');
function callback(search='',hash='',record={nonce,port:49152,at:Date.now()}){let destination;const storage=new Map(record?[['hs-desktop-oauth-v1',JSON.stringify(record)]]:[]);const window={};vm.runInNewContext(script,{window,Date,URL,URLSearchParams,location:{search,hash,replace:u=>destination=u},sessionStorage:{getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)}});return {destination,window,storage};}
test('callback forwards one opaque code once, with nonce, before account initialization',()=>{
 const r=callback('?code=one-use-code');const u=new URL(r.destination);assert.equal(u.origin,'http://127.0.0.1:49152');assert.equal(u.searchParams.get('state'),nonce);assert.equal(u.searchParams.get('code'),'one-use-code');assert.equal(r.window.__hsDesktopOAuthReturning,true);assert.equal(r.storage.size,0);
});
test('callback never forwards JWTs, duplicates, stale state or unrelated browser logins',()=>{
 for(const r of [callback('','#access_token=private&refresh_token=private'),callback('?code=one-use-code&code=duplicate'),callback('?code=one-use-code','',null),callback('?code=one-use-code','',{nonce,port:49152,at:Date.now()-181000}),callback('?code=one-use-code','',{nonce,port:80,at:Date.now()})])assert.equal(r.destination,undefined);
 const u=new URL(callback('?error=access_denied').destination);assert.equal(u.searchParams.get('error'),'cancelled');assert.equal(u.searchParams.has('code'),false);
});
test('native result must match the initiating request and cancellation closes listener',async()=>{
 let listener,request;const messages=[];const webview={addEventListener:(_,fn)=>listener=fn,removeEventListener:()=>listener=null,postMessage:m=>{messages.push(m);request=m;}};
 const promise=desktopGoogleCode(authorize.href,{webview,supported:true});
 listener({data:{type:'desktop.auth.google.result',id:'other',code:'bad-code'}});
 assert.ok(listener);listener({data:{type:'desktop.auth.google.result',id:request.id,code:'one-use-code'}});assert.equal(await promise,'one-use-code');assert.equal(listener,null);
 const abort=new AbortController();const pending=desktopGoogleCode(authorize.href,{webview,supported:true,signal:abort.signal});abort.abort();await assert.rejects(pending,/anulowane/);assert.equal(messages.at(-1).type,'desktop.auth.cancel');assert.equal(listener,null);
 await assert.rejects(desktopGoogleCode(authorize.href,{webview,supported:false}),/Zaktualizuj/);
});
