import test from 'node:test';
import assert from 'node:assert/strict';
import {createRemoteFolderPicker} from '../kamera/remote-folder-ui.mjs';
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.events=new Map();this.dataset={};this.textContent='';}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  addEventListener(type,fn){this.events.set(type,fn);}
  setAttribute(name,value){this[name]=value;}
  removeAttribute(name){delete this[name];}
  showModal(){this.open=true;}
  close(){this.open=false;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
  focus(){}
  async click(){if(!this.disabled)await this.events.get('click')?.();}
}
function dom(){const body=new Element('body');globalThis.document={body,createElement:tag=>new Element(tag)};const all=(node=body)=>[node,...node.children.flatMap(child=>all(child))];return{body,find:text=>all().find(node=>node.tag==='button'&&node.textContent===text),all};}

test('remote deletion requires confirmation and returns to parent',async()=>{const d=dom(),calls=[];globalThis.confirm=()=>false;const picker=createRemoteFolderPicker({execute:async(name,args)=>{calls.push({name,args});return{root:'Host',path:args.folderPath,entries:args.folderPath.length?[]:[{name:'empty'}],nextOffset:null};}});await picker.open();assert.equal(d.find('Usuń ten pusty folder').disabled,true);await d.find('📁 empty').click();await d.find('Usuń ten pusty folder').click();assert.equal(calls.some(x=>x.name==='folder-delete-empty'),false);globalThis.confirm=()=>true;await d.find('Usuń ten pusty folder').click();assert.deepEqual(calls.find(x=>x.name==='folder-delete-empty').args,{folderPath:['empty']});assert.equal(d.find('Usuń ten pusty folder').disabled,true);delete globalThis.confirm;});
test('remote picker navigates host folder and selects it',async()=>{const d=dom(),calls=[];let selected;const picker=createRemoteFolderPicker({execute:async(name,args)=>{calls.push({name,args});return name==='folder-select'?{name:'child'}:{root:'Host folder',path:args.folderPath,entries:args.folderPath.length?[]:[{name:'child'}],nextOffset:null};},onSelected:value=>selected=value});await picker.open();await d.find('📁 child').click();await d.find('Wybierz ten folder').click();assert.deepEqual(calls.at(-1),{name:'folder-select',args:{folderPath:['child']}});assert.equal(selected.name,'child');assert.equal(d.body.children.length,0);});
test('remote picker creates a folder through host command, not phone filesystem',async()=>{const d=dom(),calls=[];const picker=createRemoteFolderPicker({execute:async(name,args)=>{calls.push({name,args});return{root:'Host',path:args.folderPath,entries:[],nextOffset:null};}});await picker.open();d.all().find(node=>node.tag==='input').value='new-folder';await d.find('Utwórz folder').click();assert.deepEqual(calls.find(call=>call.name==='folder-create'),{name:'folder-create',args:{folderPath:[],folderName:'new-folder'}});});
test('offline host does not enable folder selection or pretend success',async()=>{const d=dom();const picker=createRemoteFolderPicker({execute:async()=>{const error=new Error('offline');error.uncertain=true;throw error;}});await picker.open();assert.equal(d.find('Wybierz ten folder').disabled,true);assert.ok(d.all().some(node=>node.textContent.includes('Komputer nie potwierdził operacji')));assert.ok(d.all().some(node=>node.textContent==='Foldery niedostępne'));});
