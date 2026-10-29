// Camera presentation only. No stream or recorder lifecycle calls.
export function fitAction(mode,mobile=false){
 const modes=mobile?['contain','cover']:['contain','cover','fill'];
 const current=modes.includes(mode)?mode:'contain';
 const next=modes[(modes.indexOf(current)+1)%modes.length];
 const labels={contain:'▣ Cały kadr',cover:'⛶ Wypełnij',fill:'↔ Rozciągnij'};
 return {current,next,label:labels[next],description:next==='contain'?'Pokaż cały kadr i wyzeruj przybliżenie':next==='cover'?'Wypełnij okno — brzegi obrazu mogą zostać przycięte':'Rozciągnij obraz do okna — proporcje mogą się zmienić'};
}
export function applyCameraFit({stage,button,fullscreenButton,mode,mobile=false}){
 const action=fitAction(mode,mobile);
 ['contain','cover','fill'].forEach(value=>stage.classList.toggle(`fit-${value}`,value===action.current));
 for(const control of [button,fullscreenButton])if(control){control.textContent=action.label;control.title=action.description;control.setAttribute('aria-label',action.description);control.dataset.fit=action.current;}
 return action;
}
