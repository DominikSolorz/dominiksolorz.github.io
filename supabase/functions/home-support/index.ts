import {createHandler} from './core.mjs';
const getKey=()=>Deno.env.get('YOUBOT_SUPPORT_API_KEY');
async function limit(request:Request) {
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!service||!getKey())return false;
  const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const day=new Date().toISOString().slice(0,10);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(getKey()),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(day+'|'+ip));
  const bucket=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const response=await fetch(url+'/rest/v1/rpc/home_support_take_budget',{
    method:'POST',signal:AbortSignal.timeout(5000),headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({client_bucket:bucket})
  });
  return response.ok && await response.json()===true;
}
Deno.serve(createHandler({getKey,limit}));
