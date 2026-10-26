export const CONTACT_TOPICS=['Pomoc techniczna','Konto i dostęp','Kamera i dźwięk','Nagrania i Google Drive','Produkt i współpraca','Prywatność i dokumenty'];
export function validateContact(body){
  if(!body||typeof body!=='object'||body.consent!==true||!CONTACT_TOPICS.includes(body.topic)||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.requestId||'')||body.website)throw Error('invalid_request');
  for(const [key,max] of [['name',80],['surname',80],['email',254],['message',4000]])if(typeof body[key]!=='string'||!body[key].trim()||body[key].length>max)throw Error('invalid_request');
  if(body.message.trim().length<10||/[\r\n]/.test(body.email+body.name+body.surname)||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(body.email)||/sk-(?:live|proj)-[A-Za-z0-9_-]{12,}/.test(body.message))throw Error('invalid_request');
  return {requestId:body.requestId.toLowerCase(),name:body.name.trim(),surname:body.surname.trim(),email:body.email.trim(),topic:body.topic,message:body.message.trim(),consent:true};
}
export async function signTicket(ticket,secret,issuedAt){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const canonical=JSON.stringify([ticket.requestId,ticket.name,ticket.surname,ticket.email,ticket.topic,ticket.message,ticket.consent]);
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(canonical+'\n'+issuedAt));
  return Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,'0')).join('');
}
export function contactHandler({getConfig,fetcher=fetch,now=Date.now}){
  return async request=>{
    const origin=request.headers.get('Origin'),headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
    const json=(body,status=200)=>Response.json(body,{status,headers});
    if(origin!=='https://dominiksolorz.github.io')return json({error:'origin_denied'},403);
    Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type'});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return json({error:'method_not_allowed'},405);
    try{
      if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'invalid_request'},400);
      const reader=request.body?.getReader();if(!reader)return json({error:'invalid_request'},400);
      let size=0;const chunks=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16000){await reader.cancel();return json({error:'request_too_large'},413);}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
      let ticket;try{ticket=validateContact(JSON.parse(new TextDecoder().decode(bytes)));}catch{return json({error:'invalid_request'},400);}
      const config=getConfig();
      if(!config?.secret||!/^[a-f0-9]{64}$/.test(config.secret)||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.url||''))return json({error:'contact_unavailable'},503);
      const issuedAt=now(),signature=await signTicket(ticket,config.secret,issuedAt);
      const response=await fetcher(config.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket,issuedAt,signature}),signal:AbortSignal.timeout(25000),redirect:'follow'});
      if(!response.ok)return json({error:'delivery_unconfirmed',requestId:ticket.requestId},503);
      const result=await response.json();
      if(result.ok===true&&result.status==='sent'&&result.requestId===ticket.requestId)return json({ok:true,status:'sent',requestId:ticket.requestId,ticketNumber:'HS-'+ticket.requestId.slice(0,8).toUpperCase(),copyStatus:['sent','unknown','not_sent'].includes(result.copyStatus)?result.copyStatus:'not_sent'});
      console.warn('contact-relay-result',JSON.stringify({status:response.status,code:['unauthorized','invalid_request','conflict','rate_limited','service_unavailable','delivery_unknown'].includes(result.error)?result.error:'invalid_reply'}));
      if(result.error==='rate_limited')return json({error:'rate_limited'},429);
      if(result.error==='conflict')return json({error:'conflict'},409);
      return json({error:'delivery_unconfirmed',requestId:ticket.requestId},503);
    }catch{return json({error:'delivery_unconfirmed'},503);}
  };
}
