import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('commercial WebP belongs to the public mobile intro, not the account/PIN panel',async()=>{
 const [panel,home,sw]=await Promise.all(['kamera/panel.html','kamera/index.html','kamera/sw.js'].map(read));
 const img=await stat(new URL('kamera/assets/home-security-loading.webp',root));
 assert.ok(img.size>10000&&img.size<50000,'mobile advertisement remains lightweight');
 const cssLinks=panel.match(/<template id="panelStyles">([\s\S]*?)<\/template>/)?.[1];
 assert.ok(cssLinks,'private panel stylesheet template must exist');
 const names=[...cssLinks.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(names.indexOf('operator-layout.css?v=7') < names.indexOf('mobile-app-look.css?v=22'));
 assert.ok(!names.some(name=>name.includes('loading-campaign.css')),'do not show advertising after sign in');
 assert.ok(!sw.includes('./loading-campaign.css?v=1'),'do not precache obsolete private-page banner CSS');
 assert.ok(home.includes('id="hsMobileSplash"'),'public mobile introduction remains available');
 assert.ok(home.includes('30000'),'public mobile advertising lasts 30 seconds');
 for(const id of ['boot','bootText','bootProgress','bootCountdown','bootStep','bootRetry','lock','app','authDialog','ctrlStart','ctrlStop','video'])
  assert.ok(panel.includes('id="'+id+'"'),'security element retained: '+id);
});

test('a mobile login skips second loading screen and does not delay the secure PIN gate',async()=>{
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
 assert.equal(nodes.boot.hidden,true,'mobile boot must remain hidden after login');
 await ctx.window.__finishSecureBoot();
 assert.equal(nodes.boot.hidden,true,'mobile PIN transition must not show boot');
 assert.equal(frames.length,0,'no animation in private phone flow');
 assert.ok(!timers.includes(700)&&!timers.includes(220),
  'no artificial post-login delay');
 assert.equal(typeof ctx.window.__finishSecureBoot,'function');
 const app=await read('kamera/app.js');
 assert.match(app,/await window\.__finishSecureBoot\?\.\(\)/);
 assert.match(app,/await requireAccess\(/,'PIN remains mandatory after account readiness');
});
