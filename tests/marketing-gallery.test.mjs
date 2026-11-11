import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';

const base=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,base),'utf8');

test('product gallery uses existing proposal boards, not invented screenshots',async()=>{
  const full=await read('kamera/galeria.html'); assert.equal((full.match(/class="mktConceptCard"/g)||[]).length,8);
  assert.ok(full.includes('nie zrzuty działającej aplikacji'));
  const docs=await read('docs/ui-193/README.md');
  assert.ok(docs.includes('nie zrzuty uruchomionego programu'));
});

test('gallery lightbox is keyboard accessible and does not block ordinary link fallback',async()=>{
  const code=await read('kamera/marketing-gallery.mjs');
  let handler,closeHandler,closeEvent,open=0,focus=0,prevented=0,dialogTitle='',imgSource='',imgAlt='';
  const dialogImage={set src(value){imgSource=value;},get src(){return imgSource;},set alt(value){imgAlt=value;},get alt(){return imgAlt;},removeAttribute(attr){if(attr==='src')imgSource='';}};
  const imageContainer={replaceChildren(image){if(!image)imgSource='';}};
  const title={set textContent(value){dialogTitle=value;}};
  const closeButton={addEventListener(name,fn){if(name==='click')closeHandler=fn;}};
  const dialog={querySelector(sel){
    if(sel==='.mktGalleryDialogImage')return imageContainer;
    if(sel==='#mktGalleryDialogTitle')return title;
    if(sel==='[data-mkt-image-close]')return closeButton;
    return null;
  },addEventListener(name,fn){if(name==='close')closeEvent=fn;},
    showModal(){open++;},close(){closeEvent?.();}};
  const picture={alt:'Makieta produktu bez prywatnego obrazu'};
  const link={href:'https://example.test/docs/ui-193/01-pulpit.png',isConnected:true,
    querySelector:sel=>sel==='img'?picture:null,
    closest:sel=>sel==='figure'?{querySelector:()=>({textContent:'Pulpit i podgląd'})}:null,
    addEventListener(name,fn){if(name==='click')handler=fn;},
    focus(){focus++;}};
  const root={querySelector:sel=>sel==='.mktGalleryDialog'?dialog:null,
    querySelectorAll:()=>[link]};
  vm.runInNewContext(code,{document:{querySelector:()=>root,createElement:tag=>{assert.equal(tag,'img');return dialogImage;}}});
  assert.equal(typeof handler,'function');
  handler({preventDefault(){prevented++;}});
  assert.equal(open,1);
  assert.equal(prevented,1);
  assert.equal(dialogTitle,'Pulpit i podgląd');
  assert.equal(imgSource,link.href);
  assert.equal(imgAlt,picture.alt);
  closeHandler();
  assert.equal(focus,1);
  assert.equal(imgSource,'');
});

test('gallery respects reduced motion and does not load concept assets eagerly',async()=>{
  const [css,src,sw,manifest,app,index]=await Promise.all([
    read('kamera/marketing-gallery.css'),read('design/marketing/gallery.html'),
    read('kamera/sw.js'),read('kamera/version.json'),read('kamera/app.js'),
    read('kamera/panel.html')
  ]);
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(css.includes(':focus-visible'));
  assert.ok(css.includes('@media(max-width:650px)'));
  assert.ok(!src.includes('loading="eager"'),'concept boards are never loaded eagerly');
  assert.ok(sw.includes('./marketing-gallery.css?v=5'));
  assert.ok(sw.includes('./marketing-gallery.mjs?v=2'));
  const release=JSON.parse(manifest).version;
 const shell=app.match(/SERVICE_WORKER_BUILD = "(\d+)"/)?.[1];
 assert.ok(/^\d+$/.test(release)&&/^\d+$/.test(shell),'manifest and service worker revisions must be numeric');
assert.ok(sw.includes('kamera-domowa-shell-v'+shell));

  assert.ok(app.includes('const VERSION = "'+release+'"'));
  assert.ok(app.includes('SERVICE_WORKER_BUILD = "'+shell+'"'));
  assert.ok(index.includes('home-security-build" content="'+release+'"'));
  assert.ok(index.includes('app.js?v='+release));
});
