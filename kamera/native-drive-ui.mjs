export function describeNativeDrive(value,now=Date.now()) {
 if(!value||!Number.isFinite(Date.parse(value.updatedAt))||now-Date.parse(value.updatedAt)>180000||now-Date.parse(value.updatedAt)<-60000)return {state:'unknown',text:'Brak aktualnego potwierdzenia automatu Drive. Nie oznacza to utraty nagrań.'};
 const count=name=>Number.isSafeInteger(value.counts?.[name])&&value.counts[name]>=0?value.counts[name]:0;
 const sent=count('succeeded'),active=count('running'),queued=count('queued')+count('retry_wait'),blocked=count('blocked')+count('failed');
 const summary=`Potwierdzone na Drive: ${sent}. Wysyłane: ${active}. Oczekujące: ${queued}. Wymagające sprawdzenia: ${blocked}.`;
 return {state:value.status==='auth_required'?'error':blocked?'warning':active?'uploading':'ready',text:(value.status==='auth_required'?'Połącz ponownie konto Google. ':'')+summary};
}
export function mountNativeDriveUI({root,store,refresh}) {
 const output=root.querySelector('[data-drive-summary]');
 const paint=snapshot=>{const description=describeNativeDrive(snapshot.components.nativeDrive);output.textContent=description.text;output.dataset.state=description.state;};
 paint(store.snapshot());const unsubscribe=store.subscribe(paint);
 const button=root.querySelector('[data-drive-refresh]');button.hidden=!refresh;
 if(refresh)button.addEventListener('click',()=>refresh());
 const timer=setInterval(()=>paint(store.snapshot()),15000);
 return ()=>{unsubscribe();clearInterval(timer);};
}
export function nativeDriveSummary(value){return value?{status:value.status,counts:value.counts,updatedAt:value.updatedAt}:null;}
