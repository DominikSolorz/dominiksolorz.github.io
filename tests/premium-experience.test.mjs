import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async path=>(await readFile(new URL('../'+path,import.meta.url),'utf8')).replaceAll('\r\n','\n');

test('public introduction stays identical in the app and indexed landing page',async()=>{
  const [home,index,brochure]=await Promise.all([
    'design/marketing/home.html','kamera/panel.html','kamera/o-systemie.html'
  ].map(read));
  const slot=/<(?:section|div)(?: role="group")? id="publicHome"[\s\S]*?<\/(?:section|div)>(?=\s*<section id="authDialog")/;
  assert.equal(index.match(slot)?.[0],home.trimEnd());
  assert.ok(brochure.includes(home.trimEnd()));
  for(const [id,file] of Object.entries({'zobacz-panel':'prezentacja',mozliwosci:'mozliwosci','wybierz-start':'stan-projektu',asystent:'pytania',faq:'pytania'})){assert.ok(!home.includes('id="'+id+'"'),id);assert.ok((await read('kamera/'+file+'.html')).includes('id="'+id+'"'),file);}
  assert.ok((await read('kamera/prezentacja.html')).includes('WIZUALIZACJA INTERFEJSU'));
});

test('honest sign-up, offer and assistant actions have actual destinations',async()=>{
  const [home,support,contact]=await Promise.all([
    'design/marketing/home.html','kamera/support-entry.mjs','kamera/marketing-contact.js'
  ].map(read));
  assert.ok(home.includes('href="panel.html?auth=register"'));
  assert.ok(home.includes('href="kontakt.html?temat=produkt"'));
  assert.ok((await read('kamera/pytania.html')).includes('data-hs-open-support'));
  assert.ok(support.includes("button.click()"));
  assert.ok(contact.includes("chosenTopic==='produkt'"));
});

test('legal pages link related documents and share the public visual system',async()=>{
  for(const file of ['polityka-prywatnosci.html','regulamin.html','rodo.html']){
    const html=await read('kamera/'+file);
    assert.ok(html.includes('legal-premium.css?v=3'),file);
    assert.ok(html.includes('class="legalFooter"'),file);
    assert.ok(html.includes('href="pomoc.html"'),file);
    assert.ok(html.includes('href="#legal-main"'),file);
  }
});

test('registered owners retain direct panel access while visitors see brochure',async()=>{
  const [root,app,sw,version,code]=await Promise.all([
    'index.html','kamera/panel.html','kamera/sw.js','kamera/version.json','kamera/app.js'
  ].map(read));
  assert.ok(root.includes('toPanel ? "./kamera/panel.html" : "./kamera/"'));
  assert.ok(root.includes('["auth","app","view","ui","desktop","bootRetry","theme","start","code","odbiorca","panel"]'));
  assert.ok(app.includes('auth-experience.mjs?v=2'));
  assert.ok(app.includes('auth-experience.css?v=2'));
  assert.ok(sw.includes('auth-experience.mjs?v=2'));
  const build=JSON.parse(version).version;
  assert.ok(app.includes('app.js?v='+build));
  assert.ok(sw.includes('app.js?v='+build));
  assert.ok(code.includes('const VERSION = "'+build+'"'));
});
