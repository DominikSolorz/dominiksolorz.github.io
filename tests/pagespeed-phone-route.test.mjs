import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('phone app entry intentionally stays out of Google; the public product page is indexed',async()=>{
 const [app,publicPage,robots,sitemap]=await Promise.all([
  read('kamera/index.html'),read('kamera/o-systemie.html'),
  read('robots.txt'),read('kamera/sitemap.xml')
 ]);
 assert.match(app,/<meta name="robots" content="noindex,follow">/);
 assert.match(publicPage,/<meta name="robots" content="index,follow">/);
 assert.match(publicPage,/<link rel="canonical" href="https:\/\/dominiksolorz\.github\.io\/kamera\/o-systemie\.html">/);
 assert.ok(sitemap.includes('https://dominiksolorz.github.io/kamera/o-systemie.html'));
 assert.ok(!sitemap.includes('/kamera/index.html'));
 assert.ok(!sitemap.includes('ui=phone'));
 assert.ok(!/Disallow:\s*\/kamera\/o-systemie\.html/.test(robots));
});

test('Lighthouse publishes independent desktop and mobile results for the exact PageSpeed URL',async()=>{
 const [workflow,summary]=await Promise.all([
  read('.github/workflows/pagespeed-audit.yml'),read('scripts/summarize-lighthouse.mjs')
 ]);
 assert.equal((workflow.match(/lighthouse "https:\/\/dominiksolorz\.github\.io\/kamera\/\?ui=phone"/g)||[]).length,2);
 assert.ok(workflow.includes('lighthouse-results/phone-desktop.json'));
 assert.ok(workflow.includes('lighthouse-results/phone-mobile.json'));
 assert.ok(summary.includes("['Panel /kamera/?ui=phone — desktop'") ||
           summary.includes("['Panel /kamera/?ui=phone — desktop'".slice(1)));
 assert.ok(summary.includes('phone-mobile.json'));
 assert.ok(summary.includes('deliberately uses noindex'));
});
