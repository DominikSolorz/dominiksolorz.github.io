import {createCameraCatalog,createCameraConnections,cameraColumns} from './core/camera-catalog.mjs?v=2';
import {cameraSourceAdapters} from './core/camera-sources.mjs?v=2';

export function mountCameraWorkspace({root,primaryTile,primaryVideo,ownerId,storage=localStorage,native=false,mediaDevices=navigator.mediaDevices,onState=()=>{}}){
  const catalog=createCameraCatalog({storage,ownerId});
  let page=0,editing=null,disposed=false;const pageSize=9,tiles=new Map(),states=new Map();
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  root.classList.add('cameraWorkspace');
  const tools=el('header','cameraWorkspaceToolbar');
  const heading=el('div');heading.append(el('span','cameraEyebrow','STANOWISKO OPERATORA'),el('h2',null,'Twoje kamery'));
  const counter=el('span','cameraCounter');heading.append(counter);
  const actions=el('div','cameraWorkspaceActions');
  const layout=document.createElement('select');layout.setAttribute('aria-label','Układ podglądów');
  for(const [value,text] of [['auto','Układ automatyczny'],['1','Jedna kolumna'],['2','Dwie kolumny'],['3','Trzy kolumny']]){const o=el('option',null,text);o.value=value;layout.append(o);}
  const add=el('button','cameraPrimaryAction','＋ Dodaj kamerę');add.type='button';
  actions.append(layout,add);tools.append(heading,actions);
  const grid=el('div','cameraWorkspaceGrid');grid.setAttribute('aria-label','Podglądy kamer');
  const foot=el('footer','cameraWorkspaceFooter');
  const pagination=el('div','cameraPagination');const previous=el('button',null,'← Poprzednie'),next=el('button',null,'Następne →'),pageLabel=el('span');
  previous.type=next.type='button';pagination.append(previous,pageLabel,next);
  const scope=el('p','cameraRecordingScope','Zapis i archiwum dotyczą obecnie kamery głównej. Dodatkowe źródła w tym widoku służą do podglądu.');
  foot.append(scope,el('p','cameraRecordingScope','Konfiguracja: do 128 dodatkowych źródeł. Siatka: 9 kamer na stronę. Jednocześnie: do 9 dodatkowych podglądów.'),pagination);root.replaceChildren(tools,grid,foot);

  const dialog=el('dialog','cameraSetupDialog');dialog.setAttribute('aria-label','Konfiguracja kamery');
  dialog.innerHTML=`<form class="cameraSetupForm"><header><div><span class="cameraEyebrow">URZĄDZENIA</span><h2 id="cameraSetupTitle">Dodaj kamerę</h2></div><button type="button" data-close aria-label="Zamknij konfigurację kamery">×</button></header>
    <p>Każda kamera ma własną nazwę, połączenie i osobny podgląd.</p>
    <label>Nazwa kamery<input name="name" maxlength="64" required placeholder="np. Wejście, ogród, garaż" autocomplete="off"></label>
    <label>Lokalizacja <span>(opcjonalnie)</span><input name="location" maxlength="100" placeholder="np. Parter · wejście główne" autocomplete="off"></label>
    <label>Sposób udostępniania obrazu<select name="kind"><option value="system">Kamera dostępna w Windows · USB / sterownik urządzenia</option><option value="whep">Kamera sieciowa · WebRTC / WHEP przez HTTPS</option><option value="mjpeg">Kamera sieciowa · JPEG / MJPEG przez HTTPS</option></select></label>
    <div data-system><label>Urządzenie<select name="deviceId" aria-label="Urządzenie kamery"></select></label><button type="button" data-detect>Wykryj podłączone urządzenia</button><label>Preferowana jakość podglądu<select name="quality"><option value="low">Oszczędna · do 640 × 360 / 10 kl./s</option><option value="balanced" selected>Zrównoważona · do 1280 × 720 / 15 kl./s</option><option value="high">Szczegółowa · do 1920 × 1080 / 25 kl./s</option></select></label><p class="cameraSetupHelp">Połączenie kablowe lub bezprzewodowe może być użyte, jeśli urządzenie udostępnia kamerę systemowi Windows. Osiągnięta jakość zależy od urządzenia. Nie otwieramy mikrofonu dodatkowej kamery.</p></div>
    <div data-network hidden><label>Adres podglądu HTTPS<input name="url" type="url" placeholder="https://adres-kamery/…" autocomplete="off" spellcheck="false"></label><p class="cameraSetupHelp">Wybierz format faktycznie udostępniany przez kamerę lub bramę wideo. Ten moduł nie obsługuje jeszcze bezpośredniego RTSP/ONVIF. Nie wpisuj hasła ani tokena w adresie.</p></div>
    <label>Wyświetlanie kadru<select name="fit"><option value="contain">Cały kadr · bez przycinania</option><option value="cover">Wypełnij okno · przytnij brzegi</option></select></label><p class="cameraSetupResult" role="status" aria-live="polite"></p><footer><button type="button" data-close>Anuluj</button><button class="cameraPrimaryAction" type="submit">Zapisz i sprawdź obraz</button></footer></form>`;
  document.body.append(dialog);const form=dialog.querySelector('form'),result=dialog.querySelector('[role=status]');
  const controls=form.elements;
  const removal=el('dialog','cameraSetupDialog cameraRemovalDialog');removal.setAttribute('aria-label','Usuń kamerę z konfiguracji');
  const removeTitle=el('h2',null,'Usunąć kamerę?'),removeText=el('p'),removeActions=el('footer'),cancelRemove=el('button',null,'Zachowaj kamerę'),confirmRemove=el('button','cameraDangerAction','Usuń kamerę');
  cancelRemove.type=confirmRemove.type='button';removeActions.append(cancelRemove,confirmRemove);removal.append(removeTitle,removeText,removeActions);document.body.append(removal);let removeId=null;
  cancelRemove.onclick=()=>removal.close();
  confirmRemove.onclick=()=>{
    try{if(catalog.remove(removeId)){connections.stop(removeId);tiles.get(removeId)?.node.remove();tiles.delete(removeId);states.delete(removeId);}removal.close();render();}
    catch{removeText.textContent='Nie udało się zapisać zmiany konfiguracji. Kamera pozostaje na liście.';}
  };
  const connections=createCameraConnections({openers:cameraSourceAdapters({native,primaryVideo,mediaDevices}),onState:(id,state)=>{
    states.set(id,state);onState(id,{...state,recording:false});refreshTile(id);syncPrimaryOptions();
  }});
  function syncPrimaryOptions(){
    const select=document.getElementById('cameraSelect');if(!select)return;
    const owned=new Set(catalog.list().filter(c=>c.kind==='system'&&connections.active(c.id)).map(c=>c.deviceId));
    for(const option of select.options){
      if(owned.has(option.value)&&!option.disabled){option.dataset.extraCameraOwned='true';option.disabled=true;}
      else if(!owned.has(option.value)&&option.dataset.extraCameraOwned){delete option.dataset.extraCameraOwned;option.disabled=false;}
    }
  }
  const deviceOptionsObserver=new MutationObserver(syncPrimaryOptions);
  if(document.getElementById('cameraSelect'))deviceOptionsObserver.observe(document.getElementById('cameraSelect'),{childList:true,subtree:true});
  function refreshTile(id){
    const tile=tiles.get(id);if(!tile)return;const state=states.get(id)||{status:'stopped'};
    tile.node.dataset.state=state.status;
    tile.status.textContent=state.message||({connecting:'Łączenie…',preview:'Obraz dostępny',stopped:'Podgląd zatrzymany',error:'Nie udało się połączyć',offline:'Źródło niedostępne'})[state.status]||'Brak danych';
    tile.connect.textContent=state.status==='connecting'?'Anuluj łączenie':connections.active(id)?'Zatrzymaj podgląd':state.status==='error'?'Ponów połączenie':'Uruchom podgląd';
    tile.placeholder.hidden=['preview','degraded'].includes(state.status);
    tile.connect.disabled=false;
  }
  function makeTile(camera){
    const node=el('article','cameraSourceTile');node.dataset.cameraId=camera.id;
    const header=el('header'),title=el('div'),name=el('strong',null,camera.name),location=el('small',null,camera.location||'Dodatkowe źródło');title.append(name,location);
    const settings=el('button','cameraTileSettings','⋯');settings.type='button';settings.setAttribute('aria-label',`Ustawienia kamery ${camera.name}`);header.append(title,settings);
    const viewport=el('div','cameraSourceViewport'),media=el('div','cameraSourceMedia'),placeholder=el('div','cameraSourcePlaceholder'),icon=el('span');icon.innerHTML='<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>';placeholder.append(icon,el('strong',null,'Podgląd kamery'),el('small',null,'Uruchom połączenie, aby sprawdzić obraz'));viewport.append(media,placeholder);
    const footer=el('footer'),status=el('span','cameraSourceStatus'),connect=el('button',null,'Uruchom podgląd'),full=el('button',null,'Powiększ'),remove=el('button','cameraRemoveAction','Usuń');connect.type=full.type=remove.type='button';full.setAttribute('aria-label',`Pełny ekran: ${camera.name}`);footer.append(status,connect,full,remove);
    node.append(header,viewport,footer);
    connect.onclick=async()=>{
      if(connections.active(camera.id)){connections.stop(camera.id);return;}
      try{await connections.connect(catalog.list().find(c=>c.id===camera.id),media);}catch(error){states.set(camera.id,{status:'error',message:error.message});refreshTile(camera.id);}
    };
    full.onclick=()=>{void node.requestFullscreen?.().catch(()=>{});};settings.onclick=()=>openSetup(camera.id);
    remove.onclick=()=>{removeId=camera.id;removeText.textContent=`Usunięta zostanie kamera „${catalog.list().find(c=>c.id===camera.id)?.name||camera.name}” z tej konfiguracji. Jej dodatkowy podgląd zostanie zatrzymany. Nagrania i kamera główna pozostają zachowane.`;removal.showModal();};
    return{node,name,location,status,connect,placeholder,media,settings,full};
  }
  function render(){
    if(disposed)return;const cameras=catalog.list();
    for(const camera of cameras){if(!tiles.has(camera.id))tiles.set(camera.id,makeTile(camera));const tile=tiles.get(camera.id);tile.name.textContent=camera.name;tile.location.textContent=camera.location||'Dodatkowe źródło';tile.node.style.setProperty('--camera-fit',camera.fit);tile.settings.setAttribute('aria-label',`Ustawienia kamery ${camera.name}`);tile.full.setAttribute('aria-label',`Pełny ekran: ${camera.name}`);refreshTile(camera.id);}
    const all=[{id:'primary',node:primaryTile},...cameras.map(c=>({id:c.id,node:tiles.get(c.id).node}))];
    const pages=Math.max(1,Math.ceil(all.length/pageSize));page=Math.max(0,Math.min(page,pages-1));
    // Retain every video node; navigation and page changes do not destroy streams.
    for(const item of all){if(item.node.parentElement!==grid)grid.append(item.node);item.node.hidden=!all.slice(page*pageSize,(page+1)*pageSize).includes(item);}
    const visible=Math.min(pageSize,all.length-page*pageSize);
    grid.style.setProperty('--camera-columns',layout.value==='auto'?cameraColumns(visible):layout.value);
    root.dataset.count=String(all.length);counter.textContent=`${all.length} ${all.length===1?'kamera':'kamer'} · ${cameras.length} dodatkowych`;
    pageLabel.textContent=`Strona ${page+1} z ${pages}`;previous.disabled=page===0;next.disabled=page===pages-1;pagination.hidden=pages===1;
  }
  function syncKind(){const system=controls.kind.value==='system';dialog.querySelector('[data-system]').hidden=!system;dialog.querySelector('[data-network]').hidden=system;controls.deviceId.required=system;controls.url.required=!system;}
  async function detect(){
    result.textContent='Sprawdzam urządzenia Windows…';
    if(!native){result.textContent='Kamery systemowe konfiguruj w programie HOME SECURITY na komputerze. W przeglądarce możesz dodać obsługiwane źródło sieciowe.';return;}
    try{
      const devices=(await mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
      const primaryId=primaryVideo?.srcObject?.getVideoTracks?.()[0]?.getSettings?.().deviceId||document.getElementById('cameraSelect')?.value||devices[0]?.deviceId;
      const used=new Set(catalog.list().filter(c=>c.id!==editing&&c.kind==='system').map(c=>c.deviceId));
      controls.deviceId.replaceChildren();
      for(const d of devices){if(!d.deviceId||d.deviceId===primaryId||used.has(d.deviceId))continue;const option=el('option',null,d.label||'Kamera systemowa');option.value=d.deviceId;controls.deviceId.append(option);}
      result.textContent=controls.deviceId.options.length?'Wybierz osobną kamerę. Źródło kamery głównej nie jest powielane.':'Brak dodatkowego dostępnego źródła. Podłącz urządzenie lub sprawdź jego sterownik i uprawnienia.';
    }catch{result.textContent='Nie udało się odczytać urządzeń. Sprawdź uprawnienia systemu Windows.';}
  }
  async function openSetup(id=null){
    editing=id;form.reset();result.textContent='';dialog.querySelector('#cameraSetupTitle').textContent=id?'Ustawienia kamery':'Dodaj kamerę';
    const camera=catalog.list().find(c=>c.id===id);
    if(camera){controls.name.value=camera.name;controls.location.value=camera.location;controls.kind.value=camera.kind;controls.url.value=camera.url||'';controls.quality.value=camera.quality||'balanced';controls.fit.value=camera.fit;}
    else if(!native)controls.kind.value='whep';
    controls.kind.querySelector('[value=system]').disabled=!native;syncKind();dialog.showModal();controls.name.focus({preventScroll:true});
    if(controls.kind.value==='system'){await detect();if(camera?.deviceId)controls.deviceId.value=camera.deviceId;}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();result.textContent='';
    try{
      const input={name:controls.name.value,location:controls.location.value,kind:controls.kind.value,deviceId:controls.deviceId.value,url:controls.url.value,quality:controls.quality.value,fit:controls.fit.value};
      const camera=editing?catalog.update(editing,input):catalog.add(input);
      if(editing)connections.stop(editing);page=Math.floor((catalog.list().findIndex(c=>c.id===camera.id)+1)/pageSize);dialog.close();render();
      try{await connections.connect(camera,tiles.get(camera.id).media);}catch(error){states.set(camera.id,{status:'error',message:error.message});refreshTile(camera.id);}
    }catch(error){result.textContent=error.message||'Nie udało się zapisać konfiguracji.';}
  });
  dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());dialog.querySelector('[data-detect]').onclick=detect;controls.kind.onchange=()=>{syncKind();if(controls.kind.value==='system')void detect();};
  add.onclick=()=>void openSetup();layout.onchange=render;previous.onclick=()=>{page--;render();};next.onclick=()=>{page++;render();};
  render();return{catalog,connections,openSetup,render,dispose(){disposed=true;connections.dispose();deviceOptionsObserver.disconnect();dialog.remove();removal.remove();}};
}
