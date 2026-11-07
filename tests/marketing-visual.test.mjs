import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('product explanation remains on its own page with real illustrations and explicit limits',async()=>{
 const source=await read('design/marketing/jak-dziala.html'),page=await read('kamera/jak-dziala.html');
 for(const html of [source,page]){
  for(const token of ['id="w-praktyce"','id="mktVisualTitle"','assets/home-security-how-it-works.png','loading="lazy"','Ilustracja koncepcji produktu'])assert.ok(html.includes(token),token);
  assert.ok(!html.includes('Odtwórz film'));
  assert.equal((html.match(/id="w-praktyce"/g)||[]).length,1);
 }
 assert.ok((await stat(new URL('kamera/assets/home-security-how-it-works.png',root))).size>50000);
 assert.ok((await read('kamera/pytania.html')).includes('Czy założenie konta oznacza zakup?'));
});

test('marketing CSS and PWA cache agree and mobile labels are legible',async()=>{
  const [css,html,sw,app,manifest]=await Promise.all([
    read('kamera/marketing.css'),read('kamera/panel.html'),read('kamera/sw.js'),
    read('kamera/app.js'),read('kamera/version.json')
  ]);
  assert.ok(css.includes('.mktVisualLayout'));
  assert.ok(css.includes('.mktVisualImage img'));
  assert.ok(css.includes('.mktEyebrow{font-size:12px}'));
  assert.ok(css.includes('.mktBrand small{font-size:12px'));
  const version=html.match(/marketing\.css\?v=(\d+)/)?.[1];
  assert.ok(version);
  assert.ok(sw.includes('./marketing.css?v='+version));
  assert.equal(app.match(/SERVICE_WORKER_BUILD = "(\d+)"/)?.[1],sw.match(/kamera-domowa-shell-v(\d+)/)?.[1]);
  assert.ok(html.includes('app.js?v='+JSON.parse(manifest).version));
});
