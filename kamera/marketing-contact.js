// Local composition only. Never claims delivery or sends a visitor's data to a server.
const form=document.querySelector('#mktContactForm');
if(form){
  const result=document.querySelector('#mktContactResult');
  const preview=document.querySelector('#mktContactPreview');
  const output=document.querySelector('#mktPreparedMessage');
  const link=document.querySelector('#mktOpenEmail');
  form.addEventListener('submit',event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const value=name=>String(form.elements.namedItem(name).value||'').trim();
    if(value('message').length<10){result.textContent='Opisz sprawę w co najmniej 10 znakach.';return;}
    const subject='HOME SECURITY — '+value('topic');
    const body=['Temat: '+value('topic'),'Imię: '+(value('name')||'nie podano'),'Adres do odpowiedzi: '+value('email'),'','Opis sprawy:',value('message')].join('\r\n');
    output.value=subject+'\r\n\r\n'+body;
    link.href='mailto:goldservicepoland@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    preview.hidden=false;result.textContent='Wiadomość jest przygotowana, ale nie została wysłana. Otwórz ją w swojej poczcie lub skopiuj treść.';
  });
  form.addEventListener('input',()=>{preview.hidden=true;link.removeAttribute('href');output.value='';result.textContent='';});
  document.querySelector('#mktCopyMessage').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(output.value);result.textContent='Treść skopiowana. Wklej ją do wiadomości na goldservicepoland@gmail.com. Nie wysłano wiadomości automatycznie.';}
    catch{result.textContent='Nie udało się skopiować automatycznie. Zaznacz i skopiuj treść z pola poniżej.';output.focus();output.select();}
  });
}
