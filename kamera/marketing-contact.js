// A receipt is displayed only after the server confirms MailApp accepted the message.
const form=document.querySelector('#mktContactForm');
if(form){
  const result=document.querySelector('#mktContactResult'),submit=document.querySelector('#mktSendMessage'),fields=document.querySelector('#mktContactFields');
  let busy=false,receiptState=null;
  const value=name=>String(form.elements.namedItem(name).value||'').trim();
  const show=(text,state)=>{result.textContent=text;result.dataset.state=state;};
  async function requestId(payload){
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));
    const fingerprint=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
    let previous=receiptState;try{previous=JSON.parse(sessionStorage.getItem('hs-contact-receipt')||'null')||previous;}catch{}
    if(previous?.fingerprint===fingerprint && Date.now()-previous.created<172800000)return previous.id;
    const id=crypto.randomUUID();
    receiptState={id,fingerprint,created:Date.now()};
    try{sessionStorage.setItem('hs-contact-receipt',JSON.stringify(receiptState));}catch{}
    return id;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!form.reportValidity())return;
    const payload={name:value('name'),surname:value('surname'),email:value('email'),topic:value('topic'),message:value('message'),website:value('website'),consent:form.elements.namedItem('consent').checked};
    if(payload.message.length<10){show('Opisz sprawę w co najmniej 10 znakach.','error');return;}
    if(/sk-(?:live|proj)-[A-Za-z0-9_-]{12,}/.test(payload.message)){show('Usuń klucz API z treści. Nie wysyłaj sekretów w formularzu.','error');return;}
    busy=true;submit.disabled=true;fields.disabled=true;submit.textContent='Wysyłanie…';show('Wysyłanie wiadomości do administratora…','sending');
    try{
      payload.requestId=await requestId(payload);
      const headers={'Content-Type':'application/json'};
      if(globalThis.supabase?.createClient){
        try{
          const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=await import('./config.js?v=34');
          if(form.action!==SUPABASE_URL+'/functions/v1/home-contact')throw Error('invalid_endpoint');
          const client=globalThis.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:false,detectSessionInUrl:false,storageKey:"home-security-account-v1"}});
          let timer;let data;try{({data}=await Promise.race([client.auth.getSession(),new Promise(resolve=>{timer=setTimeout(()=>resolve({data:{session:null}}),2500);})]));}finally{clearTimeout(timer);}
          if(data.session?.access_token)headers.Authorization='Bearer '+data.session.access_token;
        }catch{} // Guests and expired sessions can still send a normal contact request.
      }
      const response=await fetch(form.action,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
      const receipt=await response.json();
      if(!response.ok||receipt.ok!==true||receipt.status!=='sent'||receipt.requestId!==payload.requestId)throw Error(receipt.error||'delivery_unconfirmed');
      submit.textContent='Wysłano ✓';
      const number=receipt.ticketNumber||'HS-'+receipt.requestId.slice(0,8).toUpperCase();
      const copy=receipt.copyStatus==='sent'?' Potwierdzenie i kopia wiadomości zostały wysłane na '+payload.email+'. Sprawdź także Spam.':' Nie udało się potwierdzić wysyłki kopii na Twój adres. Zgłoszenie dotarło do administratora — nie wysyłaj go ponownie.';
      show('Zgłoszenie '+number+' zostało przyjęte. Odpowiemy na podany adres e-mail.'+copy,'sent');
    }catch(error){
      submit.disabled=false;submit.textContent='Spróbuj ponownie →';
      show(error.message==='rate_limited'?'Za dużo wiadomości w krótkim czasie. Odczekaj minutę i ponów wysyłkę. Jeśli limit dzienny został osiągnięty, napisz bezpośrednio na goldservicepoland@gmail.com.':'Nie udało się potwierdzić wysłania. Treść została zachowana. Ponów bez zmiany treści — ten sam numer zgłoszenia chroni przed podwójną wysyłką. Możesz też napisać na goldservicepoland@gmail.com.','error');
    }finally{busy=false;fields.disabled=false;}
  });
  form.addEventListener('input',()=>{if(!busy){submit.disabled=false;submit.textContent='Wyślij wiadomość →';show('','idle');}});
  try{
    const key='home-security-support-handoff',raw=sessionStorage.getItem(key);sessionStorage.removeItem(key);
    if(raw){const data=JSON.parse(raw);if(Date.now()-data.created<1800000&&typeof data.message==='string'){
      const topic=/konto|logowani/i.test(data.topic)?'Konto i dostęp':/mikrofon|kamera/i.test(data.topic)?'Kamera i dźwięk':/nagran|folder|drive/i.test(data.topic)?'Nagrania i Google Drive':'Pomoc techniczna';
      form.elements.namedItem('topic').value=topic;form.elements.namedItem('message').value=data.message.slice(0,3800);
      show('Opis z czatu został przeniesiony. Uzupełnij dane, sprawdź treść i kliknij „Wyślij wiadomość”.','idle');
    }}
  }catch{}
  // Prefill only the topic for product inquiries, never personal details.
  const chosenTopic=new URLSearchParams(location.search).get('temat');
  if(chosenTopic==='produkt' && !form.elements.namedItem('message').value)
    form.elements.namedItem('topic').value='Produkt i współpraca';
  submit.disabled=false;
}
