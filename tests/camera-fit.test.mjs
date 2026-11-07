import test from 'node:test';import assert from 'node:assert/strict';
import {fitAction,applyCameraFit} from '../kamera/camera-fit.mjs';
test('fit label describes the next action rather than the current mode',()=>{
 assert.equal(fitAction('contain',true).label,'⛶ Wypełnij');
 assert.equal(fitAction('cover',true).next,'contain');
 assert.match(fitAction('cover',true).description,/wyzeruj/);
 assert.equal(fitAction('cover',false).next,'fill');
});
test('fit changes only presentation and preserves the supplied controls',()=>{
 const modes=new Set();const stage={classList:{toggle:(name,on)=>on?modes.add(name):modes.delete(name)}};
 const button={dataset:{},setAttribute(name,value){this[name]=value;}};
 const fullscreenButton={dataset:{},setAttribute(name,value){this[name]=value;}};
 applyCameraFit({stage,button,fullscreenButton,mode:'cover',mobile:true});
 assert.deepEqual([...modes],['fit-cover']);assert.equal(button.textContent,'▣ Cały kadr');
 assert.equal(fullscreenButton.dataset.fit,'cover');
 applyCameraFit({stage,button,fullscreenButton,mode:'contain',mobile:true});
 assert.deepEqual([...modes],['fit-contain']);assert.equal(button.textContent,'⛶ Wypełnij');
});
