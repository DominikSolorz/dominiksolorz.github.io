// Decides whether a commit changes the public website published on Vercel.
// Used by .github/workflows/vercel-deploy.yml; never deploys anything itself.
// Any uncertainty (missing base commit, git error) means "deploy".
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Everything `node hosting/public-site/vercel-build.mjs` reads, plus the generators
// whose committed output it publishes. Keep in sync with hosting/public-site/build.mjs.
export const PUBLIC_SITE_PATHS = [
  'vercel.json',
  'hosting/public-site',
  'scripts/optimize-marketing-images.mjs',
  'scripts/build-marketing.mjs',
  'scripts/build-documents.mjs',
  'scripts/vercel-deploy-plan.mjs',
  '.github/workflows/vercel-deploy.yml',
  'design/marketing/pages.json',
  'design/documents',
  'kamera/*.html',
  'kamera/*.css',
  ':!kamera/panel.css',
  ':!kamera/workspace-ui.css',
  'kamera/marketing-*.mjs',
  'kamera/android-install.mjs',
  'kamera/core',
  'kamera/assets',
  'kamera/icons',
  'docs/ui-193',
];

const git = (args, cwd) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();

export function deployPlan({base, head = 'HEAD', cwd = process.cwd()}) {
  if (!/^[0-9a-f]{40}$/i.test(base || '')) return {deploy: true, reason: 'brak commita bazowego — wdrażam'};
  try {
    git(['cat-file', '-e', `${base}^{commit}`], cwd);
  } catch {
    try { git(['fetch', '--quiet', '--filter=blob:none', '--depth=1', 'origin', base], cwd); }
    catch { return {deploy: true, reason: `commit bazowy ${base.slice(0, 8)} niedostępny — wdrażam`}; }
  }
  let changed;
  try { changed = git(['diff', '--name-only', base, head, '--', ...PUBLIC_SITE_PATHS], cwd); }
  catch { return {deploy: true, reason: 'nie udało się porównać zmian — wdrażam'}; }
  const files = changed ? changed.split('\n') : [];
  return files.length
    ? {deploy: true, reason: `zmiany publicznej strony od ${base.slice(0, 8)}: ${files.slice(0, 5).join(', ')}${files.length > 5 ? ' …' : ''}`, files}
    : {deploy: false, reason: `brak zmian publicznej strony od ${base.slice(0, 8)}`, files};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const plan = deployPlan({base: process.env.DEPLOY_BASE_SHA, head: process.env.DEPLOY_HEAD_SHA || 'HEAD'});
  console.log(`Vercel: ${plan.deploy ? 'WDROŻENIE' : 'POMINIĘTE'} — ${plan.reason}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${plan.deploy}\nreason=${plan.reason.replace(/\n/g, ' ')}\n`);
}
