// The public download follows the published manifest, never a preview artifact.
export function installerFor(manifest){
  if(!/^\d+\.\d+\.\d+$/.test(manifest?.version||''))throw Error('Nieprawidłowa wersja instalatora');
  return new URL(`./downloads/HOME-SECURITY-Desktop-Setup-${manifest.version}.exe`,import.meta.url).href;
}
export function mountInstallerDownloads(){
  const links=[...document.querySelectorAll('a[href*="downloads/HOME-SECURITY-Desktop-Setup-"]')];
  if(!links.length)return;
  const refresh=async()=>{
    const url=new URL('./desktop-update.json',import.meta.url);url.searchParams.set('check',String(Date.now()));
    const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Sprawdzenie instalatora nie powiodło się');
    const manifest=await response.json(),href=installerFor(manifest);
    links.forEach(a=>{a.href=href;a.title=`Pobierz HOME SECURITY ${manifest.version} dla Windows`;});
    return href;
  };
  links.forEach(a=>a.addEventListener('click',async event=>{
    event.preventDefault();
    let status=a.nextElementSibling;
    if(!status?.classList.contains('installerDownloadStatus')){
      status=document.createElement('small');status.className='installerDownloadStatus';status.setAttribute('role','status');a.after(status);
    }
    status.textContent='Sprawdzam najnowszy instalator…';
    try{const href=await refresh();status.textContent='Pobieranie najnowszej wersji…';window.location.assign(href);}
    catch{status.textContent='Nie udało się sprawdzić najnowszej wersji. Sprawdź połączenie i spróbuj ponownie.';}
  }));
  void refresh().catch(()=>{});
  window.addEventListener('focus',()=>void refresh().catch(()=>{}));
  window.setInterval(()=>{if(document.visibilityState==='visible')void refresh().catch(()=>{});},15*60*1000);
}
if(typeof document!=='undefined')mountInstallerDownloads();
