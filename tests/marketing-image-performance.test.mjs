import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const read=async path=>(await readFile(new URL('../'+path,import.meta.url),'utf8')).replaceAll('\r\n','\n');

test('public LCP hero uses responsive WebP candidates with original fallback and priority',async()=>{
 const [source,index,brochure]=await Promise.all([
  read('design/marketing/home.html'),read('kamera/panel.html'),read('kamera/o-systemie.html')]);
 const hero=source.match(/<img src="assets\/home-security-hero\.png"[^>]+>/)?.[0];
 assert.ok(hero,'original PNG remains the fallback');
 assert.ok(hero.includes('assets/home-security-hero-640.webp 640w'));
 assert.ok(hero.includes('assets/home-security-hero.webp 1024w'));
 assert.ok(hero.includes('fetchpriority="high"'));
 assert.ok(hero.includes('sizes="(max-width: 700px)'));
 const explanation=await read('design/marketing/jak-dziala.html');
 assert.ok(explanation.includes('assets/home-security-how-it-works-640.webp 640w'));
 assert.ok(explanation.includes('loading="lazy" decoding="async"'));
 assert.ok(index.includes(source.trimEnd()));
 assert.ok(brochure.includes(source.trimEnd()));
});

test('gallery uses the eight requested full-resolution URLs while presentation retains lightweight previews',async()=>{
 const [home,gallery,full]=await Promise.all([
  read('design/marketing/prezentacja.html'),read('design/marketing/gallery.html'),read('kamera/galeria.html')]);
 assert.equal((home.match(/-960\.webp 960w/g)||[]).length,4);
 const {galleryBoards}=await import('../kamera/gallery-catalog.mjs');
 assert.equal(galleryBoards.length,8);
 for(const board of galleryBoards){
  assert.ok(gallery.includes(`href="${board.url}"`));
  assert.ok(gallery.includes(`src="${board.url}"`));
  assert.ok(gallery.includes(board.title));assert.ok(gallery.includes(board.caption));
 }
 assert.equal((gallery.match(/<figure /g)||[]).length,8);
 assert.ok(full.includes(gallery.trimEnd()));
 for(const x of [home,gallery]){
  for(const [,url] of x.matchAll(/href="(\.\.\/docs\/ui-193\/[^"]+\.png)" data-mkt-image-view/g)){
   assert.ok((await stat(new URL('../kamera/'+url,import.meta.url))).size>100_000);
  }
 }
});

test('build generates optimized images only from local public illustrations, after the site snapshot',async()=>{
 const [pipeline,workflow]=await Promise.all([
  read('scripts/optimize-marketing-images.mjs'),read('.github/workflows/pages.yml')]);
 for(const name of ['home-security-hero','home-security-how-it-works','ds-logo','01-pulpit','07-telefon','08-konto-i-przyciski'])assert.ok(pipeline.includes(name));
 assert.ok(pipeline.includes('.webp({quality:'));
 assert.ok(pipeline.includes('withoutEnlargement:true'));
 assert.ok(!pipeline.includes('camera')||pipeline.includes('camera, video streams'),'output does not manipulate camera video');
 const rsync=workflow.indexOf('rsync -a'),images=workflow.indexOf('node scripts/optimize-marketing-images.mjs _site'),upload=workflow.indexOf('uses: actions/upload-pages-artifact');
 assert.ok(rsync>0&&images>rsync&&upload>images,'transcoding runs only after dist copy, before upload');
 assert.ok(workflow.includes('node --check scripts/optimize-marketing-images.mjs'));
});

test('marketing updates retain SW version consistency and original image links',async()=>{
 const [sw,app,manifest,index,source]=await Promise.all([
  read('kamera/sw.js'),read('kamera/app.js'),read('kamera/version.json'),
  read('kamera/panel.html'),read('design/marketing/home.html')]);
 const build=JSON.parse(manifest).version;
 assert.ok(/^\d+$/.test(build));
 assert.ok(app.includes('const VERSION = "'+build+'"'));
 const shell=app.match(/SERVICE_WORKER_BUILD = "(\d+)"/)?.[1];
 assert.ok(/^\d+$/.test(shell));
 assert.ok(sw.includes('kamera-domowa-shell-v'+shell));
 assert.ok(sw.includes('./app.js?v='+build));
 assert.ok(index.includes('home-security-build" content="'+build+'"'));
 assert.ok(index.includes('app.js?v='+build));
 assert.ok(source.includes('src="assets/home-security-hero.png"'));
});

test('public and locked app screens use compact high-DPI logos instead of eager 241 KiB JPEG downloads',async()=>{
 const [html,optimizer,workflow]=await Promise.all([
   read('kamera/panel.html'),read('scripts/optimize-marketing-images.mjs'),
   read('.github/workflows/pages.yml')
 ]);
 const privateLogos=[...html.matchAll(/<img class="(?:dsBrandLogo|dsPanelLogo)"[^>]+>/g)];
 assert.equal(privateLogos.length,4);
 for(const logo of privateLogos){
   assert.match(logo[0],/assets\/ds-logo-96\.webp 96w/);
   assert.match(logo[0],/assets\/ds-logo-192\.webp 192w/);
   assert.ok(logo[0].includes('src="assets/ds-logo.jpg"'),'old browsers retain original fallback');
 }
 assert.ok(optimizer.includes("out:'kamera/assets/ds-logo-192.webp'"));
 assert.ok(workflow.includes('_site/kamera/assets/ds-logo-192.webp'));
});
