// Presentation only: the native updater owns discovery, verification and installation.
const version = value => typeof value === 'string' && /^\d+\.\d+\.\d+(?:\.\d+)?$/.test(value)
  ? value.split('.').map(Number) : null;
export function newerDesktopVersion(candidate, installed) {
  const a=version(candidate),b=version(installed);
  if(!a||!b)return false;
  for(let i=0;i<Math.max(a.length,b.length);i++){
    const difference=(a[i]||0)-(b[i]||0);
    if(difference)return difference>0;
  }
  return false;
}
export function desktopUpdatePresentation(state={}) {
  const pending=state.status==='staged' && state.hasUpdate!==false;
  const hasOffer=state.hasUpdate===true || newerDesktopVersion(state.version,state.installedVersion) || pending;
  const active=['available','checking','downloading','verifying','preparing','installing','staged','error'];
  const visible=hasOffer && active.includes(state.status);
  return {
    visible,
    enabled:visible && ['available','error','staged'].includes(state.status),
    label:state.status==='staged'?'↻ Zainstaluj teraz':state.status==='error'?'↻ Ponów aktualizację':state.status==='available'?`↻ Zaktualizuj do ${state.version}`:'↻ Trwa aktualizacja',
    progress:visible && state.status==='downloading',
  };
}
