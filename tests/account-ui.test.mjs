import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { profileRows, mountAccountUI, validateProfile } from '../kamera/account-ui.mjs';
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
 let loads=0,signouts=0,error='',saved=0,failSave=false, resetFor=null, pinChange=null;
 try {
  globalThis.document={body:root,createElement:tag=>new Element(tag),getElementById:()=>logout,querySelector:s=>s==='.topbar .nav'?nav:null};
  globalThis.confirm=()=>true;
  mountAccountUI({loadProfile:async()=>{loads++;return {user:{id:'owner',email:'own@example.invalid'},profile:{first_name:'<img src=x>'}};},saveProfile:async(values,id)=>{assert.equal(id,'owner');saved++;if(failSave)throw Error('offline');return {user:{id:'owner',email:'own@example.invalid'},profile:values};},requestReset:async id=>{resetFor=id;},changePin:async (...args)=>{pinChange=args;},logout:async()=>{signouts++;throw Error('offline');},onError:msg=>error=msg});
  nav.children[0].children[0].handlers.click(); await new Promise(resolve=>setImmediate(resolve));
  const dialog=root.children[0];assert.equal(dialog.open,true);assert.equal(loads,1);
  const all=n=>[n,...n.children.flatMap(all)];
  const details=all(dialog).find(n=>n.tag==='dl');assert.equal(details.children[0].children[1].textContent,'<img src=x>');
  const edit=all(dialog).find(n=>n.textContent==='Edytuj dane');edit.handlers.click();
  const fields=all(dialog).filter(n=>n.tag==='input');const values={first_name:'Jan',last_name:'Test',phone:'',address_line:'Adres',postal_code:'40-001'};
  fields.forEach(input=>input.value=values[input.name]);
  const form=all(dialog).find(n=>n.tag==='form');
  failSave=true;await form.handlers.submit({preventDefault(){}});assert.equal(form.hidden,false);assert.equal(fields[0].value,'Jan');
  failSave=false;await form.handlers.submit({preventDefault(){}});assert.equal(saved,2);assert.equal(form.hidden,true);assert.equal(details.children[0].children[1].textContent,'Jan');
  await all(dialog).find(n=>n.textContent==='Zmień hasło — wyślij link').handlers.click();assert.equal(resetFor,'owner');
  all(dialog).find(n=>n.textContent==='Zmień PIN').handlers.click();
  const pinForm=all(dialog).find(n=>n.className==='profilePinForm');const pins=pinForm.children.filter(n=>n.tag==='label').map(n=>n.children[0]);
  [pins[0].value,pins[1].value,pins[2].value]=['123456','987654','987654'];
  await pinForm.handlers.submit({preventDefault(){}});assert.deepEqual(pinChange,['123456','987654','owner']);assert.ok(pins.every(n=>n.value===''));assert.equal(pinForm.hidden,true);
  all(dialog).find(n=>n.textContent==='Wróć do panelu').handlers.click();
  assert.equal(dialog.open,false);assert.equal(signouts,0);assert.equal(details.children.length,0);
  await logout.handlers.click();assert.equal(signouts,1);assert.equal(logout.disabled,false);assert.ok(error);
 } finally {globalThis.document=oldDoc;globalThis.confirm=oldConfirm;}
});
test('profile validates editable fields without permitting identity or security updates',()=>{
 const fields={first_name:' Jan ',last_name:'Test',address_line:'Adres',postal_code:'40-001',phone:'',user_id:'other',pin_hash:'bad',email:'other@example.invalid'};
 const data=validateProfile(fields);assert.equal(data.first_name,'Jan');assert.equal(data.phone,null);assert.equal(data.user_id,undefined);assert.equal(data.email,undefined);assert.equal(data.pin_hash,undefined);
 assert.throws(()=>validateProfile({...fields,postal_code:'bad'}));assert.throws(()=>validateProfile({...fields,first_name:''}));
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
