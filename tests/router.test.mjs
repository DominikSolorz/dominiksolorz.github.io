import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../kamera/core/router.mjs';

test('rejects unknown routes without rendering or changing store', () => {
  const calls = [];
  const router = createRouter({routes:['home','recordings'],render:(...args)=>calls.push(args),store:{route:r=>calls.push(['store',r])}});
  assert.equal(router.navigate('stop-camera'),false);
  assert.equal(router.current,null);
  assert.deepEqual(calls,[]);
});

test('passes previous route and updates store after rendering', () => {
  const calls = [];
  const router = createRouter({routes:['home','recordings'],render:(...args)=>calls.push(['render',...args]),store:{route:r=>calls.push(['store',r])}});
  assert.equal(router.navigate('home'),true);
  assert.equal(router.navigate('recordings'),true);
  assert.equal(router.current,'recordings');
  assert.deepEqual(calls,[['render','home',null],['store','home'],['render','recordings','home'],['store','recordings']]);
});

test('render failure does not commit a new route', () => {
  const calls = [];
  const router = createRouter({routes:['home','recordings'],render:r=>{if(r==='recordings')throw Error('render failed');},store:{route:r=>calls.push(r)}});
  router.navigate('home');
  assert.throws(()=>router.navigate('recordings'),/render failed/);
  assert.equal(router.current,'home');
  assert.deepEqual(calls,['home']);
});
