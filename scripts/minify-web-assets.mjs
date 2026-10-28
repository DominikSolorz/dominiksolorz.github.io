// Transform only the deployment copy: source files and import URLs stay readable and stable.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { transform } from 'esbuild';

const root = resolve(process.argv[2] || '_site');
const camera = join(root, 'kamera');
let before = 0, after = 0, count = 0;
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['vendor', 'downloads', 'updates', 'assets', 'icons'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await walk(path); continue; }
    if (!/\.(?:js|mjs|css)$/.test(entry.name)) continue;
    const input = await readFile(path, 'utf8');
    const result = await transform(input, {
      loader: entry.name.endsWith('.css') ? 'css' : 'js',
      minify: true, keepNames: true, legalComments: 'inline',
      sourcemap: 'external', sourcefile: entry.name,
    });
    await writeFile(path, result.code + '\n/*# sourceMappingURL=' + entry.name + '.map */\n');
    await writeFile(path + '.map', result.map);
    before += Buffer.byteLength(input); after += Buffer.byteLength(result.code); count++;
  }
}
await walk(camera);
console.log(`Minified ${count} deployed CSS/JS files: ${before} -> ${after} bytes (source maps retained).`);
