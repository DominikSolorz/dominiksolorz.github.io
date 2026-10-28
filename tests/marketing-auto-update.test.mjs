import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');
const currentBuild=Number(JSON.parse(await read('kamera/version.json')).version);

function mount({latest=currentBuild+1,marketing=true,dirty=false,startBackground=true}={}) {
  const controls=[],listeners={},documentEvents={},timers=new Map();
  let requests=0;
  let nextTimer=1,reloads=0,confirmations=0,allowDiscard=false,banner=null;
  const session=new Map();
  const createElement = tag => {
    const item={tag,className:'',hidden:false,textContent:'',attributes:{},children:[],listeners:{},
      setAttribute(key,value){this.attributes[key]=value;},
      append(...children){this.children.push(...children);},
      addEventListener(type,callback){this.listeners[type]=callback;}
    };
    controls.push(item);
    return item;
  };
  const doc={
    body:{classList:{contains:name=>marketing&&name==='marketingPage'},append(node){banner=node;}},
    readyState:'complete',
    visibilityState:'visible',
    createElement,
    querySelector:selector=>selector==='meta[name="home-security-build"]'?{content:String(currentBuild)}:null,
    addEventListener:(name,handler)=>{documentEvents[name]=handler;}
  };
  const win={
    location:{reload(){reloads++;}},
    setTimeout(callback,delay){const key=nextTimer++;callback.delay=delay;timers.set(key,callback);return key;},
    clearTimeout(key){timers.delete(key);},
    setInterval(){return 1;},clearInterval(){},
    addEventListener:(name,handler)=>{listeners[name]=handler;},
    confirm(){confirmations++;return allowDiscard;}
  };
  const runtime={
    document:doc,window:win,
    sessionStorage:{getItem:key=>session.get(key)||null,setItem:(key,val)=>session.set(key,val)},
    fetch:async()=>{requests++;return {ok:true,json:async()=>({version:String(latest)})};},
    URL,Date,Number,Promise,console
  };
  return {
    async run() {
      const code=(await read('kamera/marketing-auto-update.mjs'))
        .replace(/^import[^\n]*\n/m, '')
        .replaceAll('import.meta.url',JSON.stringify('https://example.test/kamera/marketing-auto-update.mjs'));
      vm.runInNewContext(code,runtime);
      if(startBackground){for(const [key,handler] of [...timers])if(handler.delay===30000){timers.delete(key);handler();}}
      await new Promise(resolve=>setImmediate(resolve));
      await new Promise(resolve=>setImmediate(resolve));
      return this;
    },
    controls,documentEvents,listeners,timers,
    get banner(){return banner;},
    get reloads(){return reloads;},
    get requests(){return requests;},
    get confirmations(){return confirmations;},
    setDiscard(v){allowDiscard=v;},
    act(label){const button=controls.find(e=>e.tag==='button'&&e.textContent===label);assert.ok(button,label);button.listeners.click();},
    enterText(){documentEvents.input?.({target:{matches:()=>true}});},
    fireAuto(){const pending=[...timers.values()];timers.clear();for(const handler of pending)handler();}
  };
}

test('newer public release automatically displays a clear one-click update action',async()=>{
  const x=await mount().run();
  assert.ok(x.banner&&!x.banner.hidden);
  assert.ok(x.controls.some(item=>item.textContent==='Zaktualizuj'));
  assert.ok(x.controls.some(item=>String(item.textContent).includes('Dostępna wersja HOME SECURITY '+(currentBuild+1))));
  x.act('Zaktualizuj');
  assert.equal(x.reloads,1);
});

test('clean idle marketing page can automatically reload to the latest release',async()=>{
  const x=await mount().run();
  assert.ok(x.timers.size>0,'auto update is scheduled');
  x.fireAuto();
  assert.equal(x.reloads,1);
});

