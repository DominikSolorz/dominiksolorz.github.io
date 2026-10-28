import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('illustrated product explanation is real, accessible and consistent with its source',async()=>{
  const [home,app,brochure]=await Promise.all([
    read('design/marketing/home.html'),
    read('kamera/panel.html'),
    read('kamera/o-systemie.html')
  ]);
  for(const html of [home,app,brochure]){
    assert.ok(html.includes('id="w-praktyce"'));
    assert.ok(html.includes('id="mktVisualTitle"'));
    assert.ok(html.includes('assets/home-security-how-it-works.png'));
    assert.ok(html.includes('loading="lazy"'));
    assert.ok(html.includes('Ilustracja koncepcji produktu'));
    assert.ok(html.includes('Czy założenie konta oznacza zakup?'));
    assert.ok(html.includes('pomoc.html?temat=produkt'));
    assert.ok(!html.includes('Odtwórz film'), 'do not promise missing demo footage');
  }
  const image=new URL('kamera/assets/home-security-how-it-works.png',root);
  assert.ok((await stat(image)).size>50000);
  assert.equal((app.match(/id="w-praktyce"/g)||[]).length,1);
  assert.equal((brochure.match(/id="w-praktyce"/g)||[]).length,1);
});

test('marketing CSS and PWA cache agree and mobile labels are legible',async()=>{
  const [css,html,sw,app,manifest]=await Promise.all([
    read('kamera/marketing.css'),read('kamera/panel.html'),read('kamera/sw.js'),
    read('kamera/app.js'),read('kamera/version.json')
  ]);
  assert.ok(css.includes('.mktVisualLayout'));
  assert.ok(css.includes('.mktVisualImage img'));
  assert.ok(css.includes('.mktEyebrow{font-size:11px}'));
  assert.ok(css.includes('.mktBrand small{font-size:11px'));
  const version=html.match(/marketing\.css\?v=(\d+)/)?.[1];
  assert.ok(version);
  assert.ok(sw.includes('./marketing.css?v='+version));
  assert.equal(app.match(/SERVICE_WORKER_BUILD = "(\d+)"/)?.[1],sw.match(/kamera-domowa-shell-v(\d+)/)?.[1]);
  assert.ok(html.includes('app.js?v='+JSON.parse(manifest).version));
});
