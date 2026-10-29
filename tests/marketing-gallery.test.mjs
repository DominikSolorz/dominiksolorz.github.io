import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';

const base=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,base),'utf8');
const homePaths=['design/marketing/prezentacja.html','kamera/prezentacja.html'];

test('product gallery uses existing proposal boards, not invented screenshots',async()=>{
  const pages=await Promise.all(homePaths.map(read));
  for(const html of pages){
    assert.ok(html.includes('id="galeria"'));
    assert.ok(html.includes('Wizualizacje UI') || html.includes('wizualizacje UI') || html.includes('wizualizacje UI') || html.includes('wizualizacje UI z etapu 193') || html.includes('wizualizacje UI z etapu 193'.toUpperCase()) || html.includes('wizualizacje UI z etapu 193'),'concept disclaimer');
    assert.ok(html.includes('nie są rzeczywiste zrzuty ekranu') || html.includes('nie są zrzuty') || html.includes('nie są rzeczywiste zrzuty ekranu') || html.includes('To nie są rzeczywiste zrzuty ekranu'));
    assert.equal((html.match(/class="mktConceptCard"/g)||[]).length,4);
    if(html.startsWith('<!doctype'))assert.ok(html.includes('marketing-gallery.css?v=4'));
    if(html.startsWith('<!doctype'))assert.ok(html.includes('marketing-gallery.mjs?v=2'));
    assert.ok(html.includes('aria-labelledby="mktGalleryDialogTitle"'));
    assert.ok(html.includes('data-mkt-image-close'));
    assert.ok(html.includes('href="galeria.html"'));
  }
  const html=pages[0];
  const assets=[...html.matchAll(/<a class="mktConceptOpen" href="([^"]+)"[^>]*>\s*<img src="([^"]+)"[^>]*>/g)];
  assert.equal(assets.length,4);
  for(const [,href,src] of assets){
    assert.equal(href,src,'gallery full image must match thumbnail');
    assert.ok(src.startsWith('../docs/ui-193/'),'gallery sources are repo-owned design references');
    const file=new URL(src,new URL('kamera/o-systemie.html',base));
    assert.ok((await stat(file)).size>100_000,'concept must be a real, nonempty image');
  }
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
    read('kamera/marketing-gallery.css'),read('design/marketing/prezentacja.html'),
    read('kamera/sw.js'),read('kamera/version.json'),read('kamera/app.js'),
    read('kamera/panel.html')
  ]);
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(css.includes(':focus-visible'));
  assert.ok(css.includes('@media(max-width:650px)'));
  assert.equal((src.match(/loading="lazy" decoding="async" fetchpriority="low"/g)||[]).length,4);
  assert.ok(sw.includes('./marketing-gallery.css?v=4'));
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
