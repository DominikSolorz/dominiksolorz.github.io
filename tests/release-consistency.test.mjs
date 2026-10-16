import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../kamera/' + path, import.meta.url), 'utf8');
test('release manifest, runtime and HTML/SW agree', async () => {
  const [manifest, app, html, sw, access] = await Promise.all(['version.json','app.js','index.html','sw.js','access.js'].map(read));
  const version = JSON.parse(manifest).version;
  assert.equal(app.match(/const VERSION = "(\d+)"/)[1], version);
  assert.ok(html.includes(`app.js?v=${version}`));
  assert.ok(sw.includes(`app.js?v=${version}`));
  assert.equal(app.match(/SERVICE_WORKER_BUILD = "(\d+)"/)[1], sw.match(/kamera-domowa-shell-v(\d+)/)[1]);
  const auth = html.match(/auth.js\?v=\d+/)[0];
  for (const source of [app,sw,access]) assert.ok(source.includes(auth));
  assert.ok(sw.includes(html.match(/style.css\?v=\d+/)[0]));
});
