import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('production Lighthouse measures published GitHub Pages independently of optional Vercel deployments',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/pagespeed-audit.yml',import.meta.url),'utf8');
  const gate=workflow.slice(workflow.indexOf('      - name: Wait for GitHub Pages'),workflow.indexOf('      - name: Audit actual published site'));
  assert.ok(gate.startsWith('      - name: Wait for GitHub Pages'));
  assert.ok(gate.includes('kamera/version.json'));
  assert.ok(gate.includes('home-security-build'));
  assert.ok(gate.includes('home-security-hero-640.webp'));
  assert.ok(gate.includes('dominiksolorz.github.io/kamera/o-systemie.html'));
  assert.ok(!gate.includes('home-security-dominik-solorz.vercel.app'),'unrelated mirrors may deploy independently');
  assert.ok(!gate.includes('public_build'),'audit must not require a Vercel release to match the Pages build');
  assert.ok(workflow.includes('lighthouse "https://dominiksolorz.github.io/kamera/o-systemie.html"'));
  assert.ok(workflow.includes('home-security-lighthouse-reports'));
});
