import {generateHostIdentity,exportHostPublicKey,decryptUnlockGrant} from './remote-unlock-crypto.mjs?v=1';
import {getDeviceState,setDeviceState} from './remote-unlock-device-store.mjs?v=1';
import {createPairingCode,pairingProof,equalsConstantTime,isFreshRequest,unlockWithDerivedPinKey} from './remote-unlock-protocol.mjs?v=1';

const keyOf=ownerId=>'host:'+ownerId;
const nowIso=()=>new Date().toISOString();
const fmtCode=code=>code.match(/.{1,4}/g)?.join(' ')||'';
const errorMessage=e=>String(e?.message||'Usługa niedostępna').slice(0,140);

export function createRemoteUnlockHost({client,ownerId}){
 if(!window.chrome?.webview||window.__HOME_SECURITY_DESKTOP__!==true) return null;
 if(!/^[a-f0-9-]{36}$/i.test(ownerId))return null;
 let record=null,ready=false,ended=false,loop=null,busy=false,lastHeartbeat=0;
 let pairedCode='',pairUntil=0,pairFailures=0,unlockCallback=null;
 let dialog=null,indicator=null;
 const trusted=()=>Object.keys(record?.trusted||{});
 const status=text=>{if(indicator)indicator.textContent=text;};
 const api=(query,action)=>{
   if(query?.error)throw query.error;
   return query?.data;
 };
 const mark=async(row,state)=>{
   const {error}=await client.from('hs_remote_requests').update({state,processed_at:nowIso()})
     .eq('id',row.id).eq('owner_id',ownerId).eq('host_id',record.hostId).eq('state','pending');
   if(error)throw error;
 };
 const save=async()=>setDeviceState(keyOf(ownerId),record);
 const heartbeat=async()=>{
   const {error}=await client.from('hs_remote_hosts').upsert({
     id:record.hostId,owner_id:ownerId,label:'Komputer HOME SECURITY',
     public_key:await exportHostPublicKey(record.keyPair),last_seen_at:nowIso()
   },{onConflict:'id'});
   if(error)throw error;
   lastHeartbeat=Date.now();
 };
 const acceptPair=async row=>{
   const body=row.payload||{};
   if(!ready||!document.querySelector('#app')||document.querySelector('#app').hidden||!pairedCode||pairUntil<Date.now()){
     await mark(row,'denied');return;
   }
   if(!body.phone_public_key||body.phone_public_key.kty!=='EC'||body.phone_public_key.crv!=='P-256'||typeof body.proof!=='string'){
     await mark(row,'denied');return;
   }
   let expected='';
   try{
     expected=await pairingProof({code:pairedCode,requestId:row.id,userId:ownerId,hostId:record.hostId,phoneId:row.phone_id,phonePublicKey:body.phone_public_key});
   }catch{await mark(row,'denied');return;}
   if(!equalsConstantTime(expected,body.proof)){
     pairFailures++;
     if(pairFailures>=5){pairedCode='';pairUntil=0;status('Zbyt wiele nieudanych prób. Wygeneruj nowy kod.');}
     await mark(row,'denied');return;
   }
   const approved=window.confirm('HOME SECURITY: Telefon z tego samego konta zna kod parowania. Czy zezwolić temu telefonowi na odblokowywanie TEGO komputera?');
   if(!approved){await mark(row,'denied');return;}
   record.trusted??={};
   record.trusted[row.phone_id]={publicKey:body.phone_public_key,pairedAt:nowIso()};
   await save();
   pairedCode='';pairUntil=0;pairFailures=0;
   await mark(row,'paired');
   status('Telefon sparowany. Zaufane telefony: '+trusted().length+'.');
 };
 const acceptUnlock=async row=>{
   const phone=record.trusted?.[row.phone_id];
   const grant=row.payload?.grant;
   if(!phone||typeof unlockCallback!=='function'||!grant||grant.id!==row.id){
     await mark(row,'denied');return;
   }
   // Verify the current signed-in account before decrypting a credential.
   const {data:{user}={},error:userError}=await client.auth.getUser();
   if(userError||user?.id!==ownerId){await mark(row,'denied');return;}
   const usedIds=new Set(record.usedIds||[]);
   let pinKey;
   try{
     pinKey=await decryptUnlockGrant(grant,{
       hostPrivateKey:record.keyPair.privateKey,
       pairedPhonePublicKey:phone.publicKey,userId:ownerId,
       hostId:record.hostId,phoneId:row.phone_id,usedIds
     });
   }catch{await mark(row,'denied');return;}
   const {data:security,error:securityError}=await client.from('user_security')
     .select('pin_hash,pin_wrapped_access_key,locked_until').eq('user_id',ownerId).maybeSingle();
   if(securityError||!security){await mark(row,'failed');return;}
   let accessKey=null;
   try{accessKey=await unlockWithDerivedPinKey(pinKey,security,ownerId);}catch{}
   pinKey=null;
   if(!accessKey){await mark(row,'denied');return;}
   record.usedIds=[...usedIds].slice(-250);
   await save(); // Persist nonce BEFORE unlocking; never accept replay after restart.
   const callback=unlockCallback;unlockCallback=null;
   if(callback(accessKey))await mark(row,'approved');
   else {
     await mark(row,'failed');
     status('Komputer nie przyjął odblokowania. Użyj lokalnego PIN-u.');
   }
 };
 const poll=async()=>{
   if(ended||!ready||busy)return;
   busy=true;
   try{
     if(Date.now()-lastHeartbeat>12000)await heartbeat();
     const {data,error}=await client.from('hs_remote_requests')
       .select('id,owner_id,host_id,phone_id,kind,payload,state,created_at,expires_at')
       .eq('owner_id',ownerId).eq('host_id',record.hostId).eq('state','pending')
       .gt('expires_at',nowIso()).order('created_at',{ascending:true}).limit(12);
     if(error)throw error;
     for(const row of data||[]){
       if(ended)break;
       if(!isFreshRequest(row)||row.owner_id!==ownerId||row.host_id!==record.hostId){
         await mark(row,'denied');continue;
       }
       try{
         if(row.kind==='pair')await acceptPair(row);
         else if(row.kind==='unlock')await acceptUnlock(row);
         else await mark(row,'denied');
       }catch{
         await mark(row,'failed').catch(()=>{});
       }
     }
   }catch(e){status('Telefon: '+errorMessage(e));}
   finally{busy=false;}
 };
 const start=async()=>{
   try{
     record=await getDeviceState(keyOf(ownerId));
     if(!record?.keyPair?.privateKey||!record?.hostId){
       record={hostId:crypto.randomUUID(),keyPair:await generateHostIdentity(),trusted:{},usedIds:[]};
       await save();
     }
     await heartbeat();
     ready=true;
     status('Zdalne odblokowanie gotowe. Zaufane telefony: '+trusted().length+'.');
     loop=setInterval(()=>{void poll();},2500);
     await poll();
   }catch(e){status('Zdalne odblokowanie niedostępne: '+errorMessage(e));}
 };
 const mountUI=()=>{
   const app=document.getElementById('app');if(!app)return;
   const entry=document.createElement('button');entry.type='button';entry.className='hsRemoteEntry';
   entry.textContent='Sparuj telefon';entry.title='Sparuj telefon, aby odblokowywać program Windows wpisanym na nim PIN-em';
   const target=app.querySelector('.desktopSidebar')||app.querySelector('.desktopSettingsScreen')||app;
   target.append(entry);
   dialog=document.createElement('dialog');dialog.className='hsRemoteDialog';
   dialog.innerHTML='<h2>Odblokowanie przez telefon</h2><p>Najpierw odblokuj ten komputer lokalnym PIN-em, a potem sparuj swój telefon. Później telefon będzie mógł odblokować tylko HOME SECURITY na tym komputerze.</p><output class="hsRemoteStatus" role="status"></output><p>Kod parowania ważny przez pięć minut:</p><output class="hsRemoteCode" aria-label="Kod parowania">Wybierz Utwórz kod</output><p class="hsRemoteWarning">Nie udostępniaj tego kodu obcym osobom. Każde pierwsze połączenie wymaga osobnego potwierdzenia na komputerze.</p><div class="hsRemoteActions"><button type="button" data-action="new">Utwórz kod</button><button type="button" class="secondary" data-action="revoke">Usuń sparowane telefony</button><button type="button" class="secondary" data-action="close">Zamknij</button></div>';
   app.append(dialog);
   indicator=dialog.querySelector('.hsRemoteStatus');
   dialog.querySelector('[data-action="close"]').onclick=()=>dialog.close();
   dialog.querySelector('[data-action="new"]').onclick=()=>{
     if(!ready){status('Połączenie konta nie jest gotowe. Sprawdź internet.');return;}
     pairedCode=createPairingCode();pairUntil=Date.now()+300000;pairFailures=0;
     dialog.querySelector('.hsRemoteCode').textContent=fmtCode(pairedCode);
     status('Otwórz HOME SECURITY na telefonie, wybierz Sparuj komputer i wpisz kod.');
   };
   dialog.querySelector('[data-action="revoke"]').onclick=async()=>{
     if(!record||!window.confirm('Usunąć zaufanie do wszystkich telefonów dla tego komputera?'))return;
     record.trusted={};pairedCode='';pairUntil=0;await save();
     status('Zaufanie usunięte. Każdy telefon wymaga nowego parowania.');
     dialog.querySelector('.hsRemoteCode').textContent='Nieaktywny';
   };
   entry.onclick=()=>{status(ready?'Zaufane telefony: '+trusted().length+'.':'Czekam na połączenie z usługą.');dialog.showModal();};
 };
 const stop=()=>{ended=true;clearInterval(loop);pairedCode='';unlockCallback=null;};
 window.addEventListener('pagehide',stop,{once:true});
 return {
   start,mountUI,stop,
   bindUnlock(callback){unlockCallback=typeof callback==='function'?callback:null;},
   isReady(){return ready;}
 };
}
