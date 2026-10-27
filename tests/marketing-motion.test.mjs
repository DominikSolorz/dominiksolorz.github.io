import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('public motion module has valid JavaScript syntax and no recorder dependencies',async()=>{
 const path=new URL('kamera/marketing-motion.mjs',root);
 const syntax=spawnSync(process.execPath,['--check',fileURLToPath(path)],{encoding:'utf8'});
 assert.equal(syntax.status,0,syntax.stderr||syntax.error?.message);
 const js=await read('kamera/marketing-motion.mjs');
 assert.ok(js.includes("document.querySelector('#publicHome.mktSite')"));
 assert.ok(js.includes("site.getClientRects().length > 0"));
 assert.ok(js.includes("aria-current', 'location'"));
 assert.ok(!/getUserMedia|MediaRecorder|createClient\(|signInWithPassword|localStorage/.test(js));
});

test('scroll progress, active nav and back-to-top work in reduced-motion mode',async()=>{
 const js=await read('kamera/marketing-motion.mjs');
 const events={};let button=null,progress='',focusCount=0,scrollRequest=null;
 const classNames=new Set(),linkAttrs=new Map();
 const link={getAttribute:name=>name==='href'?'#features':linkAttrs.get(name),
   setAttribute:(name,value)=>linkAttrs.set(name,value),removeAttribute:name=>linkAttrs.delete(name)};
 const brand={focus:()=>focusCount++};
 const navigation={querySelectorAll:()=>[link]};
 const header={
   querySelector:selector=>selector.startsWith('nav[')?navigation:selector==='.mktBrand'?brand:null,
   getBoundingClientRect:()=>({height:80}),
   style:{setProperty:(name,value)=>{if(name==='--mkt-scroll-progress')progress=value;}},
   classList:{toggle:(name,on)=>{if(on)classNames.add(name);else classNames.delete(name);}}
 };
 const topButton={hidden:true,attrs:{},listeners:{},setAttribute(name,value){this.attrs[name]=value;},
   append(){},addEventListener(name,callback){this.listeners[name]=callback;}};
 const site={querySelector:selector=>selector==='.mktHeader'?header:null,
   querySelectorAll:()=>[],getClientRects:()=>[{}],contains:()=>true,
   addEventListener(){},append:element=>{button=element;}};
 const window={scrollY:900,innerHeight:800,matchMedia:()=>({matches:true,addEventListener(){}}),
   requestAnimationFrame:callback=>callback(),
   addEventListener:(name,callback)=>{events[name]=callback;},
   scrollTo:options=>{scrollRequest=options;}};
 const document={body:{},documentElement:{scrollHeight:2000},
   querySelector:selector=>selector==='#publicHome.mktSite'?site:null,
   getElementById:id=>id==='features'?{getBoundingClientRect:()=>({top:800-window.scrollY})}:null,
   createElement:()=>topButton,createTextNode:value=>({textContent:value})};
 vm.runInNewContext(js,{window,document});
 assert.ok(button,'back-to-top control must be mounted');
 assert.equal(button.hidden,false);
 assert.equal(button.attrs['aria-label'],'Wróć na początek strony');
 assert.equal(progress,'0.75');
 assert.equal(linkAttrs.get('aria-current'),'location');
 assert.ok(classNames.has('mktIsScrolled'));
 button.listeners.click();
 assert.equal(scrollRequest.top,0);
 assert.equal(scrollRequest.behavior,'auto','reduced motion must not smooth-scroll');
 assert.equal(focusCount,1,'keyboard focus returns to header');
 window.scrollY=0;events.scroll();
 assert.equal(button.hidden,true);
 assert.equal(linkAttrs.has('aria-current'),false);
 assert.equal(classNames.has('mktIsScrolled'),false);
});

test('all marketing pages load the motion styles and script, including the panel public entry',async()=>{
 const paths=['kamera/index.html','kamera/o-systemie.html','kamera/galeria.html','kamera/pomoc.html',
   'kamera/blog/index.html','kamera/blog/pierwsze-uruchomienie.html',
   'kamera/blog/zapis-lokalny-i-drive.html','kamera/blog/diagnostyka-monitoringu.html'];
 for(const path of paths){
   const html=await read(path),prefix=path.includes('/blog/')?'../':'';
   assert.ok(html.includes('href="'+prefix+'marketing-motion.css?v=1"'),path);
   assert.ok(html.includes('src="'+prefix+'marketing-motion.mjs?v=1"'),path);
   assert.equal((html.match(/marketing-motion\.mjs\?v=1/g)||[]).length,1,path);
 }
});

test('scroll effects are progressive, focus-safe and opt out of reduced motion',async()=>{
 const [css,js]=await Promise.all(['kamera/marketing-motion.css','kamera/marketing-motion.mjs'].map(read));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 assert.ok(css.includes('.mktWillReveal.mktIsVisible'));
 assert.ok(css.includes(':focus-visible'));
 assert.ok(css.includes('.mktFaq details[open]'));
 assert.ok(css.includes('mktBackToTop[hidden]'));
 assert.ok(js.includes("'IntersectionObserver' in window"));
 assert.ok(js.includes("site.addEventListener('focusin'"));
 assert.ok(js.includes("element.classList.remove('mktWillReveal', 'mktIsVisible')"));
 assert.ok(js.includes('entry.isIntersecting'));
});

test('PWA, runtime and public pages have matching motion asset and build versions',async()=>{
 const [sw,app,version,index]=await Promise.all([
  'kamera/sw.js','kamera/app.js','kamera/version.json','kamera/index.html'].map(read));
 for(const asset of ['marketing-motion.css?v=1','marketing-motion.mjs?v=1'])assert.ok(sw.includes('./'+asset));
 assert.ok(sw.includes('kamera-domowa-shell-v132'));
 assert.ok(app.includes('SERVICE_WORKER_BUILD = "132"'));
 assert.ok(app.includes('const VERSION = "222"'));
 assert.equal(JSON.parse(version).version,'222');
 assert.ok(index.includes('home-security-build" content="222"'));
 assert.ok(index.includes('app.js?v=222'));
});


test('support assistant does not overlap the scroll control and auth animations respect accessibility',async()=>{
 const [css,html]=await Promise.all(['kamera/marketing-motion.css','kamera/index.html'].map(read));
 assert.ok(css.includes('#publicHome.mktSite .mktBackToTop{left:'));
 assert.ok(css.includes('#authDialog:not([hidden]) .authCard'));
 assert.ok(css.includes('#authDialog:not([hidden]) [data-auth-step].authForm:not([hidden])'));
 assert.ok(css.includes('#authDialog:not([hidden]) .authBackdrop'));
 assert.ok(css.includes('#authDialog :is(.authPrimary,.authSecondary,.authGoogleButton,.authTextBtn,.authClose){transition:none!important'));
 assert.ok(html.includes('class="authDialog"'));
 assert.ok(html.includes('id="authClose"'));
});
