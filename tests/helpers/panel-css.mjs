// Shared access to the single private-panel stylesheet (kamera/panel.css).
// Former layer files (interface-theme.css, operator-layout.css, …) now live as
// sections of panel.css, marked "(dawniej <plik>)". Tests read those sections so
// their content checks keep guarding the same rules.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
export const read = path => readFile(new URL(path, root), 'utf8');

/** All stylesheet hrefs inside <template id="panelStyles"> of kamera/panel.html. */
export function panelTemplateLinks(html) {
  const template = html.match(/<template id="panelStyles">([\s\S]*?)<\/template>/)?.[1];
  assert.ok(template, 'private panel stylesheet template must exist');
  return [...template.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
}

/** The one versioned panel stylesheet URL, e.g. "panel.css?v=1"; asserts there is exactly one. */
export function panelStylesheet(html) {
  const links = panelTemplateLinks(html);
  assert.equal(links.length, 1, 'the private panel loads exactly one stylesheet');
  assert.match(links[0], /^panel\.css\?v=\d+$/);
  return links[0];
}

/** Text of the panel.css section that replaced a former layer file. */
export async function panelSection(formerFile) {
  const css = await read('kamera/panel.css');
  const marker = '(dawniej ' + formerFile + ')';
  const start = css.indexOf(marker);
  assert.ok(start !== -1, 'panel.css section missing: ' + formerFile);
  const next = css.indexOf('(dawniej ', start + marker.length);
  return css.slice(css.indexOf('*/', start) + 2, next === -1 ? undefined : css.lastIndexOf('/*', next));
}
