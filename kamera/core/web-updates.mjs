// Shared by Android, iOS and desktop browsers. Never owns a camera or recorder.
export function createWebUpdates({serviceWorker, build, onState, prepareReload=async()=>{}, abortReload=async()=>{}, reload, now=Date.now, autoApply=false, canAutoApply=()=>true}) {
  let registration=null, busy=false, available=false, disposed=false;
  let controlled=!!serviceWorker?.controller, lastCheck=-Infinity, autoQueued=false;
  const cleanups=[];
  const watched=new WeakSet();
  const emit=(status,message)=>{if(!disposed)onState({status,message,build});};
  // The web/PWA can refresh itself, unlike the native Windows installer.
  // Never interrupt a live camera, uncommitted form or unconfirmed file.
  function tryAutoApply() {
    if(!autoApply||disposed||!available||busy||autoQueued)return;
    if(!canAutoApply()){
      emit('waiting','Nowa wersja gotowa. Zostanie automatycznie wczytana po zakończeniu bieżącej pracy.');
      return;
    }
    autoQueued=true;
    Promise.resolve().then(()=>{
      autoQueued=false;
      if(!disposed&&available&&!busy&&canAutoApply())void apply();
    });
  }
  const ready=()=>{
    available=true;
    emit('available',autoApply?'Nowa wersja gotowa. Aktualizuję automatycznie, gdy będzie bezpiecznie.':'Nowa wersja jest gotowa. Kliknij, aby ją wczytać.');
    tryAutoApply();
  };
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
      else if(available){emit('available',autoApply?'Nowa wersja gotowa. Aktualizuję automatycznie.':'Nowa wersja jest gotowa. Kliknij, aby ją wczytać.');tryAutoApply();}
      else if(registration.installing)watch(registration.installing);
      else emit('current','Sprawdzono aktualizacje — nie wykryto nowego pakietu.');
    } catch {emit('error','Nie udało się sprawdzić aktualizacji. Sprawdź połączenie i spróbuj ponownie.');}
    finally {busy=false;tryAutoApply();}
  }
  async function apply() {
    if(!available||busy||disposed)return;
    if(!canAutoApply()){
      emit('waiting','Nowa wersja jest gotowa, ale trwa praca z kamerą lub edycja formularza. Zaktualizuj po jej zakończeniu.');
      return;
    }
    busy=true;emit('applying','Przygotowuję bezpieczne wczytanie nowej wersji…');
    try {await prepareReload();if(!disposed){available=false;reload();}}
    catch {available=true;await abortReload().catch(()=>{});emit('error','Aktualizacja wstrzymana: nie potwierdzono bezpiecznego zakończenia zapisu.');}
    finally {busy=false;}
  }
  if(serviceWorker)listen(serviceWorker,'controllerchange',()=>{
    if(!controlled){controlled=true;emit('current','Panel gotowy — aktualizacje są włączone.');return;}
    ready(); // Never reload a live transmitter merely because a worker activated.
  });
  return {check,apply,tryAutoApply,get available(){return available;},dispose(){disposed=true;cleanups.forEach(fn=>fn());}};
}
