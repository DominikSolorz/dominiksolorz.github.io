// Shared by Android, iOS and desktop browsers. Never owns a camera or recorder.
export function createWebUpdates({serviceWorker, build, onState, prepareReload=async()=>{}, abortReload=async()=>{}, reload, now=Date.now}) {
  let registration=null, busy=false, available=false, disposed=false;
  let controlled=!!serviceWorker?.controller, lastCheck=-Infinity;
  const cleanups=[];
  const watched=new WeakSet();
  const emit=(status,message)=>{if(!disposed)onState({status,message,build});};
  const ready=()=>{available=true;emit('available','Nowa wersja jest gotowa. Kliknij, aby ją wczytać.');};
  function listen(target,name,handler){target.addEventListener(name,handler);cleanups.push(()=>target.removeEventListener(name,handler));}
  function watch(worker){
    if(!worker||watched.has(worker))return;
    watched.add(worker);
    const changed=()=>{
      if(worker.state==='installed'&&controlled)ready();
      else if(worker.state==='installing')emit('downloading','Pobieranie aktualizacji…');
    };
    listen(worker,'statechange',changed);changed();
  }
  async function check({background=false}={}) {
    if(disposed||busy)return;
    if(!serviceWorker){emit('unsupported','Aktualizacje PWA nie są dostępne w tej przeglądarce.');return;}
    if(background&&now()-lastCheck<60000)return;
    busy=true;lastCheck=now();emit('checking','Sprawdzam aktualizacje…');
    try {
      if(!registration){
        registration=await serviceWorker.register(`./sw.js?v=${build}`,{scope:'./',updateViaCache:'none'});
        if(disposed)return;
        listen(registration,'updatefound',()=>watch(registration.installing));
      }
      await registration.update();
      if(disposed)return;
      if(registration.waiting)ready();
      else if(available)emit('available','Nowa wersja jest gotowa. Kliknij, aby ją wczytać.');
      else if(registration.installing)watch(registration.installing);
      else emit('current','Sprawdzono aktualizacje — nie wykryto nowego pakietu.');
    } catch {emit('error','Nie udało się sprawdzić aktualizacji. Sprawdź połączenie i spróbuj ponownie.');}
    finally {busy=false;}
  }
  async function apply() {
    if(!available||busy||disposed)return;
    busy=true;emit('applying','Przygotowuję bezpieczne wczytanie nowej wersji…');
    try {await prepareReload();if(!disposed)reload();}
    catch {await abortReload().catch(()=>{});emit('error','Aktualizacja wstrzymana: nie potwierdzono bezpiecznego zakończenia zapisu.');}
    finally {busy=false;}
  }
  if(serviceWorker)listen(serviceWorker,'controllerchange',()=>{
    if(!controlled){controlled=true;emit('current','Panel gotowy — aktualizacje są włączone.');return;}
    ready(); // Never reload a live transmitter merely because a worker activated.
  });
  return {check,apply,get available(){return available;},dispose(){disposed=true;cleanups.forEach(fn=>fn());}};
}
