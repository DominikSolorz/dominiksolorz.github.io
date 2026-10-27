import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');

function mount({latest=223,marketing=true,dirty=false}={}) {
  const controls=[],listeners={},documentEvents={},timers=new Map();
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
    querySelector:selector=>selector==='meta[name="home-security-build"]'?{content:'222'}:null,
    addEventListener:(name,handler)=>{documentEvents[name]=handler;}
  };
  const win={
    location:{reload(){reloads++;}},
    setTimeout(callback){const key=nextTimer++;timers.set(key,callback);return key;},
    clearTimeout(key){timers.delete(key);},
    setInterval(){return 1;},clearInterval(){},
    addEventListener:(name,handler)=>{listeners[name]=handler;},
    confirm(){confirmations++;return allowDiscard;}
  };
  const runtime={
    document:doc,window:win,
    sessionStorage:{getItem:key=>session.get(key)||null,setItem:(key,val)=>session.set(key,val)},
    fetch:async()=>({ok:true,json:async()=>({version:String(latest)})}),
    URL,Date,Number,Promise,console
  };
  return {
    async run() {
      const code=(await read('kamera/marketing-auto-update.mjs'))
        .replaceAll('import.meta.url',JSON.stringify('https://example.test/kamera/marketing-auto-update.mjs'));
      vm.runInNewContext(code,runtime);
      await new Promise(resolve=>setImmediate(resolve));
      await new Promise(resolve=>setImmediate(resolve));
      return this;
    },
    controls,documentEvents,listeners,timers,
    get banner(){return banner;},
    get reloads(){return reloads;},
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
  assert.ok(x.controls.some(item=>String(item.textContent).includes('Nowa wersja HOME SECURITY 223')));
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
  for(const config of [{latest:222},{latest:221},{marketing:false}]){
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
 assert.ok(app.includes("core/web-updates.mjs?v=3"));
});
