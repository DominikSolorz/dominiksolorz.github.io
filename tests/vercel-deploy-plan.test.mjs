import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {deployPlan, PUBLIC_SITE_PATHS} from '../scripts/vercel-deploy-plan.mjs';

const files = ['vercel.json', 'hosting/public-site/build.mjs', 'scripts/optimize-marketing-images.mjs', 'scripts/build-documents.mjs',
  'design/marketing/pages.json', 'design/documents/rodo.html', 'kamera/index.html', 'kamera/blog/index.html', 'kamera/marketing.css',
  'kamera/panel.css', 'kamera/workspace-ui.css', 'kamera/app.js', 'kamera/sw.js', 'kamera/marketing-start.mjs',
  'kamera/core/update-navigation.mjs', 'kamera/assets/logo.webp', 'docs/ui-193/01.png', 'README.md', 'desktop-client/Program.cs'];

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'vercel-plan-'));
  const git = (...a) => execFileSync('git', a, {cwd: dir, encoding: 'utf8'}).trim();
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  for (const f of files) { mkdirSync(join(dir, dirname(f)), {recursive: true}); writeFileSync(join(dir, f), 'a\n'); }
  git('add', '-A'); git('commit', '-qm', 'base');
  const commit = (...changed) => { for (const f of changed) appendFileSync(join(dir, f), 'x\n'); git('add', '-A'); git('commit', '-qm', 'c'); return git('rev-parse', 'HEAD'); };
  return {dir, git, commit, head: () => git('rev-parse', 'HEAD'), done: () => rmSync(dir, {recursive: true, force: true})};
}

test('every listed public path exists in the repository', () => {
  const root = new URL('..', import.meta.url).pathname;
  const listed = execFileSync('git', ['ls-files', '--', ...PUBLIC_SITE_PATHS], {cwd: root, encoding: 'utf8'}).trim().split('\n');
  for (const p of ['vercel.json', 'hosting/public-site/build.mjs', 'kamera/index.html', 'kamera/marketing.css', 'scripts/optimize-marketing-images.mjs'])
    assert(listed.includes(p), `public site path not matched: ${p}`);
  assert(!listed.includes('kamera/panel.css') && !listed.includes('kamera/app.js'), 'private panel files must not trigger Vercel');
  assert(!listed.some(p => p.startsWith('kamera/updates/') || p.startsWith('kamera/downloads/')), 'release binaries are never part of the website');
});

test('all commits since the base are compared, not only the last one', () => {
  const r = repo(); try {
    const base = r.head(); r.commit('kamera/index.html'); r.commit('README.md');
    assert.equal(deployPlan({base, cwd: r.dir}).deploy, true);
  } finally { r.done(); }
});

test('private panel, app code and docs alone do not deploy', () => {
  const r = repo(); try {
    const base = r.head(); r.commit('kamera/panel.css', 'kamera/workspace-ui.css', 'kamera/app.js', 'kamera/sw.js', 'README.md', 'desktop-client/Program.cs');
    const plan = deployPlan({base, cwd: r.dir});
    assert.equal(plan.deploy, false, plan.reason);
  } finally { r.done(); }
});

test('each public-site input deploys', () => {
  for (const f of ['vercel.json', 'hosting/public-site/build.mjs', 'scripts/optimize-marketing-images.mjs', 'scripts/build-documents.mjs',
    'design/marketing/pages.json', 'design/documents/rodo.html', 'kamera/blog/index.html', 'kamera/marketing.css', 'kamera/marketing-start.mjs',
    'kamera/core/update-navigation.mjs', 'kamera/assets/logo.webp', 'docs/ui-193/01.png']) {
    const r = repo(); try {
      const base = r.head(); r.commit(f);
      assert.equal(deployPlan({base, cwd: r.dir}).deploy, true, f);
    } finally { r.done(); }
  }
});

test('missing or unknown base commit always deploys', () => {
  const r = repo(); try {
    assert.equal(deployPlan({base: '', cwd: r.dir}).deploy, true);
    assert.equal(deployPlan({base: '0123456789abcdef0123456789abcdef01234567', cwd: r.dir}).deploy, true);
  } finally { r.done(); }
});

test('workflow always reports a result and never filters by paths', () => {
  const wf = readFileSync(new URL('../.github/workflows/vercel-deploy.yml', import.meta.url), 'utf8');
  assert(!/^\s+paths:/m.test(wf), 'a paths filter would leave the check Pending on unrelated PRs');
  assert(wf.includes('!/kamera/updates/**') && wf.includes('!/kamera/downloads/**'), 'release binaries must stay out of the checkout');
  assert(wf.includes('vercel deploy --prebuilt'));
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.git?.deploymentEnabled, false, 'Vercel must not clone the 17 GB repository itself');
});
