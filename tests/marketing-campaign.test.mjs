import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('campaign appears consistently in the source and all three public homepages',async()=>{
  const paths=['design/marketing/home.html','kamera/index.html','kamera/o-systemie.html','kamera/panel.html'];
  for(const path of paths){
    const html=await read(path);
    for(const marker of ['id="hsCampaignTitle"','id="hsCampaignShelfTitle"','class="hsCampaignTiles"'])
      assert.ok(html.includes(marker),path+' missing '+marker);
    assert.match(html,/href="pobierz\.html"/);
    assert.match(html,/href="jak-dziala\.html"/);
    assert.match(html,/Zdjęcia są ilustracyjne/);
  }
  const panel=await read('kamera/panel.html');
  assert.match(panel,/<video id="video" autoplay playsinline muted>/);
  assert.match(panel,/id="authDialog"/);
  assert.match(panel,/id="lock"/);
  assert.match(panel,/id="ctrlStart"/);
});

test('campaign stylesheet is loaded only by public landing pages and scoped away from camera UI',async()=>{
  const [build,panel,index,brochure,css]=await Promise.all([
    read('scripts/build-marketing.mjs'),read('kamera/panel.html'),
    read('kamera/index.html'),read('kamera/o-systemie.html'),read('kamera/marketing-campaign.css')
  ]);
  for(const page of [panel,index,brochure])assert.ok(page.includes('marketing-campaign.css?v=1'));
  assert.ok(build.includes('marketing-campaign.css?v=1'));
  assert.match(css,/#publicHome\.mktSite \.hsCampaign/);
  assert.doesNotMatch(css,/#app\b|#stage\b/);
  assert.match(css,/@media\(max-width:560px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /focus-visible/);
  const size=await stat(new URL('kamera/marketing-campaign.css',root));
  assert.ok(size.size<12000,'stylesheet must remain smaller than 12 KB');
});

test('campaign loads optimized local illustrations lazily without JavaScript or artificial delay',async()=>{
  const home=await read('design/marketing/home.html');
  const css=await read('kamera/marketing-campaign.css');
  for(const path of ['site-kam01.webp','site-kam02.webp','site-archiwum.webp']){
    assert.ok(home.includes('src="assets/'+path+'" loading="lazy"') || home.includes('src="assets/'+path+'" width='));
    const s=await stat(new URL('kamera/assets/'+path,root));
    assert.ok(s.size<100000,path+' too large for campaign card');
  }
  assert.ok(css.includes('site-hero-dom.webp'));
  const photo=await stat(new URL('kamera/assets/site-hero-dom.webp',root));
  assert.ok(photo.size<110000,'campaign hero image too large');
  assert.doesNotMatch(home,/setTimeout|setInterval|load-delay|8s|8000/);
  assert.doesNotMatch(home,/250\s?000|4,8\s?\/\s?5|Google Play/i);
});
