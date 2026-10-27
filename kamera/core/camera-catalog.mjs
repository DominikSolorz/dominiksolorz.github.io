// Camera configuration and connection ownership. No DOM, recorder or primary camera.
const kinds=new Set(['system','whep','mjpeg']);
export function cameraConfig(input){
  if(!input||typeof input!=='object'||!kinds.has(input.kind))throw Error('Wybierz obsługiwany sposób połączenia.');
  const name=String(input.name||'').trim(),location=String(input.location||'').trim();
  if(!name||name.length>64||location.length>100||/[\x00-\x1f]/.test(name+location))throw Error('Podaj nazwę kamery do 64 znaków.');
  const result={id:input.id||crypto.randomUUID(),kind:input.kind,name,location};
  result.fit=input.fit||'contain';if(!['contain','cover'].includes(result.fit))throw Error('Wybierz dopasowanie obrazu.');
  if(!/^[a-f0-9-]{36}$/i.test(result.id))throw Error('Nieprawidłowy identyfikator kamery.');
  if(input.kind==='system'){
    if(typeof input.deviceId!=='string'||!input.deviceId||input.deviceId.length>512)throw Error('Wybierz urządzenie z listy.');
    result.deviceId=input.deviceId;
    result.quality=input.quality||'balanced';if(!['low','balanced','high'].includes(result.quality))throw Error('Wybierz jakość podglądu.');
  }else{
    let url;try{url=new URL(input.url);}catch{throw Error('Podaj pełny adres podglądu HTTPS.');}
    if(url.protocol!=='https:')throw Error('Ten podgląd sieciowy wymaga HTTPS. RTSP/ONVIF wymaga osobnego adaptera Windows.');
    if(url.username||url.password||[...url.searchParams.keys()].some(k=>/token|password|secret|authorization|api.?key|signature|credential/i.test(k)||/^(key|auth|sig|pwd|pass)$/i.test(k)))throw Error('Nie zapisuj hasła ani tokena w adresie kamery. To źródło wymaga bezpiecznego adaptera poświadczeń.');
    if(url.href.length>2048)throw Error('Adres kamery jest zbyt długi.');
    url.hash='';result.url=url.href;
  }
  return result;
}
const sourceKey=c=>c.kind==='system'?`system:${c.deviceId}`:`${c.kind}:${c.url}`;
export function createCameraCatalog({storage,ownerId,maxCameras=128,makeId=()=>crypto.randomUUID()}){
  if(!/^[a-f0-9-]{36}$/i.test(ownerId||''))throw Error('Zaloguj się na swoje konto przed konfiguracją kamer.');
  const key=`home-security-cameras:v1:${ownerId}`;
  let cameras=[];
  const saved=storage.getItem(key);
  if(saved){
    try{
      const envelope=JSON.parse(saved);
      if(envelope.v!==1||!Array.isArray(envelope.cameras)||envelope.cameras.length>maxCameras)throw Error();
      cameras=envelope.cameras.map(cameraConfig);
      if(new Set(cameras.map(c=>c.id)).size!==cameras.length||new Set(cameras.map(sourceKey)).size!==cameras.length)throw Error();
    }catch{throw Error('Zapis konfiguracji kamer jest nieprawidłowy. Zachowano go bez zmian.');}
  }
  let persisted=saved;
  const commit=next=>{
    if(storage.getItem(key)!==persisted)throw Error('Konfiguracja zmieniła się w innym oknie. Odśwież panel po bezpiecznym zakończeniu zapisu.');
    const json=JSON.stringify({v:1,cameras:next});storage.setItem(key,json);persisted=json;cameras=next;
  };
  const list=()=>structuredClone(cameras);
  return {
    list,
    add(input){
      if(cameras.length>=maxCameras)throw Error(`Osiągnięto limit ${maxCameras} skonfigurowanych źródeł.`);
      const camera=cameraConfig({...input,id:makeId()});
      if(cameras.some(c=>sourceKey(c)===sourceKey(camera)))throw Error('Ta kamera jest już dodana.');
      commit([...cameras,camera]);return structuredClone(camera);
    },
    update(id,patch){
      const previous=cameras.find(c=>c.id===id);if(!previous)throw Error('Nie znaleziono kamery.');
      const camera=cameraConfig({...previous,...patch,id});
      if(cameras.some(c=>c.id!==id&&sourceKey(c)===sourceKey(camera)))throw Error('To źródło jest już przypisane innej kamerze.');
      commit(cameras.map(c=>c.id===id?camera:c));return structuredClone(camera);
    },
    remove(id){if(!cameras.some(c=>c.id===id))return false;commit(cameras.filter(c=>c.id!==id));return true;}
  };
}

export function createCameraConnections({openers,onState=()=>{},maxActive=9}){
  const slots=new Map();let disposed=false;
  const release=resource=>{try{resource?.close();}catch{}};
  function stop(id){
    const slot=slots.get(id);if(!slot)return;
    slots.delete(id);slot.abort.abort();release(slot.resource);onState(id,{status:'stopped'});
  }
  return {
    async connect(camera,target){
      if(disposed)throw Error('Podgląd został zamknięty.');
      if(slots.has(camera.id))return;
      if(slots.size>=maxActive)throw Error(`Jednocześnie można uruchomić ${maxActive} dodatkowych podglądów. Zatrzymaj nieużywany podgląd.`);
      const opener=openers[camera.kind];if(!opener)throw Error('Brak adaptera dla tego źródła.');
      const slot={abort:new AbortController(),resource:null};slots.set(camera.id,slot);
      onState(camera.id,{status:'connecting'});
      try{
        const resource=await opener(camera,target,slot.abort.signal,state=>{
          if(slots.get(camera.id)!==slot||disposed)return;
          if(['error','offline'].includes(state.status)){slots.delete(camera.id);slot.abort.abort();release(slot.resource);}
          onState(camera.id,state);
        });
        if(disposed||slots.get(camera.id)!==slot){release(resource);return;}
        slot.resource=resource;
      }catch(error){
        if(slots.get(camera.id)!==slot)return;
        slots.delete(camera.id);slot.abort.abort();release(slot.resource);
        onState(camera.id,{status:'error',message:error?.name==='NotAllowedError'?'Nie udzielono dostępu do urządzenia.':'Nie udało się uzyskać obrazu. Sprawdź dostępność i zgodność źródła.'});
      }
    },
    stop,
    active:id=>slots.has(id),
    stopAll(){[...slots.keys()].forEach(stop);},
    dispose(){disposed=true;[...slots.keys()].forEach(stop);}
  };
}
export function cameraColumns(count){return count<=1?1:count<=4?2:3;}
