// Progressive enhancement only. The links work as ordinary image links without JS.
const galleryRoot=document.querySelector('#publicHome.mktSite');
if(galleryRoot){
  const dialog=galleryRoot.querySelector('.mktGalleryDialog');
  const dialogImage=dialog?.querySelector('.mktGalleryDialogImage img');
  const dialogTitle=dialog?.querySelector('#mktGalleryDialogTitle');
  const close=dialog?.querySelector('[data-mkt-image-close]');
  let trigger=null;

  if(dialog && dialogImage && dialogTitle && close && typeof dialog.showModal==='function'){
    galleryRoot.querySelectorAll('a[data-mkt-image-view]').forEach(link=>{
      link.addEventListener('click',event=>{
        const image=link.querySelector('img');
        const figure=link.closest('figure');
        const title=figure?.querySelector('figcaption strong')?.textContent?.trim();
        if(!image || !title) return;
        try{
          dialogImage.src=link.href;
          dialogImage.alt=image.alt;
          dialogTitle.textContent=title;
          dialog.showModal();
          trigger=link;
          event.preventDefault();
        }catch{
          // Preserve the ordinary link when a browser does not support the dialog.
          dialogImage.removeAttribute('src');
        }
      });
    });
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{
      if(event.target===dialog)dialog.close();
    });
    dialog.addEventListener('close',()=>{
      dialogImage.removeAttribute('src');
      if(trigger?.isConnected)trigger.focus({preventScroll:true});
      trigger=null;
    });
  }
}
