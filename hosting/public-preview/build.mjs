// Isolated public review: no account/camera runtime and no changes to the GitHub Pages site.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,extname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {transform} from 'esbuild';
const repo=resolve(import.meta.dirname,'../..');
const output=resolve(process.argv[2]||'/tmp/home-security-public-review');
const variants=resolve(process.argv[3]||'/tmp/home-security-review-images');
const old='https://dominiksolorz.github.io',canonical=old+'/kamera/';
await mkdir(join(output,'kamera'),{recursive:true});await mkdir(join(output,'_assets'),{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sri=bytes=>'sha256-'+createHash('sha256').update(bytes).digest('base64');
const assets=[];
async function asset(bytes,extension){const hash=sha(bytes),path='/_assets/'+hash+extension;await writeFile(join(output,path),bytes);assets.push({path,hash});return path;}
let html=await readFile(join(repo,'kamera/index.html'),'utf8');
if(/id="(?:authDialog|panelRuntime)"/.test(html))throw Error('Public preview must never include private application markup');
// Styles retain their complete cascade without external blocking requests.
for(const m of [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]){
 const css=await readFile(join(repo,'kamera',m[1].split('?')[0]),'utf8');
 const result=await transform(css,{loader:'css',minify:true});html=html.replace(m[0],'<style>'+result.code+'</style>');
}
html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link[^>]*rel="manifest"[^>]*>/g,'');
// Original-size gallery downloads, accounts and forms stay on their working original origin.
html=html.replace(/(<img\b[^>]*\bsrc=")([^"]+)"/g,(all,start,src)=>{
 const replacements={'assets/ds-logo.jpg':'assets/ds-logo-96.webp','assets/home-security-hero.png':'assets/home-security-hero.webp','assets/home-security-how-it-works.png':'assets/home-security-how-it-works.webp'};
 const target=replacements[src]||(/^\.\.\/docs\/ui-193\/.+\.png$/.test(src)?src.replace('.png','-960.webp'):src);
 return start+target+'"';
});
const images=new Set();
for(const [,src] of html.matchAll(/\bsrc="([^"]+)"/g))images.add(src);
for(const [,set] of html.matchAll(/\bsrcset="([^"]+)"/g))for(const item of set.split(','))images.add(item.trim().split(/\s+/)[0]);
for(const src of images){
 const url=new URL(src,canonical);if(url.origin!==old)throw Error('Unexpected external image');
 const relative=url.pathname.slice(1);const source=relative.endsWith('.webp')?join(variants,relative):join(repo,relative);
 const target=await asset(await readFile(source),extname(source));
 html=html.split('"'+src+'"').join('"'+target+'"').split(src+' ').join(target+' ');
}
// Fingerprint the favicon as well.
html=html.replace(/<link\b[^>]*rel="icon"[^>]*>/g,'');
const icon=await asset(await readFile(join(repo,'kamera/icons/kamera-192.svg')),'.svg');
html=html.replace('</head>','<link rel="icon" href="'+icon+'" type="image/svg+xml"></head>');
html=html.replace(/href="([^"]+)"/g,(all,href)=>{
 if(href.startsWith('#')||href.startsWith('/_assets/')||/^(https?:|mailto:)/.test(href))return all;
 const url=new URL(href,canonical);
 if(url.pathname==='/kamera/'&&!url.search)return 'href="/kamera/"';
 return 'href="'+url.href.replaceAll('&','&amp;')+'"';
});
// The review does not introduce a new origin to account, contact or AI backends.
html=html.replace(/<button\b[^>]*data-hs-open-support[^>]*>[\s\S]*?<\/button>/g,'<a class="mktButton" href="'+canonical+'#asystent">Pomoc AI na stronie aplikacji ↗</a>');
const hashes=[];
for(const name of ['marketing-motion.mjs','marketing-gallery.mjs','marketing-start.mjs']){
 const code=await readFile(join(repo,'kamera',name),'utf8');
 const result=await transform(code,{loader:'js',format:'esm',minify:true,keepNames:true,sourcemap:'external',sourcefile:name});
 const map=await asset(Buffer.from(result.map),'.map');
 const bytes=Buffer.from(result.code+'\n//# sourceMappingURL='+map+'\n');
 const path=await asset(bytes,'.mjs'),hash=sri(bytes);hashes.push("'"+hash+"'");
 html=html.replace('</body>','<script type="module" src="'+path+'" integrity="'+hash+'" crossorigin="anonymous"></script></body>');
}
const ld=JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:canonical,name:'HOME SECURITY',inLanguage:'pl-PL'});
hashes.push("'"+sri(ld)+"'");html=html.replace('</head>','<script type="application/ld+json">'+ld+'</script></head>');
await writeFile(join(output,'kamera/index.html'),html);
const csp=["default-src 'none'","script-src "+hashes.join(' ')+" 'strict-dynamic' 'unsafe-inline' https: 'self'",
 "style-src 'unsafe-inline'","img-src 'self' data:","font-src 'self'","connect-src 'none'","object-src 'none'","base-uri 'none'","form-action 'none'","frame-ancestors 'none'","require-trusted-types-for 'script'","trusted-types 'none'","upgrade-insecure-requests"].join('; ');
const config={framework:null,buildCommand:null,installCommand:null,
 headers:[{source:'/(.*)',headers:[
  {key:'Content-Security-Policy',value:csp},{key:'Cross-Origin-Opener-Policy',value:'same-origin'},
  {key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains; preload'},
  {key:'X-Frame-Options',value:'DENY'},{key:'X-Content-Type-Options',value:'nosniff'},
  {key:'Referrer-Policy',value:'no-referrer'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
  {key:'Cache-Control',value:'public, max-age=0, must-revalidate'}]},
  {source:'/_assets/(.*)',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]}],
 redirects:[{source:'/',destination:'/kamera/',permanent:false}],
 rewrites:[{source:'/kamera/',destination:'/kamera/index.html'}]};
await writeFile(join(output,'vercel.json'),JSON.stringify(config,null,2)+'\n');
await writeFile(join(output,'index.html'),'<!doctype html><html lang="pl"><meta charset="utf-8"><title>HOME SECURITY</title><a href="/kamera/">HOME SECURITY</a></html>');
await writeFile(join(output,'robots.txt'),'User-agent: *\nAllow: /\n');
await writeFile(join(output,'review-manifest.json'),JSON.stringify({sourceVersion:JSON.parse(await readFile(join(repo,'kamera/version.json'),'utf8')).version,canonical,assets,accountOrigin:old,previewOnly:true},null,2));
console.log(JSON.stringify({output,files:assets.length+5,assets:assets.length,bytes:Buffer.byteLength(html),canonical}));
