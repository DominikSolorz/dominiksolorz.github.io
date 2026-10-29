// Uses native browser PiP only. Never creates a fake floating DOM window,
// captures media, unmutes sound or changes recorder/stream lifecycles.
export function createPictureInPicture(video,{doc=document,mediaSession=globalThis.navigator?.mediaSession,onState=()=>{},onError=()=>{}}={}){
  let automatic=false,registered=false,disposed=false,busy=false;
  const ready=()=>video.readyState>=2&&video.videoWidth>0;
  const safari=()=>typeof video.webkitSetPresentationMode==='function'&&typeof video.webkitSupportsPresentationMode==='function'&&video.webkitSupportsPresentationMode('picture-in-picture');
  const supported=()=>{
    if(typeof video.webkitSupportsPresentationMode==='function'&&!video.webkitSupportsPresentationMode('picture-in-picture'))return false;
    if(video.disablePictureInPicture)return false;
    return (typeof video.requestPictureInPicture==='function'&&doc.pictureInPictureEnabled!==false)||safari();
  };
  const active=()=>doc.pictureInPictureElement===video||video.webkitPresentationMode==='picture-in-picture';
  const state=()=>({ready:ready(),supported:supported(),active:active(),automatic,autoHandler:registered,busy});
  const emit=()=>{if(!disposed)onState(state());};
  function explain(error){
    if(error?.name==='NotAllowedError')return 'System wymaga dotknięcia przycisku Mini-okno lub zgody przeglądarki. Włącz je przed schowaniem strony.';
    if(error?.name==='NotSupportedError')return 'System nie obsługuje mini-okna dla tego źródła obrazu. Spróbuj w Safari lub Chrome poza aplikacją dodaną do ekranu głównego.';
    if(error?.name==='SecurityError')return 'Przeglądarka blokuje mini-okno dla tej strony.';
    return error?.message||'Nie udało się otworzyć mini-okna.';
  }
  async function enter(){
    if(disposed||busy||active())return;
    if(!ready())throw Error('Poczekaj na obraz z kamery. Mini-okno wymaga odebranych klatek.');
    if(!supported())throw Object.assign(Error('Mini-okno nie jest dostępne dla tego źródła w tej przeglądarce.'),{name:'NotSupportedError'});
    busy=true;emit();
    try{
      // Request synchronously from the click/action. Awaiting play() first can lose activation.
      if(typeof video.requestPictureInPicture==='function'&&doc.pictureInPictureEnabled!==false){
        try{await video.requestPictureInPicture();}
        catch(error){if(error.name!=='NotSupportedError'||!safari())throw error;video.webkitSetPresentationMode('picture-in-picture');}
      }else video.webkitSetPresentationMode('picture-in-picture');
    }finally{busy=false;emit();}
  }
  async function toggle(){
    if(disposed||busy)return;
    try{
      if(doc.pictureInPictureElement===video){await doc.exitPictureInPicture();emit();return;}
      if(video.webkitPresentationMode==='picture-in-picture'){video.webkitSetPresentationMode('inline');emit();return;}
      await enter();
    }catch(error){onError(explain(error));}
  }
  function setAutomatic(enabled){
    automatic=!!enabled;
    if('autoPictureInPicture' in video)video.autoPictureInPicture=automatic;
    if(registered){try{mediaSession.setActionHandler('enterpictureinpicture',null);}catch{}registered=false;}
    // Keep an explicit no-op handler when disabled: otherwise browser-initiated
    // Auto PiP could take over after we unregister our implementation.
    if(mediaSession?.setActionHandler){
      try{mediaSession.setActionHandler('enterpictureinpicture',()=>{
        if(!disposed&&automatic&&ready()&&supported()&&!active())void enter().catch(error=>onError(explain(error)));
      });registered=true;}catch{registered=false;}
    }
    emit();
  }
  const events=['enterpictureinpicture','leavepictureinpicture','webkitpresentationmodechanged','loadedmetadata','loadeddata','playing','canplay','resize','emptied'];
  events.forEach(name=>video.addEventListener(name,emit));
  return {toggle,setAutomatic,state,dispose(){automatic=false;if('autoPictureInPicture' in video)video.autoPictureInPicture=false;if(registered){try{mediaSession.setActionHandler('enterpictureinpicture',null);}catch{}registered=false;}disposed=true;events.forEach(name=>video.removeEventListener(name,emit));}};
}
