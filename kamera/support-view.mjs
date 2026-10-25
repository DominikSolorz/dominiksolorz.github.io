const TOPICS=['Konto i logowanie','Kamera i mikrofon','Nagrania i odtwarzanie','Folder zapisu i Google Drive','Instalacja i aktualizacje','Inna sprawa'];
const ENDPOINT='https://ksacbcrzuwdahnmggfxg.supabase.co/functions/v1/home-support';
export function mountSupport(home,launcher){
  const dialog=document.createElement('dialog');dialog.id='hsSupportDialog';dialog.className='hsSupportDialog';dialog.setAttribute('aria-label','Pomoc HOME SECURITY');
  dialog.innerHTML=`<header class="hsSupportHeader"><div><strong>Wsparcie HOME SECURITY</strong><small>Asystent AI · pomoc w konfiguracji</small></div><button type="button" class="hsSupportClose" aria-label="Zamknij czat">×</button></header><div class="hsSupportBody"><p class="hsSupportIntro">W czym możemy pomóc?</p><label class="hsSupportLabel">Wybierz temat<select id="hsSupportTopic"></select></label><div class="hsSupportMessages" role="log" aria-live="polite" aria-label="Historia rozmowy"></div><p class="hsSupportNotice">Asystent nie ma dostępu do Twojej kamery ani konta. Może się mylić. Nie podawaj haseł, PIN-u ani kodów dostępu.</p><label class="hsSupportConsent"><input type="checkbox"> Zgadzam się na przesłanie treści tej rozmowy do you.bot w celu uzyskania odpowiedzi AI. <a href="https://you.bot/privacy" target="_blank" rel="noopener noreferrer">Prywatność dostawcy ↗</a></label><form class="hsSupportForm"><label class="hsSupportLabel">Twoje pytanie<textarea rows="3" maxlength="2000" required placeholder="Opisz problem i urządzenie…"></textarea></label><button type="submit">Wyślij pytanie</button></form><p class="hsSupportStatus" role="status"></p></div><footer class="hsSupportFooter"><button type="button" class="hsSupportHandoff">Przekaż do administratora →</button><p class="hsSupportFine">Otwiera formularz kontaktowy. Przekazanie opisu wymaga jego wysłania.</p></footer>`;
  home.append(dialog);
  const select=dialog.querySelector('select'),messages=dialog.querySelector('[role="log"]'),form=dialog.querySelector('form'),field=dialog.querySelector('textarea'),consent=dialog.querySelector('input'),status=dialog.querySelector('[role="status"]'),submit=form.querySelector('button');
  for(const topic of TOPICS){const option=document.createElement('option');option.textContent=topic;select.append(option);}
  let history=[],busy=false;
  function message(text,role){const element=document.createElement('p');element.className='hsSupportMessage '+role;element.textContent=text;messages.append(element);element.scrollIntoView({block:'nearest'});}
  function welcome(){messages.replaceChildren();message('Wybierz temat i opisz, co się dzieje. Pomogę Ci sprawdzić bezpieczne kroki. Jeśli sprawa wymaga administratora, przejdziemy do formularza.','assistant');}
  welcome();
  select.addEventListener('change',()=>{history=[];field.value='';status.textContent='';welcome();});
  dialog.querySelector('.hsSupportClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{launcher.setAttribute('aria-expanded','false');launcher.focus();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!form.reportValidity())return;
    if(!consent.checked){status.textContent='Przed wysłaniem pytania zaakceptuj przekazanie jego treści do dostawcy AI lub przejdź bezpośrednio do formularza kontaktowego.';return;}
    const text=field.value.trim();if(!text)return;
    if(/sk-(?:live|proj)-[A-Za-z0-9_-]{12,}/.test(text)){status.textContent='Usuń klucz API z wiadomości. Nie wysyłaj sekretów do czatu.';return;}
    busy=true;submit.disabled=true;select.disabled=true;status.textContent='Asystent przygotowuje odpowiedź…';
    const pending=[...history.slice(-10),{role:'user',content:text}];
    while(pending.reduce((n,m)=>n+m.content.length,0)>12000 && pending.length>1)pending.splice(0,2);
    message(text,'user');field.value='';
    try{
      const response=await fetch(ENDPOINT,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:select.value,messages:pending,consent:true}),signal:AbortSignal.timeout(35000)});
      if(!response.ok)throw new Error(response.status===429?'limit':'unavailable');
      const data=await response.json();if(typeof data.reply!=='string'||!data.reply.trim())throw new Error('unavailable');
      message(data.reply,'assistant');history=[...pending,{role:'assistant',content:data.reply.slice(0,2000)}];
      status.textContent=data.escalation?'Ta sprawa wymaga administratora. Użyj przycisku poniżej.':'';
    }catch(error){message('Nie udało się uzyskać odpowiedzi AI. Możesz ponowić pytanie lub przekazać sprawę do administratora.','assistant');field.value=text;status.textContent=error.message==='limit'?'Osiągnięto limit pytań. Spróbuj później lub skorzystaj z formularza.':'Asystent jest chwilowo niedostępny. Wiadomość nie została przekazana administratorowi.';}
    finally{busy=false;submit.disabled=false;select.disabled=false;}
  });
  dialog.querySelector('.hsSupportHandoff').addEventListener('click',()=>{
    const summary=['Temat rozmowy: '+select.value,'','Opis do sprawdzenia przed wysłaniem:',...history.map(m=>(m.role==='user'?'Użytkownik: ':'Asystent AI: ')+m.content),field.value.trim()?'Dodatkowy opis: '+field.value.trim():''].join('\n').slice(0,3800);
    try{sessionStorage.setItem('home-security-support-handoff',JSON.stringify({topic:select.value,message:summary,created:Date.now()}));}catch{}
    window.location.assign(new URL('./pomoc.html',import.meta.url));
  });
  return ()=>{if(!dialog.open){dialog.showModal();launcher.setAttribute('aria-expanded','true');select.focus();}};
}
