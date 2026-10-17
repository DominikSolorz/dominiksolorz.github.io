import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { profileRows, mountAccountUI } from '../kamera/account-ui.mjs';
test('profile exposes only display fields, never credentials or tokens', () => {
 const user={email:'test@example.invalid',email_confirmed_at:'2026-01-01',access_token:'secret'};
 const p={first_name:'Jan',last_name:'Test',phone:'123',pin_hash:'sensitive',password:'password'};
 const rows=profileRows(user,p);
 assert.equal(rows[0][1],'Jan'); assert.equal(rows[2][1],user.email);
 assert.equal(rows[4][1],'Nie podano');
 assert.ok(!JSON.stringify(rows).includes('secret'));assert.ok(!JSON.stringify(rows).includes('sensitive'));
});
test('profile button fetches account, closes without engine action and logout handles failure', async () => {
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.handlers={};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(){}
  addEventListener(name,fn){this.handlers[name]=fn;}
  showModal(){this.open=true;}
  close(){this.open=false;this.handlers.close?.();}
  focus(){}
 }
 const root=new Element('body'), nav=new Element('nav'), logout=new Element('button');
 const oldDoc=globalThis.document,oldConfirm=globalThis.confirm;
 let loads=0,signouts=0,error='';
 try {
  globalThis.document={body:root,createElement:tag=>new Element(tag),getElementById:()=>logout,querySelector:s=>s==='.mobileAppHeader'?null:nav};
  globalThis.confirm=()=>true;
  mountAccountUI({loadProfile:async()=>{loads++;return {user:{email:'own@example.invalid'},profile:{first_name:'<img src=x>'}};},logout:async()=>{signouts++;throw Error('offline');},onError:msg=>error=msg});
  nav.children[0].children[0].handlers.click(); await new Promise(resolve=>setImmediate(resolve));
  const dialog=root.children[0];assert.equal(dialog.open,true);assert.equal(loads,1);
  const details=dialog.children.find(n=>n.tag==='dl');assert.equal(details.children[0].children[1].textContent,'<img src=x>');
  dialog.children.find(n=>n.textContent==='Zamknij profil').handlers.click();
  assert.equal(dialog.open,false);assert.equal(signouts,0);assert.equal(details.children.length,0);
  await logout.handlers.click();assert.equal(signouts,1);assert.equal(logout.disabled,false);assert.ok(error);
 } finally {globalThis.document=oldDoc;globalThis.confirm=oldConfirm;}
});
test('profile renders text safely and logout finalizes before signout', async () => {
 const ui=await readFile(new URL('../kamera/account-ui.mjs',import.meta.url),'utf8');
 const app=await readFile(new URL('../kamera/app.js',import.meta.url),'utf8');
 assert.ok(!ui.includes('innerHTML')); assert.ok(ui.includes('dd.textContent = value'));
 const action=app.slice(app.indexOf('logout: async () =>'));
 assert.ok(action.indexOf('await archive.prepareUpdate()')<action.indexOf('auth.signOut'));
 assert.ok(action.includes('scope: "local"'));assert.ok(action.includes('archive.abortUpdate()'));
 assert.ok(!app.includes('Zablokować stronę na tym urządzeniu?'));
});
