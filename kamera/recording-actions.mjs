export function validRecordingName(name) {
  return typeof name==='string'&&name.length<=240&&/^kamera-[^/\\\x00-\x1f]*\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}[^/\\\x00-\x1f]*\.(mp4|webm)$/i.test(name);
}

// Called only after owner authorization and the UI's explicit confirmation.
// No camera lifecycle method and no cloud-delete API is reachable here.
export function createRecordingDeletion({meta,diskFile,removeApp,removeDisk,removeQueued,refresh}) {
 return async name=>{
  if(!validRecordingName(name))throw Error('Nieprawidłowa nazwa nagrania.');
  const [app,disk]=await Promise.all([meta(name),diskFile(name)]);
  if(!app&&!disk)throw Error('Nagrania nie ma w dostępnym archiwum.');
  let diskRemoved=false;
  if(disk){diskRemoved=await removeDisk(name);if(!diskRemoved)throw Error('Nie potwierdzono usunięcia pliku z folderu.');}
  if(app)await removeApp(name);
  await removeQueued(name);
  await refresh();
  return {deleted:true,name,appRemoved:!!app,diskRemoved,cloudDeleted:false};
 };
}

export function confirmRecordingDeletion(text,doc=globalThis.document) {
 return new Promise(resolve=>{
  const dialog=doc.createElement('dialog');dialog.className='recordingDeleteDialog';dialog.setAttribute('aria-label','Potwierdź usunięcie nagrania');
  const heading=doc.createElement('h2');heading.textContent='Usunąć nagranie?';
  const description=doc.createElement('p');description.textContent=text;
  const label=doc.createElement('label'),ack=doc.createElement('input');ack.type='checkbox';
  label.append(ack,doc.createTextNode(' Rozumiem, że lokalnego usunięcia nie można cofnąć.'));
  const actions=doc.createElement('div');actions.className='recordingDeleteActions';
  const cancel=doc.createElement('button');cancel.type='button';cancel.textContent='Anuluj';
  const remove=doc.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Usuń nagranie';remove.disabled=true;
  let settled=false;
  const finish=value=>{if(settled)return;settled=true;dialog.close();dialog.remove();resolve(value);};
  ack.addEventListener('change',()=>{remove.disabled=!ack.checked;});cancel.addEventListener('click',()=>finish(false));
  remove.addEventListener('click',()=>{if(ack.checked)finish(true);});
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
  actions.append(cancel,remove);dialog.append(heading,description,label,actions);doc.body.append(dialog);dialog.showModal();cancel.focus();
 });
}
