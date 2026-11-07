import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const camera = file => readFile(new URL('../kamera/' + file, import.meta.url), 'utf8');

test('Premium Dark Pro loads only inside the existing secure owner panel', async () => {
  const html = await camera('panel.html');
  const match = html.match(/<template id="panelStyles">([\s\S]*?)<\/template>/);
  assert.ok(match, 'existing secure panelStyles template must remain');
  assert.match(match[1], /premium-dark-pro\.css\?v=1/);
  assert.ok(match[1].indexOf('premium-dark-pro.css') > match[1].indexOf('interface-theme.css'));
  assert.doesNotMatch(html.slice(0, match.index), /rel="stylesheet" href="premium-dark-pro\.css/);
  assert.match(html, /id="panelRuntime"/);
  assert.match(html, /id="lock"/);
  assert.match(html, /id="app" hidden/);
  assert.doesNotMatch(html, /src="panel-modern\.html"/);
});

test('Premium Dark Pro never replaces actual recorder and video controls with demo handlers', async () => {
  const html = await camera('panel.html');
  const css = await camera('premium-dark-pro.css');
  for (const id of ['video', 'stage', 'ctrlStart', 'ctrlStop', 'ctrlRestart', 'recBadge', 'recTime',
                    'audioProfilePick', 'archiveInfo', 'mediaPick', 'cameraSelect', 'topStatus']) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing production element: ' + id);
  }
  assert.match(html, /<video id="video" autoplay playsinline muted>/);
  assert.match(css, /#ctrlStart/);
  assert.match(css, /#ctrlStop/);
  assert.match(css, /object-fit:\s*contain/);
  assert.doesNotMatch(css, /object-fit:\s*cover/);
  assert.doesNotMatch(css, /display:\s*none|visibility:\s*hidden/i);
  assert.doesNotMatch(css, /addEventListener|setInterval|startTime\s*=/);
});

test('Premium Dark Pro is strictly scoped and keeps alternative themes intact', async () => {
  const css = await camera('premium-dark-pro.css');
  assert.match(css, /html\.desktopMode:not\(\.policeCommand\):not\(\.usMilitary\) #app/);
  assert.match(css, /html\.mobileOwnerMode:not\(\.policeCommand\):not\(\.usMilitary\) #app/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /#126f58/);
  assert.match(css, /#62263b/);
  assert.doesNotMatch(css, /\n\s*\*\s*\{/);
});

test('PWA and native shell reference the same deployable Premium Dark Pro CSS', async () => {
  const [html, sw, css] = await Promise.all([camera('panel.html'), camera('sw.js'), camera('premium-dark-pro.css')]);
  const path = html.match(/premium-dark-pro\.css\?v=(\d+)/)?.[0];
  assert.equal(path, 'premium-dark-pro.css?v=1');
  assert.ok(sw.includes('./' + path));
  assert.match(sw, /kamera-domowa-shell-v180/);
  assert.match(css, /Premium Dark Pro/);
});
