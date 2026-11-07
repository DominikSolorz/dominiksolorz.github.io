import test from 'node:test';import assert from 'node:assert/strict';
import {createPictureInPicture} from '../kamera/picture-in-picture.mjs';
function setup({ready=true,safari=false,standard=true,blocked=false}={}){
 const listeners=new Map(),errors=[],states=[],actions=new Map();let requests=0,exits=0;
 const doc={pictureInPictureEnabled:true,pictureInPictureElement:null,exitPictureInPicture:async()=>{exits++;doc.pictureInPictureElement=null;listeners.get('leavepictureinpicture')?.();}};
 const video={readyState:ready?4:0,videoWidth:ready?1920:0,autoPictureInPicture:false,play:()=>assert.fail('must not await playback before PiP'),addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
 if(standard)video.requestPictureInPicture=()=>{requests++;if(blocked)return Promise.reject(Object.assign(Error('denied'),{name:'NotAllowedError'}));doc.pictureInPictureElement=video;listeners.get('enterpictureinpicture')?.();return Promise.resolve({});};
 if(safari){video.webkitSupportsPresentationMode=()=>true;video.webkitPresentationMode='inline';video.webkitSetPresentationMode=mode=>{requests++;video.webkitPresentationMode=mode;listeners.get('webkitpresentationmodechanged')?.();};}
 const mediaSession={setActionHandler:(action,handler)=>actions.set(action,handler)};
 const client=createPictureInPicture(video,{doc,mediaSession,onError:e=>errors.push(e),onState:s=>states.push(s)});
 return {client,doc,video,errors,states,actions,listeners,requests:()=>requests,exits:()=>exits};
}
test('manual PiP uses the original click without awaiting play and exits only its own video',async()=>{const s=setup();const pending=s.client.toggle();assert.equal(s.requests(),1);await pending;assert.equal(s.client.state().active,true);await s.client.toggle();assert.equal(s.exits(),1);assert.equal(s.client.state().active,false);});
test('Safari native presentation changes update actual PiP state',async()=>{const s=setup({safari:true,standard:false});await s.client.toggle();assert.equal(s.client.state().active,true);await s.client.toggle();assert.equal(s.video.webkitPresentationMode,'inline');});
test('video without received frames never requests PiP',async()=>{const s=setup({ready:false});await s.client.toggle();assert.equal(s.requests(),0);assert.match(s.errors[0],/Poczekaj/);});
test('browser denial is reported without falsely marking PiP active',async()=>{const s=setup({blocked:true});await s.client.toggle();assert.equal(s.client.state().active,false);assert.match(s.errors[0],/System wymaga/);});
test('auto PiP is initiated only by the browser action and can be disabled',async()=>{const s=setup();s.client.setAutomatic(true);assert.equal(s.requests(),0);assert.equal(s.video.autoPictureInPicture,true);s.actions.get('enterpictureinpicture')();await Promise.resolve();assert.equal(s.requests(),1);s.client.setAutomatic(false);s.actions.get('enterpictureinpicture')();await Promise.resolve();assert.equal(s.requests(),1);assert.equal(s.video.autoPictureInPicture,false);});
test('unsupported Safari source is not advertised as supported despite standard API presence',()=>{const s=setup({safari:true});s.video.webkitSupportsPresentationMode=()=>false;assert.equal(s.client.state().supported,false);});
test('disposal clears only controller handlers without stopping or changing the source',()=>{const s=setup();s.client.setAutomatic(true);s.client.dispose();assert.equal(s.listeners.size,0);assert.equal(s.actions.get('enterpictureinpicture'),null);assert.equal(s.requests(),0);});
test('metadata without decoded frames keeps mini window unavailable until loadeddata',()=>{const s=setup();s.video.readyState=1;assert.equal(s.client.state().ready,false);s.video.readyState=2;s.listeners.get('loadeddata')();assert.equal(s.states.at(-1).ready,true);});
test('an unsupported automatic action does not break manual PiP',async()=>{const s=setup();const client=createPictureInPicture(s.video,{doc:s.doc,mediaSession:{setActionHandler(){throw Error('unsupported action');}}});client.setAutomatic(true);assert.equal(client.state().autoHandler,false);await client.toggle();assert.equal(client.state().active,true);});
