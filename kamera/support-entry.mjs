// Only the public questions page includes this entry. The conversation UI loads on click.
const home=document.querySelector('#publicHome');
if(home && !home.querySelector('.hsSupportLauncher')){
  const button=document.createElement('button');
  button.type='button';button.className='hsSupportLauncher';button.textContent='◌ Pomoc';
  button.setAttribute('aria-label','Otwórz czat pomocy HOME SECURITY');button.setAttribute('aria-expanded','false');
  button.setAttribute('aria-controls','hsSupportDialog');home.append(button);
  let open;
  // All public AI CTAs open the same lazy-loaded assistant; no fake chat window.
  home.querySelectorAll('[data-hs-open-support]').forEach(link=>{
    link.addEventListener('click',()=>button.click());
  });
  button.addEventListener('click',async()=>{
    if(button.disabled)return;button.disabled=true;
    try{if(!open){const module=await import('./support-view.mjs?v=2');open=module.mountSupport(home,button);}open();}
    catch{window.location.assign(new URL('./pomoc.html',import.meta.url));}
    finally{button.disabled=false;}
  });
}
