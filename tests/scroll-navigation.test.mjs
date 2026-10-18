import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../kamera/app.js',import.meta.url),'utf8');
const css=await readFile(new URL('../kamera/workspace-ui.css',import.meta.url),'utf8');
const start=app.indexOf('  stage.addEventListener("wheel", e => {');
const code=app.slice(start,app.indexOf('  $("zoomIn")',start));
function wheel(overrides={},role='view'){
 let handler,prevented=false,changed=false;
 const ctx=vm.createContext({Math,enabled:true,prefs:{role},max:4,state:{z:1,cx:.5,cy:.5},stage:{addEventListener:(name,fn)=>{handler=fn;}},rect:()=>({left:0,top:0,width:100,height:100}),set:()=>{changed=true;}});
 vm.runInContext(code,ctx);handler({altKey:false,ctrlKey:false,clientX:50,clientY:50,deltaY:100,preventDefault:()=>{prevented=true;},...overrides});return {prevented,changed};
}
test('ordinary wheel over video is not consumed by zoom',()=>{assert.deepEqual(wheel(),{prevented:false,changed:false});assert.deepEqual(wheel({deltaY:-100}),{prevented:false,changed:false});});
test('Alt wheel explicitly zooms camera',()=>assert.deepEqual(wheel({altKey:true}),{prevented:true,changed:true}));
test('Ctrl zoom and transmitter wheel keep default browser behavior',()=>{assert.equal(wheel({altKey:true,ctrlKey:true}).prevented,false);assert.equal(wheel({altKey:true},'send').prevented,false);});
test('archive scrolls as a whole without clipping either column',()=>{assert.match(css,/\.archiveModal\{display:block;[^}]*overflow-y:auto/);assert.match(css,/\.archiveModal \.archiveModalBody\{max-height:none;overflow:visible/);assert.match(css,/\.archiveModal \.archiveWorkspace\{overflow:visible/);});
