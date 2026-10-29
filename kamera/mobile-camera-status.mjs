// Describes the received preview, never recording success or device network access.
export function mobileCameraStatus({connected,playing,width,height,fit}){
  const dimensions=width>0&&height>0?`${width} × ${height}`:'Rozdzielczość oczekuje na obraz';
  if(!connected)return {state:'offline',title:'Brak połączenia z kamerą',detail:'Komputer nadający musi być włączony. Podgląd wznowi się po odzyskaniu połączenia.',dimensions};
  if(!playing)return {state:'waiting',title:'Połączono · czekam na obraz',detail:'Komputer odpowiada. Oczekuję na klatki z kamery.',dimensions};
  return {state:'live',title:'Obraz na żywo',detail:fit==='cover'?'Wypełnienie okna przycina brzegi. Wybierz „Cały kadr”, aby je zobaczyć.':'Widzisz cały odbierany kadr. Stan zapisu sprawdzisz w Nagraniach.',dimensions};
}
export function mountMobileCameraInfo({stage,video,statusNode}){
  const info=document.createElement('section');info.id='mobileCameraInfo';info.className='mobileCameraInfo';info.setAttribute('aria-label','Informacje o podglądzie kamery');
  info.innerHTML='<div class="mobileCameraHeading"><h2>Kamera główna</h2><span>Komputer nadający</span></div><p class="mobileCameraState" role="status" aria-live="polite"></p><p class="mobileCameraDetail"></p><p class="mobileCameraDimensions"></p>';
  stage.before(info);const state=info.querySelector('.mobileCameraState'),detail=info.querySelector('.mobileCameraDetail'),dimensions=info.querySelector('.mobileCameraDimensions');
  const update=()=>{const next=mobileCameraStatus({connected:statusNode?.classList.contains('live'),playing:video.readyState>=2&&!video.paused&&!video.ended,width:video.videoWidth,height:video.videoHeight,fit:stage.classList.contains('fit-cover')?'cover':'contain'});
    info.dataset.state=next.state;for(const [node,text] of [[state,next.title],[detail,next.detail],[dimensions,next.dimensions]])if(node.textContent!==text)node.textContent=text;};
  const observer=new MutationObserver(update);if(statusNode)observer.observe(statusNode,{attributes:true,attributeFilter:['class'],childList:true,subtree:true,characterData:true});observer.observe(stage,{attributes:true,attributeFilter:['class']});
  const events=['loadedmetadata','playing','waiting','emptied','pause','ended','resize'];events.forEach(name=>video.addEventListener(name,update));update();
  return {element:info,dispose(){observer.disconnect();events.forEach(name=>video.removeEventListener(name,update));info.remove();}};
}
