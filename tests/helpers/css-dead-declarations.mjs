// Dependency-free detector of CSS declarations that can never apply: the same selector
// redeclares the same property later, in an at-rule context that applies whenever the
// earlier one does, with equal or higher importance. Mirrors the rule used to build
// kamera/panel.css. Supports comments, quoted strings, nested @media/@supports blocks
// and skips @keyframes / @font-face bodies.

const RISKY = /\b(?:d|s|l)v(?:h|w|i|b|min|max)\b|\bcq(?:w|h|i|b|min|max)\b|color-mix\(|oklch\(|oklab\(|\blab\(|\blch\(|light-dark\(|-webkit-|-moz-|-ms-|env\(|anchor\(|round\(|\bsubgrid\b|\bfit-content\(/i;
const norm = s => s.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').trim();

function stripComments(css) {
  let out = '', i = 0, quote = null;
  while (i < css.length) {
    const c = css[i];
    if (quote) { out += c; if (c === '\\') { out += css[i + 1] ?? ''; i += 2; continue; } if (c === quote) quote = null; i++; continue; }
    if (c === '"' || c === "'") { quote = c; out += c; i++; continue; }
    if (c === '/' && css[i + 1] === '*') { const end = css.indexOf('*/', i + 2); i = end === -1 ? css.length : end + 2; out += ' '; continue; }
    out += c; i++;
  }
  return out;
}

// Splits at top-level separators, ignoring quotes and parentheses.
function splitTop(text, sep) {
  const parts = []; let depth = 0, quote = null, cur = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { cur += c; if (c === '\\') { cur += text[++i] ?? ''; continue; } if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (c === sep && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

/** Parses into flat declarations [{ctx:[...], sels:[...], prop, value, important, order}]. */
export function parseDeclarations(source) {
  const css = stripComments(source);
  const decls = []; let order = 0;
  function block(start, ctx, skip) {
    let i = start, prelude = '', quote = null, parenDepth = 0;
    while (i < css.length) {
      const c = css[i];
      if (quote) { prelude += c; if (c === '\\') { prelude += css[i + 1] ?? ''; i += 2; continue; } if (c === quote) quote = null; i++; continue; }
      if (c === '"' || c === "'") { quote = c; prelude += c; i++; continue; }
      if (c === '(') parenDepth++;
      if (c === ')') parenDepth--;
      if (c === ';' && parenDepth === 0) { prelude = ''; i++; continue; } // @charset/@import style statements
      if (c === '}' && parenDepth === 0) return i + 1;
      if (c === '{' && parenDepth === 0) {
        const head = prelude.trim(); prelude = '';
        if (head.startsWith('@')) {
          const name = head.slice(1).split(/[\s(]/)[0].toLowerCase();
          const nested = /^(media|supports|layer|container|document)$/.test(name);
          if (nested) { i = block(i + 1, [...ctx, '@' + name + ' ' + norm(head.slice(1 + name.length)).toLowerCase()], skip); continue; }
          i = block(i + 1, ctx, true); continue; // keyframes, font-face, page: not analysed
        }
        // rule body: find matching close brace
        let j = i + 1, q = null, d = 0, body = '';
        for (; j < css.length; j++) {
          const ch = css[j];
          if (q) { body += ch; if (ch === '\\') { body += css[++j] ?? ''; continue; } if (ch === q) q = null; continue; }
          if (ch === '"' || ch === "'") { q = ch; body += ch; continue; }
          if (ch === '(') d++;
          if (ch === ')') d--;
          if (ch === '}' && d === 0) break;
          body += ch;
        }
        if (!skip) {
          const sels = splitTop(head, ',').map(norm).filter(Boolean);
          for (const raw of splitTop(body, ';')) {
            const colon = raw.indexOf(':');
            if (colon === -1) continue;
            const prop = raw.slice(0, colon).trim().toLowerCase();
            let value = raw.slice(colon + 1).trim();
            if (!prop) continue;
            const important = /!\s*important\s*$/i.test(value);
            if (important) value = value.replace(/!\s*important\s*$/i, '').trim();
            decls.push({ctx, sels, prop, value, important, order: order++, selector: head.trim()});
          }
        }
        i = j + 1; continue;
      }
      prelude += c; i++;
    }
    return i;
  }
  block(0, [], false);
  return decls;
}

/** Returns declarations that can never take effect. */
export function deadDeclarations(source) {
  const decls = parseDeclarations(source);
  const bySelectorProp = new Map();
  for (const d of decls) for (const s of d.sels) {
    const k = s + '\u0000' + d.prop;
    if (!bySelectorProp.has(k)) bySelectorProp.set(k, []);
    bySelectorProp.get(k).push(d);
  }
  const covers = (later, earlier) => later.every(c => earlier.includes(c));
  const deadFor = (d, list) => list.some(l => l.order > d.order && covers(l.ctx, d.ctx) && (l.important || !d.important) &&
    (l.prop.startsWith('--') || norm(l.value) === norm(d.value) || !RISKY.test(l.value)));
  return decls.filter(d => d.sels.length && d.sels.every(s => deadFor(d, bySelectorProp.get(s + '\u0000' + d.prop))));
}
