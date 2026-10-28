// No tracking, login calls or device access. This checklist operates in this page only.
const checklist=document.querySelector('#publicHome.mktSite #przygotowanie');
if(checklist){
  const inputs=[...checklist.querySelectorAll('input[data-mkt-setup]')];
  const count=checklist.querySelector('#mktSetupCount');
  const progress=checklist.querySelector('.mktSetupProgress');
  const bar=progress?.querySelector('span');
  const summary=checklist.querySelector('#mktSetupResult');
  if(inputs.length===4 && count && progress && bar && summary){
    const refresh=()=>{
      const checked=inputs.filter(input=>input.checked).length;
      count.textContent=checked+' / '+inputs.length;
      progress.setAttribute('aria-valuenow',String(checked));
      bar.style.transform='scaleX('+(checked/inputs.length)+')';
      summary.textContent=checked===4
        ? 'Lista ukończona. To potwierdzenie Twoich wyborów, nie automatyczny test kamery. Teraz możesz skorzystać z instrukcji i sprawdzić rzeczywisty obraz oraz zapis.'
        : checked===0
          ? 'Zaznacz przygotowane elementy. To lokalna lista kontrolna, bez zapisywania Twoich odpowiedzi.'
          : 'Sprawdzono '+checked+' z '+inputs.length+' punktów. Upewnij się, że pozostałe wymagania też są spełnione.';
    };
    inputs.forEach(input=>input.addEventListener('change',refresh));
    refresh();
  }
}
