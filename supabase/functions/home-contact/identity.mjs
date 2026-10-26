// Display data only. Never grants roles or camera permissions.
export async function contactIdentity(request,ticket,config,fetcher=fetch){
 const authorization=request.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(authorization)||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.authUrl||'')||!config.anonKey)return null;
 const headers={Authorization:authorization,apikey:config.anonKey};
 try{
  const response=await fetcher(config.authUrl+'/auth/v1/user',{headers,signal:AbortSignal.timeout(3000)});
  if(!response.ok)return null;
  const user=await response.json();
  if(!user.email_confirmed_at||typeof user.email!=='string'||user.email.toLowerCase()!==ticket.email.toLowerCase()||!/^[a-f0-9-]{36}$/i.test(user.id||''))return null;
  let profile=null;
  try{const r=await fetcher(config.authUrl+'/rest/v1/user_profiles?select=first_name,last_name&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1',{headers,signal:AbortSignal.timeout(2500)});if(r.ok)profile=(await r.json())[0];}catch{}
  const valid=s=>typeof s==='string'&&s.trim().length>0&&s.length<=80&&!/[\r\n]/.test(s);
  const result={name:valid(profile?.first_name)?profile.first_name.trim():ticket.name,surname:valid(profile?.last_name)?profile.last_name.trim():ticket.surname,identity:{verified:true}};
  const picture=user.identities?.find(i=>i.provider==='google')?.identity_data?.picture;
  if(typeof picture!=='string')return result;
  let url;try{url=new URL(picture);}catch{return result;}
  if(url.protocol!=='https:'||!/^lh[3-6]\.googleusercontent\.com$/.test(url.hostname)||url.username||url.password||url.port)return result;
  try{
   const r=await fetcher(url.toString(),{redirect:'error',signal:AbortSignal.timeout(3000)});
   const mime=r.headers.get('Content-Type')?.split(';')[0].toLowerCase();
   if(!r.ok||!['image/jpeg','image/png'].includes(mime)||Number(r.headers.get('Content-Length'))>32768)return result;
   const reader=r.body?.getReader();if(!reader)return result;
   const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();return result;}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   if(mime==='image/jpeg'&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))return result;
   if(mime==='image/png'&&![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return result;
   result.identity.avatarMime=mime;result.identity.avatarBase64=btoa(String.fromCharCode(...bytes));
  }catch{}return result;
 }catch{return null;}
}
