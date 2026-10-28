import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('public entry directs visitors to marketing while explicit auth links keep the panel',async()=>{
  const rootHtml=await read('index.html');
  assert.ok(rootHtml.includes('new URL(toPanel ? "./kamera/panel.html" : "./kamera/"'));
  assert.ok(rootHtml.includes('"auth","app","view","ui","desktop"'));
  assert.ok(rootHtml.includes('destination.hash = location.hash'));
});

test('conversion buttons lead to registration or a real prefilled contact form',async()=>{
  const html=await read('design/marketing/home.html');
  assert.ok(html.includes('id="zobacz-panel"'));
  assert.ok(html.includes('id="wybierz-start"'));
  assert.ok(html.includes('id="asystent"'));
  assert.ok(html.includes('href="panel.html?auth=register"'));
  assert.ok(html.includes('href="pomoc.html?temat=produkt"'));
  assert.ok(!html.includes('Kup teraz'));
  assert.ok(html.includes('nie transmisja z kamery'));
  const contact=await read('kamera/marketing-contact.js');
  assert.ok(contact.includes("chosenTopic==='produkt'"));
  assert.ok(contact.includes("receipt.status!=='sent'"));
});

test('AI CTA opens real support assistant, not a fake success or access to camera',async()=>{
  const html=await read('design/marketing/home.html');
  const launcher=await read('kamera/support-entry.mjs');
  assert.ok(html.includes('data-hs-open-support'));
  assert.ok(html.includes('Nie podawaj mu haseł, kodów PIN'));
  assert.ok(launcher.includes("link.addEventListener('click',()=>button.click())"));
  assert.ok(launcher.includes("import('./support-view.mjs?v=2')"));
});

test('account modal has a separate UI layer with usable password toggles',async()=>{
  const [html,auth,styles]=await Promise.all([
    read('kamera/panel.html'),read('kamera/auth-experience.mjs'),read('kamera/auth-experience.css')]);
  assert.ok(html.includes('auth-experience.mjs?v=2'));
  assert.ok(html.includes('auth-experience.css?v=2'));
  assert.ok(html.includes('name="terms" type="checkbox" required'));
  assert.ok(html.includes('href="rodo.html"'));
  assert.ok(auth.includes("input.type=visible?'text':'password'"));
  assert.ok(auth.includes("toggle.type='button'"));
  assert.ok(auth.includes("event.key==='Escape'"));
  assert.ok(styles.includes('@media(max-width:600px)'));
});

test('legal documents share a consistent visual layout and practical privacy links',async()=>{
  for(const path of ['polityka-prywatnosci.html','regulamin.html','rodo.html']){
    const html=await read('kamera/'+path);
    assert.ok(html.includes('legal-premium.css?v=2'),path);
    assert.ok(html.includes('class="legalFooter"'),path);
    assert.ok(html.includes('href="pomoc.html"'),path);
  }
  const terms=await read('kamera/regulamin.html');
  assert.ok(terms.includes('nie jest koszykiem ani zamówieniem'));
});

test('CI builds generated pages for both frontend testing and deployment',async()=>{
  const workflow=await read('.github/workflows/pages.yml');
  const generation=(workflow.match(/run: node scripts\/build-marketing\.mjs/g)||[]).length;
  assert.equal(generation,2);
  assert.ok(workflow.indexOf('Generate consistent public marketing pages')<workflow.indexOf('Frontend regression tests'));
  assert.ok(workflow.indexOf('Generate consistent marketing pages for deployment')<workflow.indexOf('Prepare bounded static distribution'));
});
