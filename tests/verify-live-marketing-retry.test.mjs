import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../scripts/verify-live-marketing.mjs',import.meta.url),'utf8');

test('temporary network failures have a bounded retry',()=>{
  assert.match(source,/attempt<=3/);
  assert.match(source,/attempt===3\)throw error/);
  assert.match(source,/TimeoutError/);
});
test('non-network errors and HTTP failures remain fatal',()=>{
  assert.match(source,/assert\.equal\(response\.status,200/);
  assert.match(source,/if\(!networkError\|\|attempt===3\)throw error/);
});
