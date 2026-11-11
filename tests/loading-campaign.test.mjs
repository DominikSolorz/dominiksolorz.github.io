import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';
import {panelStylesheet,panelSection} from './helpers/panel-css.mjs';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('no advertising screens: neither before sign-in nor in the account/PIN panel',async()=>{
 const [panel,home,sw]=await Promise.all(['kamera/panel.html','kamera/index.html','kamera/sw.js'].map(read));
 const cssLinks=panel.match(/<template id="panelStyles">([\s\S]*?)<\/template>/)?.[1];
 assert.ok(cssLinks,'private panel stylesheet template must exist');
 const names=[...cssLinks.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(names,[panelStylesheet(panel)],'one private panel stylesheet');
 assert.ok(!names.some(name=>name.includes('loading-campaign.css')),'do not show advertising after sign in');
 assert.ok(!sw.includes('./loading-campaign.css?v=1'),'do not precache obsolete private-page banner CSS');
 assert.ok(!home.includes('id="hsMobileSplash"')&&!home.includes('hsMobileLaunch'),'public homepage has no loading screen before sign-in');
 assert.ok(!home.includes('id="mobileWelcome"'),'phones see the current homepage, not the old welcome screen');
 for(const id of ['boot','bootText','bootProgress','bootCountdown','bootStep','bootRetry','lock','app','authDialog','ctrlStart','ctrlStop','video'])
  assert.ok(panel.includes('id="'+id+'"'),'security element retained: '+id);
});

test('a mobile login shows the short loading screen after sign-in, then the secure PIN gate',async()=>{
 const html=await read('kamera/panel.html');
 const bootStart=html.indexOf('<section id="boot"');
 const bootEnd=html.indexOf('<!-- Wejście PIN-em -->',bootStart);
 assert.ok(bootStart!==-1&&bootEnd!==-1);
 const js=html.slice(bootStart,bootEnd).match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js,'secure panel boot script exists');
 const nodes={};
 for(const name of ['boot','bootProgress','bootText','bootCountdown','bootStep','bootRetry']){
  nodes[name]={hidden:false,style:{},textContent:'',addEventListener(){}};
 }
 const steps=Array.from({length:3},()=>({classList:{toggle(){},add(){}}}));
 const timers=[],frames=[];
 const ctx={
  document:{documentElement:{dataset:{phonePlatform:'android'}},
    getElementById:id=>nodes[id],
    querySelectorAll:()=>steps},
  window:{__HOME_SECURITY_DESKTOP__:false,__waitForPanel:Promise.resolve()},
  performance:{now:()=>42},
  setTimeout:(fn,delay)=>{timers.push(delay);return 1;},
  clearTimeout(){},
  requestAnimationFrame:fn=>frames.push(fn),
  location:{href:'https://dominiksolorz.github.io/kamera/panel.html?auth=login'},
  URL
 };
 vm.runInNewContext(js,ctx);
 await Promise.resolve();
 assert.equal(nodes.boot.hidden,false,'loading screen is shown after sign-in on the phone');
 assert.equal(frames.length,1,'loading progress is animated');
 assert.ok(timers.includes(7100),'loading screen has a hard safety limit');
 assert.ok(!timers.some(ms=>ms>=30000),'no long advertising delay after sign-in');
 assert.equal(typeof ctx.window.__finishSecureBoot,'function');
 const app=await read('kamera/app.js');
 assert.match(app,/await window\.__finishSecureBoot\?\.\(\)/);
 assert.match(app,/await requireAccess\(/,'PIN remains mandatory after account readiness');
});
