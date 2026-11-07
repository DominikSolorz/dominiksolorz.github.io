import {generatePhoneIdentity,exportPhonePublicKey,encryptUnlockGrant} from './remote-unlock-crypto.mjs?v=1';
import {getDeviceState,setDeviceState} from './remote-unlock-device-store.mjs?v=1';
import {pairingProof,unlockWithDerivedPinKey,normalizePairingCode} from './remote-unlock-protocol.mjs?v=1';
import {deriveKey} from './pin.js?v=14';

const storageKey=owner=>'phone:'+owner;
const offlineMessage='Nie znaleziono uruchomionego komputera. Otwórz HOME SECURITY Desktop na Windows i upewnij się, że ma internet.';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const samePublicKey=(a,b)=>a?.kty==='RSA'&&b?.kty==='RSA'&&a.n===b.n&&a.e===b.e;

export function mountRemoteUnlockPhone({client,ownerId}){
 if(!/^[a-f0-9-]{36}$/i.test(ownerId)||window.chrome?.webview)return null;
 const app=document.getElementById('app');if(!app)return null;
 let record=null,hosts=[],working=false,stopped=false,lastAttempts=[];
 const entry=document.createElement('button');entry.type='button';entry.className='hsRemoteEntry';
 entry.textContent='Odblokuj komputer PIN-em';
 entry.title='Odblokuj uruchomiony program HOME SECURITY Windows przez wpisanie PIN-u na telefonie';
 (app.querySelector('.mobileAppHeader')||app).append(entry);
 const dialog=document.createElement('dialog');dialog.className='hsRemoteDialog';
 dialog.innerHTML='<h2>Odblokuj komputer</h2><p>Wybierz uruchomiony komputer HOME SECURITY. Pierwsze połączenie wymaga kodu i potwierdzenia na Windows. Każde kolejne odblokowanie wymaga Twojego PIN-u.</p><label>Komputer<select name="host" required aria-label="Wybierz komputer"></select></label><label>Kod parowania (tylko za pierwszym razem)<input type="text" name="code" maxlength="29" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Kod wyświetlony na komputerze"></label><label>PIN właściciela<input type="password" name="pin" inputmode="numeric" autocomplete="off" minlength="4" maxlength="6" pattern="(?:[0-9]{4}|[0-9]{6})" placeholder="4 lub 6 cyfr"></label><output role="status" class="hsRemoteStatus"></output><p class="hsRemoteWarning">PIN pozostaje na telefonie. Do komputera trafia wyłącznie zaszyfrowany dowód znajomości bieżącego PIN-u. Nie odblokowuje to systemu Windows.</p><div class="hsRemoteActions"><button data-action="pair" type="button">Sparuj komputer</button><button data-action="unlock" type="button">Odblokuj Windows</button><button class="secondary" data-action="refresh" type="button">Odśwież listę</button><button class="secondary" data-action="close" type="button">Zamknij</button></div>';
 app.append(dialog);
 const hostSelect=dialog.querySelector('[name="host"]'),codeInput=dialog.querySelector('[name="code"]');
 const pinInput=dialog.querySelector('[name="pin"]'),status=dialog.querySelector('.hsRemoteStatus');
 const msg=text=>{status.textContent=text;};
 const buttons=[...dialog.querySelectorAll('button')];
 const setBusy=value=>{working=value;for(const b of buttons)if(b.dataset.action!=='close')b.disabled=value;};
 const load=async()=>{
   const {data,error}=await client.from('hs_remote_hosts')
     .select('id,label,public_key,last_seen_at').eq('owner_id',ownerId)
     .gte('last_seen_at',new Date(Date.now()-50000).toISOString())
     .order('last_seen_at',{ascending:false}).limit(12);
   if(error)throw error;
   hosts=data||[];
   const prev=hostSelect.value;
   hostSelect.replaceChildren();
   for(const host of hosts){
     const option=document.createElement('option');option.value=host.id;
     option.textContent=host.label+' ('+host.id.slice(0,8)+')'+(record?.paired?.[host.id]?' · sparowany':' · wymaga parowania');
     hostSelect.append(option);
   }
   if(hosts.some(h=>h.id===prev))hostSelect.value=prev;
   if(!hosts.length)msg(offlineMessage);
   else msg('Wybierz komputer. Sparowane urządzenia można odblokować przez PIN.');
 };
 const selected=()=>{
   const host=hosts.find(h=>h.id===hostSelect.value);
   if(!host)throw new Error(offlineMessage);
   return host;
 };
 const request=async({id,hostId,phoneId,kind,payload})=>{
   const {error}=await client.from('hs_remote_requests').insert({
     id,owner_id:ownerId,host_id:hostId,phone_id:phoneId,kind,
     payload,expires_at:new Date(Date.now()+90000).toISOString()
   });
   if(error)throw error;
 };
 const awaitHost=async(id,okState)=>{
   for(let i=0;i<36&&!stopped;i++){
     await delay(2000);
     const {data,error}=await client.from('hs_remote_requests')
       .select('state,expires_at').eq('id',id).eq('owner_id',ownerId).maybeSingle();
     if(error)throw error;
     if(!data)throw new Error('Nie znaleziono potwierdzenia komputera.');
     if(data.state===okState)return;
     if(['denied','failed'].includes(data.state))throw new Error('Komputer odrzucił żądanie. Sprawdź PIN, kod parowania i zaufane urządzenia.');
     if(Date.parse(data.expires_at)<Date.now())break;
   }
   throw new Error('Komputer nie odpowiedział. Upewnij się, że jest uruchomiony i połączony z internetem.');
 };
 const init=async()=>{
   record=await getDeviceState(storageKey(ownerId));
   if(!record?.keyPair?.privateKey||!record?.phoneId){
     record={phoneId:crypto.randomUUID(),keyPair:await generatePhoneIdentity(),paired:{}};
     await setDeviceState(storageKey(ownerId),record);
   }
 };
 const pair=async()=>{
   const host=selected();
   const code=normalizePairingCode(codeInput.value);
   if(!/^[A-HJ-NP-Z2-9]{20}$/.test(code))throw new Error('Wpisz 20 znaków kodu wyświetlonego w programie Windows.');
   const id=crypto.randomUUID(),pub=await exportPhonePublicKey(record.keyPair);
   const proof=await pairingProof({code,requestId:id,userId:ownerId,hostId:host.id,phoneId:record.phoneId,phonePublicKey:pub});
   codeInput.value='';
   await request({id,hostId:host.id,phoneId:record.phoneId,kind:'pair',payload:{phone_public_key:pub,proof}});
   msg('Czekam na potwierdzenie parowania na komputerze…');
   await awaitHost(id,'paired');
   record.paired??={};record.paired[host.id]={publicKey:host.public_key,pairedAt:Date.now()};
   await setDeviceState(storageKey(ownerId),record);
   msg('Telefon sparowany. Możesz odblokować komputer, wpisując PIN.');
   await load();
 };
 const unlock=async()=>{
   const host=selected();
   const pairing=record.paired?.[host.id];
   if(!pairing)throw new Error('Najpierw sparuj ten komputer, wpisując kod widoczny na Windows.');
   if(!samePublicKey(pairing.publicKey,host.public_key))throw new Error('Zmienił się klucz komputera. Parowanie nie jest już zaufane.');
   const now=Date.now();lastAttempts=lastAttempts.filter(t=>now-t<60000);
   if(lastAttempts.length>=3)throw new Error('Za dużo prób. Poczekaj minutę przed ponownym wpisaniem PIN-u.');
   lastAttempts.push(now);
   const pin=pinInput.value.trim();
   pinInput.value='';
   if(!/^(?:[0-9]{4}|[0-9]{6})$/.test(pin))throw new Error('PIN musi mieć dokładnie 4 lub 6 cyfr.');
   const {data:{user}={},error:userError}=await client.auth.getUser();
   if(userError||user?.id!==ownerId)throw new Error('Sesja konta zmieniła się. Zaloguj się ponownie.');
   const {data:security,error:securityError}=await client.from('user_security')
     .select('pin_salt,pin_hash,pin_wrapped_access_key,locked_until')
     .eq('user_id',ownerId).maybeSingle();
   if(securityError||!security)throw new Error('Nie udało się potwierdzić PIN-u konta.');
   let pinKey=await deriveKey(pin,security.pin_salt);
   const accessKey=await unlockWithDerivedPinKey(pinKey,security,ownerId);
   if(!accessKey){pinKey=null;throw new Error('Nieprawidłowy PIN lub czasowa blokada konta.');}
   // PIN and the derived key never go over the network in plaintext.
   const grant=await encryptUnlockGrant({
     accessKey:pinKey,hostPublicKey:pairing.publicKey,
     phonePrivateKey:record.keyPair.privateKey,userId:ownerId,
     hostId:host.id,phoneId:record.phoneId
   });
   pinKey=null;
   await request({id:grant.id,hostId:host.id,phoneId:record.phoneId,kind:'unlock',payload:{grant}});
   msg('PIN potwierdzony. Czekam, aż komputer odblokuje panel…');
   await awaitHost(grant.id,'approved');
   msg('Program HOME SECURITY na komputerze potwierdził odblokowanie.');
 };
 const run=fn=>async()=>{
   if(working)return;
   setBusy(true);
   try{await init();await fn();}
   catch(e){msg(String(e?.message||'Nie udało się połączyć z komputerem.'));}
   finally{pinInput.value='';setBusy(false);}
 };
 dialog.querySelector('[data-action="pair"]').onclick=run(pair);
 dialog.querySelector('[data-action="unlock"]').onclick=run(unlock);
 dialog.querySelector('[data-action="refresh"]').onclick=run(load);
 dialog.querySelector('[data-action="close"]').onclick=()=>dialog.close();
 entry.onclick=run(async()=>{dialog.showModal();await load();});
 window.addEventListener('pagehide',()=>{stopped=true;pinInput.value='';},{once:true});
 return {dispose(){stopped=true;dialog.remove();entry.remove();}};
}
