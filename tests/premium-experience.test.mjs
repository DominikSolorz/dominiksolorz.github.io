import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async path=>(await readFile(new URL('../'+path,import.meta.url),'utf8')).replaceAll('\r\n','\n');

test('public product story stays identical in the app and indexed landing page',async()=>{
  const [home,index,brochure]=await Promise.all([
    'design/marketing/home.html','kamera/index.html','kamera/o-systemie.html'
  ].map(read));
  const slot=/<section id="publicHome"[\s\S]*?<\/section>(?=\s*<section id="authDialog")/;
  assert.equal(index.match(slot)?.[0],home.trimEnd());
  assert.ok(brochure.includes(home.trimEnd()));
  for(const id of ['zobacz-panel','mozliwosci','wybierz-start','asystent','faq'])
    assert.ok(home.includes('id="'+id+'"'),id);
  assert.ok(home.includes('WIZUALIZACJA INTERFEJSU'));
});

test('honest sign-up, offer and assistant actions have actual destinations',async()=>{
  const [home,support,contact]=await Promise.all([
    'design/marketing/home.html','kamera/support-entry.mjs','kamera/marketing-contact.js'
  ].map(read));
  assert.ok(home.includes('href="./?auth=register"'));
  assert.ok(home.includes('href="pomoc.html?temat=produkt"'));
  assert.ok(home.includes('data-hs-open-support'));
  assert.ok(support.includes("button.click()"));
  assert.ok(contact.includes("chosenTopic==='produkt'"));
});

test('legal pages link related documents and share the public visual system',async()=>{
  for(const file of ['polityka-prywatnosci.html','regulamin.html','rodo.html']){
    const html=await read('kamera/'+file);
    assert.ok(html.includes('legal-premium.css?v=1'),file);
    assert.ok(html.includes('class="legalFooter"'),file);
    assert.ok(html.includes('href="pomoc.html"'),file);
    assert.ok(html.includes('href="#legal-main"'),file);
  }
});

test('registered owners retain direct panel access while visitors see brochure',async()=>{
  const [root,app,sw,version,code]=await Promise.all([
    'index.html','kamera/index.html','kamera/sw.js','kamera/version.json','kamera/app.js'
  ].map(read));
  assert.ok(root.includes('toPanel ? "./kamera/" : "./kamera/o-systemie.html"'));
  assert.ok(root.includes('["auth","app","view","ui","desktop","bootRetry","theme","start"]'));
  assert.ok(app.includes('auth-experience.mjs?v=1'));
  assert.ok(app.includes('auth-experience.css?v=1'));
  assert.ok(sw.includes('auth-experience.mjs?v=1'));
  const build=JSON.parse(version).version;
  assert.ok(app.includes('app.js?v='+build));
  assert.ok(sw.includes('app.js?v='+build));
  assert.ok(code.includes('const VERSION = "'+build+'"'));
});
