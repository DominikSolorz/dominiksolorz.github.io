import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHmac,createHash,webcrypto} from 'node:crypto';
import {contactHandler,validateContact,signTicket} from '../supabase/functions/home-contact/core.mjs';
const ticket={requestId:'abcde123-1234-4234-8234-123456789abc',name:'Test',surname:'Formularza',email:'qa@example.com',topic:'Pomoc techniczna',message:'Test techniczny formularza.',consent:true};
const secret='a'.repeat(64),url='https://script.google.com/macros/s/test-endpoint/exec';
const request=(body=ticket,origin='https://dominiksolorz.github.io')=>new Request('https://example.test/contact',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('signature is UTF-8 and independent of JSON object key order',async()=>{
 const value={...ticket,message:'Zażółć gęślą jaźń — kamera 🔴'};
 const reversed=Object.fromEntries(Object.entries(value).reverse());
 assert.equal(await signTicket(value,secret,123),await signTicket(reversed,secret,123));
});
test('contact validates required identity, consent, request UUID and header injection',()=>{
 assert.equal(validateContact(ticket).email,'qa@example.com');
 for(const bad of [{...ticket,consent:false},{...ticket,surname:''},{...ticket,email:'qa@example.com\nBcc:bad@example.com'},{...ticket,message:'x'.repeat(4001)},{...ticket,requestId:'not-an-id'},{...ticket,website:'bot'},{...ticket,topic:'arbitrary'}])assert.throws(()=>validateContact(bad));
});
test('contact backend uses fixed relay, signed payload and confirmed matching receipt only',async()=>{
 const handle=contactHandler({getConfig:()=>({url,secret}),fetcher:async(target,options)=>{
  assert.equal(target,url);const payload=JSON.parse(options.body);
  const t=payload.ticket;assert.equal(payload.signature,createHmac('sha256',secret).update(JSON.stringify([t.requestId,t.name,t.surname,t.email,t.topic,t.message,t.consent])+'\n'+payload.issuedAt).digest('hex'));
  assert.equal(payload.ticket.to,undefined);return Response.json({ok:true,status:'sent',requestId:ticket.requestId});
 }});
 const response=await handle(request({...ticket,to:'evil@example.com'}));assert.equal(response.status,200);assert.equal((await response.json()).status,'sent');
});
test('missing relay, forbidden origins and unconfirmed upstream never claim sent',async()=>{
 assert.equal((await contactHandler({getConfig:()=>null})(request())).status,503);
 assert.equal((await contactHandler({getConfig:()=>null})(request(ticket,'https://evil.test'))).status,403);
 for(const response of [Response.json({ok:true}),Response.json({ok:true,status:'sent',requestId:'wrong'}),new Response('server error',{status:500})]){
  const result=await contactHandler({getConfig:()=>({url,secret}),fetcher:async()=>response})(request());assert.equal(result.status,503);assert.ok(!(await result.json()).ok);
 }
});
const mailSource=await readFile(new URL('../supabase/contact-mailer.gs',import.meta.url),'utf8');
function mailRuntime(throwOnSend=false){
 const props=new Map([['CONTACT_RELAY_SECRET',secret]]);let sends=[];
 const properties={getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),getProperties:()=>Object.fromEntries(props),deleteProperty:k=>props.delete(k)};
 const context={PropertiesService:{getScriptProperties:()=>properties},LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:message=>{sends.push(message);if(throwOnSend)throw Error('uncertain');}},Utilities:{Charset:{UTF_8:'utf-8'},DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(algorithm,text)=>[...createHash('sha256').update(text).digest()],computeHmacSha256Signature:(text,key)=>[...createHmac('sha256',key).update(text).digest()]},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}};
 vm.createContext(context);vm.runInContext(mailSource,context);return {context,sends,props};
}
async function envelope(value=ticket){const issuedAt=Date.now();return {ticket:value,issuedAt,signature:await signTicket(value,secret,issuedAt)};}
test('Apps Script sends only to owner, sets reply-to and deduplicates repeat UUID',async()=>{
 const runtime=mailRuntime(),body=await envelope();const event={postData:{contents:JSON.stringify(body)}};
 assert.equal(runtime.context.doPost(event).status,'sent');assert.equal(runtime.context.doPost(event).status,'sent');assert.equal(runtime.sends.length,1);
 assert.equal(runtime.sends[0].to,'goldservicepoland@gmail.com');assert.equal(runtime.sends[0].replyTo,ticket.email);
 const changed=await envelope({...ticket,message:'Inna treść tego samego numeru.'});assert.equal(runtime.context.doPost({postData:{contents:JSON.stringify(changed)}}).error,'conflict');assert.equal(runtime.sends.length,1);
});
test('Apps Script rejects bad signature and never automatically retries uncertain delivery',async()=>{
 const runtime=mailRuntime(true),body=await envelope();
 const invalid={...body,signature:'0'.repeat(64)};assert.equal(runtime.context.doPost({postData:{contents:JSON.stringify(invalid)}}).error,'unauthorized');assert.equal(runtime.sends.length,0);
 const event={postData:{contents:JSON.stringify(body)}};assert.equal(runtime.context.doPost(event).error,'delivery_unknown');assert.equal(runtime.context.doPost(event).error,'delivery_unknown');assert.equal(runtime.sends.length,1);
});
test('contact frontend preserves entered values and reuses request ID on a retry even if session storage is blocked',async()=>{
 const listeners={},elements=Object.fromEntries(Object.entries({...ticket,website:'',consent:true}).map(([k,v])=>[k,k==='consent'?{checked:v}:{value:v}]));
 const fields={},result={dataset:{}},submit={};let sent=[];let nextReply='fail';
 const form={action:'https://example.test/contact',reportValidity:()=>true,elements:{namedItem:name=>elements[name]},addEventListener:(event,callback)=>listeners[event]=callback};
 const document={querySelector:selector=>({'#mktContactForm':form,'#mktContactResult':result,'#mktSendMessage':submit,'#mktContactFields':fields}[selector])};
 const context={document,crypto:webcrypto,TextEncoder,AbortSignal,Date,sessionStorage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}},fetch:async(_,options)=>{
  const body=JSON.parse(options.body);sent.push(body);return nextReply==='fail'?Response.json({error:'delivery_unconfirmed'},{status:503}):Response.json({ok:true,status:'sent',requestId:body.requestId});
 }};vm.createContext(context);vm.runInContext(await readFile(new URL('../kamera/marketing-contact.js',import.meta.url),'utf8'),context);
 await listeners.submit({preventDefault(){}});assert.equal(result.dataset.state,'error');assert.equal(elements.message.value,ticket.message);assert.equal(submit.disabled,false);
 nextReply='sent';await listeners.submit({preventDefault(){}});assert.equal(sent[0].requestId,sent[1].requestId);assert.equal(result.dataset.state,'sent');assert.equal(submit.disabled,true);assert.ok(result.textContent.includes(sent[1].requestId));
});
