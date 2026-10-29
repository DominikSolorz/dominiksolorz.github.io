import {iconMarkup} from "./ui-icons.mjs?v=1";
import {systemStore} from './core/store.mjs';
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const clock=at=>new Date(at).toLocaleString('pl-PL');
export const validThumbnail=value=>typeof value==='string' && value.length<80000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value);
export function filterCameraEvents(items,{date='',motion=true,sound=true}={}) {
 return items.filter(e=>Number.isFinite(e.at) && (e.kind==='ruch'?motion:e.kind==='dzwiek'?sound:false) && (!date || localDate(e.at)===date));
}
function localDate(at){const d=new Date(at);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function diagnosticCards(snapshot,now=Date.now()) {
 const read=(id,maxAge=45000)=>{const c=snapshot.components[id];return !c?{status:'unknown'}:now-c.observedAt>maxAge&&!['error','auth_required','failed','degraded'].includes(c.status)?{...c,status:'stale'}:c;};
 const capture=read('capture'),recording=read('recording'),storage=read('storage',90000),cloud=read('cloudAccess',120000);
 const peers=Object.entries(snapshot.components).filter(([id])=>id.startsWith('webrtc:')).map(([,c])=>now-c.observedAt>45000?{...c,status:'stale'}:c);
 const rtc=peers.find(c=>c.status==='failed'||c.ice==='failed') || peers.find(c=>c.status==='connected') || peers[0] || {status:'unknown'};
 return [
  {name:'Kamera',state:capture.status,detail:capture.message||capture.camera||'Brak telemetrii kamery.'},
  {name:'Nagrywanie',state:recording.status,detail:recording.lastFile?`Ostatni plik: ${recording.lastFile}`:'Nie potwierdzono zamkniętego pliku.'},
  {name:'Folder lokalny',state:storage.status,detail:storage.message||storage.name||'Oczekiwanie na stan komputera.'},
  {name:'WebRTC',state:rtc.status,detail:rtc.route||'Brak potwierdzonej ścieżki połączenia.'},
  {name:'Google Drive',state:cloud.status,detail:cloud.message||'Brak aktualnej odpowiedzi usługi chmury.'},
  {name:'Agent Windows',state:read('agent',300000).status,detail:read('agent',300000).message||'Brak połączenia z agentem na tym urządzeniu.'}
 ];
}
const stateLabels={unknown:'Nieznany',stale:'Dane nieaktualne',track_live:'Ścieżka aktywna',recording:'Nagrywa',idle:'Zatrzymany',waiting:'Oczekiwanie',disabled:'Wyłączony',error:'Błąd',ready:'Dostęp potwierdzony',permission_required:'Wymaga zgody',unselected:'Nie wybrano',healthy:'Usługa odpowiedziała',auth_required:'Wymaga logowania',degraded:'Ostrzeżenie',connected:'Połączony',connecting:'Łączenie',new:'Oczekiwanie',failed:'Błąd połączenia',disconnected:'Rozłączony',closed:'Zamknięty'};
export function mountDiagnosticWorkspace(container,{store=systemStore}={}) {
 const cards=node('div',null,'componentCards'),toolbar=node('div',null,'workspaceToolbar');
 const label=node('label','Filtr dziennika '),filter=node('select');filter.setAttribute('aria-label','Komponent dziennika');
 for(const [value,text] of [['','Wszystkie komponenty'],['webrtc','WebRTC'],['capture','Kamera'],['storage','Zapis'],['cloudAccess','Google Drive'],['agent','Agent Windows']]){const o=node('option',text);o.value=value;filter.append(o);}label.append(filter);toolbar.append(label);
 const table=node('table',null,'workspaceTable'),head=node('thead'),row=node('tr');['Czas','Komponent','Poziom','Opis'].forEach(t=>row.append(node('th',t)));head.append(row);const body=node('tbody');table.append(head,body);
 const wrap=node('div',null,'workspaceTableWrap');wrap.append(table);container.append(cards,node('h2','Dziennik zdarzeń'),toolbar,wrap);
 let latest=store.snapshot();
 const render=()=>{
  cards.replaceChildren(...diagnosticCards(latest).map(c=>{const article=node('article',null,'componentCard');article.dataset.state=c.state;const icon=node('span',null,'componentIcon');icon.innerHTML=iconMarkup(({'Kamera':'camera','Nagrywanie':'recording','Folder lokalny':'storage','WebRTC':'network','Google Drive':'cloud','Agent Windows':'agent'})[c.name]);article.append(icon,node('h3',c.name),node('strong',stateLabels[c.state]||c.state),node('p',c.detail));return article;}));
  const events=latest.events.filter(e=>!filter.value||e.component===filter.value).slice().reverse();
  body.replaceChildren(...events.map(e=>{const r=node('tr');[clock(e.at),e.component||'System',e.level||'info',e.message||''].forEach(t=>r.append(node('td',t)));return r;}));
  if(!events.length){const r=node('tr'),td=node('td','Brak zarejestrowanych zdarzeń dla tego filtra.');td.colSpan=4;r.append(td);body.append(r);}
 };
 filter.addEventListener('change',render);const unsubscribe=store.subscribe(s=>{latest=s;render();});const timer=setInterval(render,15000);render();return()=>{unsubscribe();clearInterval(timer);};
}
export function mountEventWorkspace(container,{store=systemStore}={}) {
 const toolbar=node('div',null,'workspaceToolbar'),dateLabel=node('label','Dzień '),date=node('input');date.type='date';date.setAttribute('aria-label','Dzień zdarzeń');dateLabel.append(date);toolbar.append(dateLabel);
 const filters={};for(const [key,text] of [['motion','Ruch'],['sound','Dźwięk']]){const l=node('label',null,'workspaceCheck'),i=node('input');i.type='checkbox';i.checked=true;l.append(i,node('span',text));filters[key]=i;toolbar.append(l);}
 const clear=node('button','Wszystkie dni','btn ghost');clear.type='button';toolbar.append(clear);
 const layout=node('div',null,'eventWorkspace'),list=node('div',null,'eventWorkspaceList'),detail=node('section',null,'eventWorkspaceDetail');detail.setAttribute('aria-label','Szczegóły zdarzenia');layout.append(list,detail);container.append(toolbar,layout);
 let items=[],selected=null;const read=new Set();
 const key=e=>`${e.at}:${e.kind}`;
 function show(e){selected=e;detail.replaceChildren(node('h3','Szczegóły zdarzenia'));
  if(!e){detail.append(node('p','Wybierz zdarzenie z listy.'));return;}
  if(validThumbnail(e.thumbnail)){const image=node('img');image.src=e.thumbnail;image.alt='Klatka kamery w chwili wykrycia zdarzenia';detail.append(image);}else detail.append(node('p','Brak zapisanej klatki tego zdarzenia.','eventNoFrame'));
  detail.append(node('p',clock(e.at)),node('h3',e.kind==='ruch'?'Wykryty ruch':'Wykryty dźwięk'));
  const ack=node('button',read.has(key(e))?'Przeczytane w tej sesji':'Oznacz jako przeczytane','btn primary');ack.disabled=read.has(key(e));ack.type='button';ack.addEventListener('click',()=>{read.add(key(e));show(e);render();});detail.append(ack,node('p','Oznaczenie dotyczy tej sesji panelu. Nie usuwa zdarzenia ani nagrania.','muted small'));
 }
 function render(){const filtered=filterCameraEvents(items,{date:date.value,motion:filters.motion.checked,sound:filters.sound.checked});list.replaceChildren();
  if(!filtered.length)list.append(node('p','Brak zdarzeń spełniających wybrane filtry.','workspaceEmpty'));
  for(const e of filtered){const button=node('button',null,'eventWorkspaceRow');button.type='button';button.classList.toggle('selected',selected&&key(selected)===key(e));button.setAttribute('aria-pressed',String(Boolean(selected&&key(selected)===key(e))));
   if(validThumbnail(e.thumbnail)){const image=node('img');image.src=e.thumbnail;image.alt='';button.append(image);}else button.append(node('span',e.kind==='ruch'?'◉':'◖','eventKindIcon'));
   const text=node('span');text.append(node('strong',e.kind==='ruch'?'Ruch w obrazie':'Dźwięk'),node('small',clock(e.at)));button.append(text,node('span',read.has(key(e))?'Przeczytane':'Nowe'));button.addEventListener('click',()=>{show(e);render();});list.append(button);
  }
  if(selected&&!filtered.some(e=>key(e)===key(selected)))show(null);
 }
 [date,filters.motion,filters.sound].forEach(i=>i.addEventListener('change',render));clear.addEventListener('click',()=>{date.value='';render();});
 const update=s=>{items=s.components.cameraEvents?.items||[];render();};const unsub=store.subscribe(update);show(null);update(store.snapshot());return unsub;
}
export function captureEventFrame(video) {
 if(!video || video.readyState<2 || !video.videoWidth)return null;
 try{const canvas=document.createElement('canvas');const scale=Math.min(320/video.videoWidth,180/video.videoHeight);canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));const context=canvas.getContext('2d');if(!context)return null;context.drawImage(video,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.55);return validThumbnail(data)?data:null;}catch{return null;}
}
export function mirrorLivePreview(source,target,placeholder){
 const sync=()=>{if(!source||!target)return;const stream=source.srcObject;if(target.srcObject!==stream)target.srcObject=stream;const available=!!stream&&source.readyState>=2;target.hidden=!available;if(placeholder)placeholder.hidden=available;if(available&&target.paused)target.play().catch(()=>{});};
 source?.addEventListener('loadedmetadata',sync);source?.addEventListener('emptied',sync);const timer=setInterval(sync,1500);sync();return()=>{clearInterval(timer);source?.removeEventListener('loadedmetadata',sync);source?.removeEventListener('emptied',sync);target.srcObject=null;};
}
