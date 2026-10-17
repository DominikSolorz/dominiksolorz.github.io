import test from 'node:test';
import assert from 'node:assert/strict';
import {filterCameraEvents,diagnosticCards,validThumbnail,mirrorLivePreview,captureEventFrame,mountEventWorkspace,mountDiagnosticWorkspace} from '../kamera/workspace-panels.mjs';
import {createStore} from '../kamera/core/store.mjs';

class TestElement {
 constructor(tag){this.tag=tag;this.children=[];this.textContent='';this.value='';this.dataset={};this.handlers=new Map();const classes=new Set();this.classList={toggle:(name,on)=>on?classes.add(name):classes.delete(name)};}
 append(...items){for(const item of items){item.parent=this;this.children.push(item);}}
 replaceChildren(...items){this.children=[];this.append(...items);}
 setAttribute(name,value){this[name]=value;}
 addEventListener(name,fn){this.handlers.set(name,fn);}
 click(){if(!this.disabled)this.handlers.get('click')?.();}
 change(){this.handlers.get('change')?.();}
}
function testDocument(){globalThis.document={createElement:tag=>new TestElement(tag)};const root=new TestElement('main');const all=(n=root)=>[n,...n.children.flatMap(c=>all(c))];return{root,all};}

test('real event workspace opens details, acknowledges, filters and preserves events',()=>{
 const dom=testDocument(),store=createStore();const dispose=mountEventWorkspace(dom.root,{store});const at=new Date(2026,9,17,10).getTime();
 store.component('cameraEvents',{items:[{at,kind:'ruch'},{at:at+1000,kind:'dzwiek'}]});
 const buttons=()=>dom.all().filter(n=>n.className==='eventWorkspaceRow');assert.equal(buttons().length,2);buttons()[0].click();
 const ack=dom.all().find(n=>n.tag==='button'&&n.textContent==='Oznacz jako przeczytane');assert.ok(ack);ack.click();
 assert.equal(store.snapshot().components.cameraEvents.items.length,2);
 const checks=dom.all().filter(n=>n.type==='checkbox');checks[0].checked=false;checks[0].change();assert.equal(buttons().length,1);
 const date=dom.all().find(n=>n.type==='date');date.value='2026-10-16';date.change();assert.equal(buttons().length,0);dispose();delete globalThis.document;
});
test('diagnostic workspace renders real store events and filters component log',()=>{
 const dom=testDocument(),store=createStore();const dispose=mountDiagnosticWorkspace(dom.root,{store});
 store.event({component:'webrtc',level:'warning',message:'ICE 701'});store.event({component:'storage',level:'info',message:'File saved'});
 const body=dom.all().find(n=>n.tag==='tbody');assert.equal(body.children.length,2);
 const filter=dom.all().find(n=>n.tag==='select');filter.value='storage';filter.change();assert.equal(body.children.length,1);assert.equal(body.children[0].children.at(-1).textContent,'File saved');dispose();delete globalThis.document;
});
test('event filters retain only actual selected kind and local date',()=>{
 const at=new Date(2026,9,17,10).getTime();
 const items=[{at,kind:'ruch'},{at:at+100,kind:'dzwiek'},{at,kind:'car'},{at:NaN,kind:'ruch'}];
 assert.equal(filterCameraEvents(items).length,2);
 assert.equal(filterCameraEvents(items,{sound:false,date:'2026-10-17'}).length,1);
 assert.equal(filterCameraEvents(items,{date:'2026-10-16'}).length,0);
});
test('diagnostic missing and stale telemetry do not claim healthy',()=>{
 assert.ok(diagnosticCards({components:{}},100000).every(c=>c.state==='unknown'));
 const cards=diagnosticCards({components:{capture:{observedAt:1,status:'track_live'},cloudAccess:{observedAt:1,status:'auth_required',message:'Expired'}}},100000);
 assert.equal(cards[0].state,'stale');assert.equal(cards[4].state,'auth_required');
});
test('ICE route comes from peer telemetry not an ICE warning log',()=>{
 const cards=diagnosticCards({components:{'webrtc:x':{observedAt:1000,status:'connected',route:'host → relay'}}},2000);
 assert.equal(cards[3].state,'connected');assert.equal(cards[3].detail,'host → relay');
});
test('thumbnail accepts bounded JPEG data only',()=>{
 assert.equal(validThumbnail('data:image/jpeg;base64,YWJj'),true);
 for(const value of ['https://example.com/photo.jpg','javascript:alert(1)','data:image/svg+xml;base64,YWJj','data:image/jpeg;base64,'+'a'.repeat(80000)])assert.equal(validThumbnail(value),false);
 assert.equal(captureEventFrame({readyState:0,videoWidth:0}),null);
});
test('mirror shares stream without capture or track stops and cleans timer',()=>{
 let stopped=0;const stream={getTracks:()=>[{stop:()=>stopped++}]};
 const source={srcObject:stream,readyState:2,addEventListener(){},removeEventListener(){}};
 const target={srcObject:null,paused:true,play:async()=>{target.paused=false;}};const placeholder={hidden:false};
 const dispose=mirrorLivePreview(source,target,placeholder);
 assert.equal(target.srcObject,stream);assert.equal(placeholder.hidden,true);dispose();assert.equal(stopped,0);assert.equal(source.srcObject,stream);
});
