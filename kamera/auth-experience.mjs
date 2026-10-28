// Progressive improvements only: security and authentication stay in auth.js.
const dialog=document.getElementById('authDialog');
if(dialog){
  const card=dialog.querySelector('.authCard');
  let previousFocus=null;
  const passFields=[...dialog.querySelectorAll('input[type="password"]')];
  for(const input of passFields){
    const wrap=document.createElement('span');
    wrap.className='hsPassWrap';
    input.parentNode.insertBefore(wrap,input);
    wrap.append(input);
    const toggle=document.createElement('button');
    toggle.type='button';toggle.className='hsPassToggle';
    toggle.textContent='Pokaż';
    toggle.setAttribute('aria-label','Pokaż hasło');
    toggle.setAttribute('aria-pressed','false');
    toggle.addEventListener('click',()=>{
      const visible=input.type==='password';
      input.type=visible?'text':'password';
      toggle.textContent=visible?'Ukryj':'Pokaż';
      toggle.setAttribute('aria-label',visible?'Ukryj hasło':'Pokaż hasło');
      toggle.setAttribute('aria-pressed',String(visible));
      input.focus({preventScroll:true});
    });
    wrap.append(toggle);
  }
  const registration=dialog.querySelector('#registerForm');
  const password=registration?.elements.namedItem('password');
  const repeated=registration?.elements.namedItem('password_repeat');
  if(password&&repeated){
    const hint=document.createElement('p');
    hint.className='hsPasswordHint';hint.id='hsPasswordHint';hint.setAttribute('aria-live','polite');
    hint.textContent='Użyj co najmniej 10 znaków. Dłuższe, unikalne hasło jest bezpieczniejsze.';
    repeated.closest('label')?.parentNode.after(hint);
    const update=()=>{
      const value=password.value;
      if(!value){hint.textContent='Użyj co najmniej 10 znaków. Dłuższe, unikalne hasło jest bezpieczniejsze.';hint.dataset.state='idle';return;}
      const enough=value.length>=10;
      const varied=[/[a-z]/.test(value),/[A-Z]/.test(value),/[0-9]/.test(value),/[^a-zA-Z0-9]/.test(value)].filter(Boolean).length>=3;
      const matching=!repeated.value||repeated.value===value;
      hint.dataset.state=!enough||!matching?'error':varied?'good':'hint';
      hint.textContent=!enough?'Dodaj jeszcze '+(10-value.length)+' znaków do hasła.':!matching?'Hasła nie są identyczne.':varied?'Długość i różnorodność znaków: dobrze.':'Hasło ma odpowiednią długość. Dodaj różne rodzaje znaków.';
    };
    password.addEventListener('input',update);
    repeated.addEventListener('input',update);
    password.setAttribute('aria-describedby','hsPasswordHint');
    repeated.setAttribute('aria-describedby','hsPasswordHint');
  }
  let wasOpen=false;
  const sync=()=>{
    const opened=!dialog.hidden;
    const visibleStep=[...dialog.querySelectorAll('[data-auth-step]')].find(el=>!el.hidden&&el.querySelector('h1,h2'));
    const title=visibleStep?.querySelector('h1,h2');
    if(title){if(!title.id)title.id='hsAuthHeading-'+visibleStep.dataset.authStep;card.setAttribute('aria-labelledby',title.id);}
    if(opened&&!wasOpen){previousFocus=document.activeElement;requestAnimationFrame(()=>{if(!dialog.hidden){const target=visibleStep?.querySelector('input:not([type="hidden"])')||dialog.querySelector('#authClose');target?.focus({preventScroll:true});}});}
    if(!opened&&wasOpen&&previousFocus?.isConnected){previousFocus.focus?.({preventScroll:true});}
    wasOpen=opened;
  };
  new MutationObserver(sync).observe(dialog,{subtree:true,attributes:true,attributeFilter:['hidden']});
  sync();
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!dialog.hidden){event.preventDefault();dialog.querySelector('#authClose')?.click();}
  });
}
