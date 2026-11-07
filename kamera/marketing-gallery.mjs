// Progressive enhancement only. The links work as ordinary image links without JS.
const galleryRoot=document.querySelector('#publicHome.mktSite');
if(galleryRoot){
  const dialog=galleryRoot.querySelector('.mktGalleryDialog');
  const imageContainer=dialog?.querySelector('.mktGalleryDialogImage');
  let dialogImage=null;
  const dialogTitle=dialog?.querySelector('#mktGalleryDialogTitle');
  const close=dialog?.querySelector('[data-mkt-image-close]');
  let trigger=null;

  if(dialog && imageContainer && dialogTitle && close && typeof dialog.showModal==='function'){
    galleryRoot.querySelectorAll('a[data-mkt-image-view]').forEach(link=>{
      link.addEventListener('click',event=>{
        const image=link.querySelector('img');
        const figure=link.closest('figure');
        const title=figure?.querySelector('figcaption strong')?.textContent?.trim();
        if(!image || !title) return;
        try{
          dialogImage=document.createElement('img');
          dialogImage.src=link.href;
          imageContainer.replaceChildren(dialogImage);
          dialogImage.alt=image.alt;
          dialogTitle.textContent=title;
          dialog.showModal();
          trigger=link;
          event.preventDefault();
        }catch{
          // Preserve the ordinary link when a browser does not support the dialog.
          imageContainer.replaceChildren();
          dialogImage=null;
        }
      });
    });
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{
      if(event.target===dialog)dialog.close();
    });
    dialog.addEventListener('close',()=>{
      imageContainer.replaceChildren();
      dialogImage=null;
      if(trigger?.isConnected)trigger.focus({preventScroll:true});
      trigger=null;
    });
  }
}
