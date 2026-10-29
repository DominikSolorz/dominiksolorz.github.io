import {galleryBoards} from './gallery-catalog.mjs?v=1';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
let dialog,trigger;
export function openProjectGallery(button){
 trigger=button;
 if(!dialog){
  dialog=el('dialog',null,'hsProjectGallery');dialog.setAttribute('aria-labelledby','hsProjectGalleryTitle');
  const header=el('header'),title=el('h2','Projekty interfejsu HOME SECURITY');title.id='hsProjectGalleryTitle';
  const close=el('button','Zamknij');close.type='button';close.addEventListener('click',()=>dialog.close());header.append(title,close);
  const notice=el('p','Plansze koncepcyjne — nie są zrzutami działającego programu.','hsGalleryNotice');
  const grid=el('section',null,'hsGalleryGrid');grid.setAttribute('aria-label','Osiem projektów interfejsu');
  galleryBoards.forEach((board,index)=>{const figure=el('figure'),link=el('a'),img=el('img'),caption=el('figcaption');
   link.href=board.url;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label',`Otwórz pełną planszę: ${board.title}`);
   img.src=board.url;img.alt=`Projekt koncepcyjny: ${board.title}`;img.loading='lazy';img.decoding='async';link.append(img);
   caption.append(el('span',`PROJEKT ${String(index+1).padStart(2,'0')} / 08`),el('h3',board.title),el('p',board.caption));figure.append(link,caption);grid.append(figure);
  });
  dialog.append(header,notice,grid);document.body.append(dialog);
  dialog.addEventListener('close',()=>{trigger?.focus({preventScroll:true});trigger=null;});
 }
 if(!dialog.open)dialog.showModal();
}
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-open-project-gallery]');if(button)openProjectGallery(button);});
