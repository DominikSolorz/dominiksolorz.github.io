// Kontrola projektu graficznego: node design/home-security-redesign/verify.mjs
// Sprawdza, że projekt jest samodzielny, oznacza dane DEMO, nie wysyła danych
// i kopiuje treści prawne 1:1 z design/documents.
import { readFile, readdir, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';

const here = new URL('./', import.meta.url);
const read = name => readFile(new URL(name, here), 'utf8');
const [html, js, css] = await Promise.all([read('index.html'), read('app.js'), read('style.css')]);
let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log('✓ ' + name); };

ok('21 ekranów z makiet', () => {
  const screens = [...html.matchAll(/data-screen="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(screens).size, 21, screens.join(','));
  const links = [...html.matchAll(/<nav class="screensPanel"[\s\S]*?<\/nav>/g)][0][0];
  for (const s of screens) assert.ok(links.includes(`href="#${s}"`), 'brak w spisie ekranów: ' + s);
});

ok('wersja demonstracyjna jest oznaczona', () => {
  assert.match(html, /WERSJA DEMONSTRACYJNA/);
  assert.ok((html.match(/class="demo[ "]/g) || []).length >= 15, 'za mało znaczników DEMO');
  assert.match(js, /<span class="demo">DEMO<\/span>/);
  for (const f of ['loginForm', 'registerForm', 'contactForm']) assert.ok(html.includes(`id="${f}"`));
  assert.match(html, /Ten ekran nie loguje do prawdziwego konta/);
  assert.match(html, /Rejestracja nie tworzy prawdziwego konta/);
  assert.match(html, /PIN nie jest sprawdzany ani zapisywany/);
});

ok('brak żądań sieciowych i zewnętrznych zasobów', () => {
  assert.doesNotMatch(js, /\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|supabase|getUserMedia/i);
  assert.doesNotMatch(css, /@import|url\(\s*["']?https?:/i);
  assert.doesNotMatch(html, /<script[^>]+src="https?:|<link[^>]+href="https?:[^"]+\.css/i);
});

ok('bez nieprawdziwych obietnic z makiet', () => {
  const text = html.replace(/<!-- BEGIN[\s\S]*?END [^>]+-->/g, '');
  for (const bad of [/ochrona 24\/7/i, /50 000\+/, /4,9\/5/, /Wypróbuj za darmo/i, /homesecurity\.pl/i, /\+48 (22|800)/, /Marta K\./, /Pobierz w App Store/i, /Aivo/i])
    assert.doesNotMatch(text, bad, String(bad));
  assert.match(text, /aplikacja sklepowa nie jest jeszcze opublikowana/i);
});

const absolutize = s => s.replace(/href="(?!https?:|mailto:|tel:|#)([^"]+)"/g, (_, p) => `href="https://dominiksolorz.github.io/kamera/${p}"`);
for (const slug of ['polityka-prywatnosci', 'rodo', 'regulamin']) {
  const src = (await readFile(new URL(`../documents/${slug}.html`, here), 'utf8')).replaceAll('\r\n', '\n').trim();
  const m = html.match(new RegExp(`<!-- BEGIN design/documents/${slug}\\.html -->\\n([\\s\\S]*?)\\n<!-- END`));
  assert.ok(m, 'brak dokumentu ' + slug);
  assert.equal(m[1], absolutize(src), 'treść dokumentu różni się od źródła: ' + slug);
}
console.log('✓ treści prawne skopiowane 1:1 z design/documents');
const operator = JSON.parse(await readFile(new URL('../documents/operator.json', here), 'utf8'));
assert.ok(html.includes(`mailto:${operator.email}`) && html.includes(`tel:${operator.phone}`), 'dane kontaktowe niezgodne z operator.json');
console.log('✓ dane kontaktowe z operator.json');

const assets = await readdir(new URL('assets/', here));
let total = 0;
for (const a of assets) { assert.match(a, /^demo-[\w-]+\.webp$/, a); total += (await stat(new URL('assets/' + a, here))).size; }
for (const m of (css + html + js).matchAll(/assets\/([\w-]+\.webp)/g)) assert.ok(assets.includes(m[1]), 'brak pliku ' + m[1]);
assert.ok(total < 600_000, 'grafiki za ciężkie: ' + total);
console.log(`✓ grafiki DEMO (${assets.length} plików, ${Math.round(total / 1024)} KB)`);
console.log(`Wynik: ${passed + 3} kontroli zaliczonych.`);
