import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../kamera/zoom.js',import.meta.url),'utf8');
const {normalize,MAX_ZOOM}=await import('data:text/javascript,'+encodeURIComponent(source));
test('zoom reaches 16x and clamps values safely',()=>{
  assert.equal(MAX_ZOOM,16);
  assert.equal(normalize({z:16}).z,16);
  assert.equal(normalize({z:999}).z,16);
  assert.equal(normalize({z:-1}).z,1);
  assert.equal(normalize({z:Infinity}).z,1);
});
test('zoom preserves edges and allows full frame reset',()=>{
  const edge=normalize({z:16,cx:0,cy:1});
  assert.equal(edge.cx,1/32);assert.equal(edge.cy,31/32);
  assert.deepEqual(normalize({z:1,cx:0,cy:1}),{z:1,cx:.5,cy:.5});
});
