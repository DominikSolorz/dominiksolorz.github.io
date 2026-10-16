export function createRemoteFolderPicker({execute,onSelected=()=>{}}) {
  let dialog=null,path=[],offset=0,busy=false;
  const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  async function run(task) {
    if(busy)return;
    busy=true;dialog.setAttribute('aria-busy','true');
    try {await task();} catch(error){status.textContent=error.uncertain?'Nie znam wyniku operacji. Sprawdź listę folderów przed ponowieniem.':error.message||'Komputer nie odpowiedział.';}
    finally{busy=false;dialog?.removeAttribute('aria-busy');}
  }
  let title,list,status,back,previous,next,choose,nameInput,create;
  async function refresh() {
    status.textContent='Odczytuję foldery komputera…';
    const result=await execute('folder-browse',{folderPath:path,folderOffset:offset});
    title.textContent=[result.root,...result.path].join(' / ');
    list.replaceChildren();
    for(const entry of result.entries){const button=el('button','📁 '+entry.name);button.type='button';button.addEventListener('click',()=>run(async()=>{path=[...path,entry.name];offset=0;await refresh();}));list.append(button);}
    if(!result.entries.length) list.append(el('p','Brak podfolderów. Możesz wybrać ten folder lub utworzyć nowy.'));
    back.disabled=!path.length;previous.disabled=offset===0;next.disabled=result.nextOffset===null;
    next.dataset.offset=String(result.nextOffset??0);
    choose.disabled=false;create.disabled=false;
    status.textContent='To foldery komputera z kamerą, nie telefonu.';
  }
  return {open:async()=>{
    if(dialog){dialog.focus();return;}
    path=[];offset=0;dialog=el('dialog');dialog.className='remoteFolderDialog';dialog.setAttribute('aria-label','Foldery komputera');
    const heading=el('h2','Foldery komputera'),close=el('button','Zamknij');close.type='button';
    title=el('p','Łączenie z komputerem…');title.className='remoteFolderPath';
    status=el('p');status.setAttribute('role','status');list=el('div');list.className='remoteFolderList';
    back=el('button','↑ Folder wyżej');previous=el('button','← Poprzednie');next=el('button','Następne →');choose=el('button','Wybierz ten folder');choose.disabled=true;
    nameInput=el('input');nameInput.placeholder='Nazwa nowego folderu';nameInput.maxLength=100;nameInput.setAttribute('aria-label','Nazwa nowego folderu');
    create=el('button','Utwórz folder');create.disabled=true;
    const actions=el('div');actions.className='remoteFolderActions';actions.append(back,previous,next);
    const creation=el('div');creation.className='remoteFolderActions';creation.append(nameInput,create);
    dialog.append(heading,el('p','Przeglądasz tylko miejsce zatwierdzone na komputerze. Zmiana nie przenosi ani nie usuwa wcześniejszych nagrań.'),title,actions,list,creation,choose,status,close);
    const shut=()=>{dialog?.close();dialog?.remove();dialog=null;};
    close.addEventListener('click',()=>{if(!busy)shut();});dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else shut();});
    back.addEventListener('click',()=>run(async()=>{path=path.slice(0,-1);offset=0;await refresh();}));
    previous.addEventListener('click',()=>run(async()=>{offset=Math.max(0,offset-100);await refresh();}));
    next.addEventListener('click',()=>run(async()=>{offset=Number(next.dataset.offset);await refresh();}));
    create.addEventListener('click',()=>run(async()=>{const folderName=nameInput.value.trim();if(!folderName)throw Error('Podaj nazwę folderu.');await execute('folder-create',{folderPath:path,folderName});nameInput.value='';await refresh();}));
    choose.addEventListener('click',()=>run(async()=>{const result=await execute('folder-select',{folderPath:path});onSelected(result);shut();}));
    document.body.append(dialog);dialog.showModal();await run(refresh);
  }};
}