test('unsent contact form is never reloaded automatically and needs explicit confirmation',async()=>{
  const x=await mount().run();
  x.enterText();x.fireAuto();
  assert.equal(x.reloads,0);
  x.act('Zaktualizuj');
  assert.equal(x.confirmations,1);
  assert.equal(x.reloads,0);
  x.setDiscard(true);
  x.act('Zaktualizuj');
  assert.equal(x.reloads,1);
});

test('Later defers both prompt and automatic reload',async()=>{
  const x=await mount().run();
  x.act('Później');
  assert.equal(x.banner.hidden,true);
  x.fireAuto();
  assert.equal(x.reloads,0);
});

test('no refresh prompt on a current release or unrelated page',async()=>{
  for(const config of [{latest:currentBuild},{latest:currentBuild-1},{marketing:false}]){
    const x=await mount(config).run();
    assert.equal(x.banner===null||x.banner.hidden,true);
    assert.equal(x.reloads,0);
  }
});

test('PWA update action cannot override live-camera safety gate even when clicked',async()=>{
 const js=await read('kamera/core/web-updates.mjs');
 assert.ok(js.includes("if(!canAutoApply())"));
 assert.ok(js.includes("emit('waiting'"));
 const app=await read('kamera/app.js');
 assert.ok(app.includes("button.textContent=webUpdates.available?'Zaktualizuj':'Sprawdź aktualizacje'"));
 assert.ok(app.includes("core/web-updates.mjs?v=4"));
});

test('public release notice preserves live Windows installer downloads on all marketing pages',async()=>{
  const paths=['kamera/o-systemie.html','kamera/galeria.html','kamera/pomoc.html','kamera/blog/index.html',
    'kamera/blog/pierwsze-uruchomienie.html','kamera/blog/zapis-lokalny-i-drive.html',
    'kamera/blog/diagnostyka-monitoringu.html'];
  const [manifest,app,sw,generator,script,style]=await Promise.all([
    read('kamera/version.json'),read('kamera/app.js'),read('kamera/sw.js'),
    read('scripts/build-marketing.mjs'),read('kamera/marketing-auto-update.mjs'),
    read('kamera/marketing-auto-update.css')]);
  const version=JSON.parse(manifest).version;
  const worker=app.match(/SERVICE_WORKER_BUILD = "(\d+)"/)?.[1];
  assert.ok(version&&worker);
  assert.ok(sw.includes('kamera-domowa-shell-v'+worker));
  assert.ok(app.includes('const VERSION = "'+version+'"'));
  assert.ok(sw.includes('./marketing-auto-update.css?v=2'));
  assert.ok(sw.includes('./marketing-auto-update.mjs?v=5'));
  assert.ok(sw.includes('./core/web-updates.mjs?v=4'));
  assert.ok(generator.includes('marketing-auto-update.mjs?v=5'));
  assert.ok(generator.includes('marketing-auto-update.css?v=2'));
  assert.ok(script.includes("import './marketing-downloads.mjs?v=2'"),'new prompt must not remove the installer version updater');
  assert.ok(script.includes("update.textContent = 'Zaktualizuj'"));
  assert.ok(style.includes('.mktUpdateBanner[hidden]'));
  for(const path of paths){
    const html=await read(path);
    const prefix=path.startsWith('kamera/blog/')?'../':'';
    assert.ok(html.includes('home-security-build" content="'+version+'"'),path);
    assert.ok(html.includes('href="'+prefix+'marketing-auto-update.css?v=2"'),path);
    assert.ok(html.includes('src="'+prefix+'marketing-auto-update.mjs?v=5"'),path);
    assert.equal((html.match(/marketing-auto-update\.mjs\?v=5/g)||[]).length,1,path);
  }
});


test('initial load and focus never fetch release metadata before the background window',async()=>{
 const x=await mount({startBackground:false}).run();
 assert.equal(x.requests,0);
 x.listeners.focus();x.documentEvents.visibilitychange();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.requests,0,'early focus and visibility events cannot reintroduce a critical request');
 assert.ok([...x.timers.values()].some(handler=>handler.delay===30000));
 x.fireAuto();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.requests,1);assert.equal(x.banner.hidden,false,'update prompt still works later');
});
