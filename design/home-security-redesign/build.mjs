// Buduje index.html projektu graficznego z index.template.html.
// Treści prawne i dane kontaktowe są kopiowane 1:1 z design/documents,
// żeby projekt nie zmieniał znaczenia zatwierdzonych dokumentów.
// Użycie: node design/home-security-redesign/build.mjs [--check]
import { readFile, writeFile } from 'node:fs/promises';

const here = new URL('./', import.meta.url);
const docs = new URL('../documents/', import.meta.url);
const check = process.argv.includes('--check');
const publish = process.argv.includes('--publish');
const LIVE = 'https://dominiksolorz.github.io/kamera/';

const escape = v => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
// Odnośniki względne w dokumentach (np. "instrukcja.html") prowadzą do opublikowanej strony.
const absolutize = html => html.replace(/href="(?!https?:|mailto:|tel:|#)([^"]+)"/g, (_, p) => `href="${LIVE}${p}"`);
// Trzy dokumenty na jednej stronie: identyfikatory sekcji z przedrostkiem dokumentu (bez zmiany treści).
const scopeIds = (html, slug) => html.replace(/ id="([^"]+)"/g, (_, id) => ` id="${slug}-${id}"`);

let html = (await readFile(new URL('index.template.html', here), 'utf8')).replaceAll('\r\n', '\n');
const operator = JSON.parse(await readFile(new URL('operator.json', docs), 'utf8'));
for (const slug of ['polityka-prywatnosci', 'rodo', 'regulamin']) {
  const body = (await readFile(new URL(slug + '.html', docs), 'utf8')).replaceAll('\r\n', '\n').trim();
  html = html.replace(`<!--DOC:${slug}-->`, `\n<!-- BEGIN design/documents/${slug}.html -->\n${scopeIds(absolutize(body), slug)}\n<!-- END design/documents/${slug}.html -->\n`);
}
html = html.replace(/<!--OPERATOR:(\w+)-->/g, (_, k) => escape(operator[k] ?? ''));
if (/<!--(DOC|OPERATOR):/.test(html)) throw new Error('Niewypełniony znacznik w szablonie');

const out = new URL('index.html', here);
if (check) {
  const current = (await readFile(out, 'utf8')).replaceAll('\r\n', '\n');
  if (current !== html) throw new Error('index.html jest nieaktualny — uruchom build.mjs');
  console.log('Projekt graficzny: index.html aktualny.');
} else {
  await writeFile(out, html);
  console.log('Projekt graficzny: zapisano index.html.');
}

// --publish: kopia do kamera/projekt/ (publiczny podgląd demo na GitHub Pages).
if (publish) {
  const { mkdir, copyFile, readdir } = await import('node:fs/promises');
  const dest = new URL('../../kamera/projekt/', import.meta.url);
  await mkdir(new URL('assets/', dest), { recursive: true });
  for (const f of ['index.html', 'style.css', 'app.js']) await copyFile(new URL(f, here), new URL(f, dest));
  for (const f of await readdir(new URL('assets/', here))) await copyFile(new URL('assets/' + f, here), new URL('assets/' + f, dest));
  console.log('Projekt graficzny: opublikowano kopię w kamera/projekt/.');
}
