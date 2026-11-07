// Generate compact WebP derivatives during GitHub Pages deployment.
// Original PNG/JPEG files stay in the repository as no-srcset fallbacks and for full-size lightbox.
// The authenticated camera, video streams, recorded files and Windows downloads are not touched.
import sharp from 'sharp';
import {mkdir,stat} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';

const repoRoot=resolve(import.meta.dirname,'..');
const publicRoot=resolve(process.argv[2]||'_site');
const plan=[
 {from:'kamera/assets/home-security-hero.png',out:'kamera/assets/home-security-hero.webp',width:1024,quality:77},
 {from:'kamera/assets/home-security-hero.png',out:'kamera/assets/home-security-hero-640.webp',width:640,quality:75},
 {from:'kamera/assets/home-security-how-it-works.png',out:'kamera/assets/home-security-how-it-works.webp',width:1024,quality:77},
 {from:'kamera/assets/home-security-how-it-works.png',out:'kamera/assets/home-security-how-it-works-640.webp',width:640,quality:75},
 {from:'kamera/assets/ds-logo.jpg',out:'kamera/assets/ds-logo-96.webp',width:96,quality:84},
 {from:'kamera/assets/ds-logo.jpg',out:'kamera/assets/ds-logo-192.webp',width:192,quality:84},
 ...['01-pulpit','02-sterowanie','03-nagrania','04-ustawienia','05-diagnostyka','06-alarmy','07-telefon','08-konto-i-przyciski'].flatMap(name=>[480,640,720,960].map(width=>({
   from:'docs/ui-193/'+name+'.png',out:'docs/ui-193/'+name+'-'+width+'.webp',width,quality:81
 })))
];
let originalBytes=0,webpBytes=0;
for(const item of plan){
 const input=join(repoRoot,item.from),output=join(publicRoot,item.out);
 await mkdir(dirname(output),{recursive:true});
 const meta=await sharp(input).metadata();
 if(!meta.width||!meta.height)throw new Error('Unreadable asset: '+item.from);
 await sharp(input).rotate().resize({width:item.width,withoutEnlargement:true})
  .webp({quality:item.quality,effort:5}).toFile(output);
 const source=await stat(input),compressed=await stat(output);
 if(compressed.size<500||compressed.size>=source.size)throw new Error('Generated WebP not beneficial: '+item.out);
 originalBytes+=source.size;
 webpBytes+=compressed.size;
 console.log(item.out+': '+(source.size/1024).toFixed(1)+' KiB -> '+(compressed.size/1024).toFixed(1)+' KiB');
}
console.log('Responsive marketing image variants: '+plan.length+' created, aggregate '+(originalBytes/1024/1024).toFixed(2)+' MiB source -> '+(webpBytes/1024/1024).toFixed(2)+' MiB derived variants (some sources intentionally repeated).');
