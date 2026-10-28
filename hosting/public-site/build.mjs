// Public-only static distribution. Private accounts, callbacks, PWA and cameras remain on GitHub Pages.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,extname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {build,transform} from 'esbuild';
const repo=resolve(import.meta.dirname,'../..');
const output=resolve(process.argv[2]||join(repo,'.public-site-dist'));
const variants=resolve(process.argv[3]||'/tmp/home-security-public-images');
const legacy='https://dominiksolorz.github.io';
const origin=process.env.PUBLIC_SITE_ORIGIN||'https://home-security-dominik-solorz.vercel.app';
if(new URL(origin).origin!==origin||!origin.startsWith('https://'))throw Error('PUBLIC_SITE_ORIGIN must be an HTTPS origin');
const version=JSON.parse(await readFile(join(repo,'kamera/version.json'),'utf8')).version;
const names=['pobierz.html','index.html','o-systemie.html','galeria.html','blog/index.html','blog/pierwsze-uruchomienie.html','blog/zapis-lokalny-i-drive.html','blog/diagnostyka-monitoringu.html','polityka-prywatnosci.html','regulamin.html','rodo.html'];
const publicPaths=new Set(names.map(name=>'/kamera/'+name));publicPaths.add('/kamera/');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sri=bytes=>'sha256-'+createHash('sha256').update(bytes).digest('base64');
const assets=new Map(),hashes=new Set(),modules=new Map(),styles=new Map();
await mkdir(join(output,'_assets'),{recursive:true});
async function asset(bytes,extension){const hash=sha(bytes),path='/_assets/'+hash+extension;if(!assets.has(path)){await writeFile(join(output,path),bytes);assets.set(path,{path,hash});}return path;}
async function image(ref,base){
 const url=new URL(ref,base);if(![legacy,origin].includes(url.origin))throw Error('Unexpected image origin');
 let path=url.pathname.slice(1);
 path=({'kamera/assets/ds-logo.jpg':'kamera/assets/ds-logo-96.webp','kamera/assets/home-security-hero.png':'kamera/assets/home-security-hero.webp','kamera/assets/home-security-how-it-works.png':'kamera/assets/home-security-how-it-works.webp'})[path]||path;
 if(/^docs\/ui-193\/.+\.png$/.test(path))path=path.replace('.png','-960.webp');
 const file=resolve(path.endsWith('.webp')?variants:repo,path);
 if(!file.startsWith((path.endsWith('.webp')?variants:repo)+'/'))throw Error('Image outside source root');
 return asset(await readFile(file),extname(file));
}
async function moduleAsset(names){
 const name=names.join('+');
 if(modules.has(name))return modules.get(name);
 if(names.some(entry=>!['marketing-motion.mjs','marketing-gallery.mjs','marketing-start.mjs','marketing-auto-update.mjs'].includes(entry)))throw Error('Unexpected public entry '+name);
 const result=await build({stdin:{contents:names.map(entry=>'import '+JSON.stringify(join(repo,'kamera',entry))+';').join('\n'),resolveDir:repo,sourcefile:'public-enhancements.mjs'},outfile:join(output,'build','public-enhancements.mjs'),write:false,bundle:true,format:'esm',platform:'browser',minify:true,keepNames:true,sourcemap:'external',legalComments:'inline',plugins:[{name:'public-module-urls',setup(b){
  b.onResolve({filter:/\?v=\d+$/},args=>({path:resolve(args.resolveDir,args.path.split('?')[0])}));
  b.onLoad({filter:/\.(?:mjs|js)$/},async args=>{
   let contents=await readFile(args.path,'utf8');
   if(basename(args.path)==='marketing-downloads.mjs')contents=contents.replaceAll(',import.meta.url).href',','+JSON.stringify(legacy+'/kamera/')+').href');
   contents=contents.replaceAll('import.meta.url',JSON.stringify(origin+'/kamera/'+basename(args.path)));
   return {contents,loader:'js',resolveDir:resolve(args.path,'..')};
  });
 }}]});
 const code=result.outputFiles.find(f=>f.path.endsWith('.mjs')).text,map=result.outputFiles.find(f=>f.path.endsWith('.map')).contents;
 const mapPath=await asset(map,'.map'),bytes=Buffer.from(code+'\n//# sourceMappingURL='+mapPath+'\n');
 const path=await asset(bytes,'.mjs'),integrity=sri(bytes);hashes.add("'"+integrity+"'");
 const value={path,integrity};modules.set(name,value);return value;
}
const entryCode=`(()=>{const p=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.replace(/^#/,''));if(p.has('auth')||p.has('code')||p.get('panel')==='owner'||p.get('app')==='android'||/^cam-[a-f0-9]{32}$/.test(p.get('odbiorca')||'')||location.hash==='#nadaj'||h.has('access_token')||h.has('error')||h.get('type')==='recovery'){const u=new URL('${legacy}/kamera/panel.html');u.search=location.search;u.hash=location.hash;location.replace(u.href);}})();`;
hashes.add("'"+sri(entryCode)+"'");
for(const name of names){
 const source=join(repo,'kamera',name),base=legacy+'/kamera/'+name;
 let html=await readFile(source,'utf8');
 if(/id="(?:authDialog|panelRuntime)"/.test(html))throw Error('Private markup in public distribution');
 const entries=[...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/script>/g)].map(m=>basename(m[1].split('?')[0])).filter(n=>!['public-entry.js','support-entry.mjs'].includes(n));
 html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/g,'').replace(/<link[^>]+rel="manifest"[^>]*>/g,'');
 for(const m of [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]){
  const cssPath=resolve(repo,'.'+new URL(m[1],base).pathname);
  if(!styles.has(cssPath))styles.set(cssPath,(await transform(await readFile(cssPath,'utf8'),{loader:'css',minify:true})).code);
  html=html.replace(m[0],'<style>'+styles.get(cssPath)+'</style>');
 }
 const inlineStyles=[...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/g)].map(m=>m[0]).join('');
 html=html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g,'').replace('</head>',inlineStyles+'</head>');
 for(const m of [...html.matchAll(/\bsrc="([^"]+)"/g)])html=html.replace('src="'+m[1]+'"','src="'+await image(m[1],base)+'"');
 for(const m of [...html.matchAll(/\bsrcset="([^"]+)"/g)]){
  const set=[];for(const item of m[1].split(',')){const [url,size]=item.trim().split(/\s+/);set.push(await image(url,base)+' '+size);}
  html=html.replace(m[0],'srcset="'+set.join(', ')+'"');
 }
 for(const m of [...html.matchAll(/<meta property="og:image" content="([^"]+)">/g)])html=html.replace(m[0],'<meta property="og:image" content="'+origin+await image(m[1],base)+'">');
 for(const m of [...html.matchAll(/<link\b[^>]*rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"[^>]*>/g)])html=html.replace(m[0],m[0].replace('href="'+m[1]+'"','href="'+await image(m[1],base)+'"'));
 html=html.replace(/href="([^"]+)"/g,(all,href)=>{
  if(href.startsWith('#')||href.startsWith('/_assets/')||href.startsWith('mailto:'))return all;
  const u=new URL(href.replaceAll('&amp;','&'),base);if(![legacy,origin].includes(u.origin))return all;
  if(u.pathname==='/kamera/panel.html'||u.searchParams.has('auth')||u.pathname==='/kamera/pomoc.html'||u.pathname.includes('/downloads/')||u.pathname.includes('/docs/'))u.host=new URL(legacy).host;
  else if(publicPaths.has(u.pathname))u.host=new URL(origin).host;
  return 'href="'+u.href.replaceAll('&','&amp;')+'"';
 });
 const canonical=origin+(name==='index.html'||name==='o-systemie.html'?'/kamera/':'/kamera/'+name);
 html=html.replace(/(<link rel="canonical" href=")[^"]+("[^>]*>)/,'$1'+canonical+'$2').replace(/(<meta property="og:url" content=")[^"]+("[^>]*>)/,'$1'+canonical+'$2');
 if(!html.includes('rel="canonical"'))html=html.replace('</head>','<link rel="canonical" href="'+canonical+'"></head>');
 html=html.replace(/<button\b[^>]*data-hs-open-support[^>]*>[\s\S]*?<\/button>/g,'<a class="mktButton" href="'+legacy+'/kamera/#asystent">Otwórz pomoc AI ↗</a>');
 if(entries.length){const a=await moduleAsset([...new Set(entries)]);html=html.replace('</body>','<script type="module" async fetchpriority="low" src="'+a.path+'" integrity="'+a.integrity+'" crossorigin="anonymous"></script></body>');}
 const ld=JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:canonical,name:html.match(/<title>([^<]+)<\/title>/)?.[1]||'HOME SECURITY',inLanguage:'pl-PL',isPartOf:{'@type':'WebSite',url:origin+'/kamera/',name:'HOME SECURITY'}}).replaceAll('<','\\u003c');
 hashes.add("'"+sri(ld)+"'");html=html.replace('</head>','<script type="application/ld+json">'+ld+'</script></head>').replace(/(<meta charset="utf-8">)/,'$1<script>'+entryCode+'</script>');
 await mkdir(resolve(output,'kamera',name,'..'),{recursive:true});await writeFile(join(output,'kamera',name),html);
}
for(const [path,destination] of [['kamera/panel.html',legacy+'/kamera/panel.html'],['kamera/pomoc.html',legacy+'/kamera/pomoc.html'],['kamera/pomoc-ai.html',legacy+'/kamera/#asystent'],['index.html',origin+'/kamera/']]){
 const code=`(()=>{const u=new URL(${JSON.stringify(destination)});u.search=location.search;u.hash=location.hash;location.replace(u.href);})();`;
 hashes.add("'"+sri(code)+"'");
 const text='<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>HOME SECURITY - przejście do aplikacji</title><script>'+code+'</script></head><body><p><a href="'+destination+'">Przejdź do HOME SECURITY</a></p></body></html>';
 await writeFile(join(output,path),text);
}
await writeFile(join(output,'kamera/version.json'),JSON.stringify({version})+'\n');
const sitemapPaths=['','pobierz.html','galeria.html','blog/index.html','blog/pierwsze-uruchomienie.html','blog/zapis-lokalny-i-drive.html','blog/diagnostyka-monitoringu.html'];
await writeFile(join(output,'kamera/sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+sitemapPaths.map(p=>'<url><loc>'+origin+'/kamera/'+p+'</loc></url>').join('\n')+'\n</urlset>\n');
await writeFile(join(output,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: '+origin+'/kamera/sitemap.xml\n');
await writeFile(join(output,'404.html'),'<!doctype html><html lang="pl"><meta charset="utf-8"><title>Nie znaleziono strony</title><h1>Nie znaleziono strony</h1><a href="/kamera/">Wróć do HOME SECURITY</a></html>');
const policy=["default-src 'none'","script-src "+[...hashes].join(' ')+" 'strict-dynamic' 'unsafe-inline' https: 'self'","style-src 'unsafe-inline'","img-src 'self' data: "+legacy,"font-src 'self'","connect-src 'self'","object-src 'none'","base-uri 'none'","form-action 'none'","frame-ancestors 'none'","require-trusted-types-for 'script'","trusted-types 'none'","upgrade-insecure-requests"].join('; ');
const config={framework:null,headers:[{source:'/(.*)',headers:[{key:'Content-Security-Policy',value:policy},{key:'Cross-Origin-Opener-Policy',value:'same-origin'},{key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains; preload'},{key:'X-Frame-Options',value:'DENY'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'no-referrer'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},{key:'Cache-Control',value:'public, max-age=0, must-revalidate'}]},{source:'/_assets/(.*)',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]},{source:'/kamera/:file((?:version|desktop-update)\\.json)',headers:[{key:'Cache-Control',value:'no-store'},{key:'Vercel-CDN-Cache-Control',value:'no-store'}]}],redirects:[],rewrites:[{source:'/kamera/',destination:'/kamera/index.html'},{source:'/kamera/desktop-update.json',destination:legacy+'/kamera/desktop-update.json'}]};
await writeFile(join(output,'vercel.json'),JSON.stringify(config,null,2)+'\n');
await writeFile(join(output,'public-build.json'),JSON.stringify({version,origin,legacy,documents:names,assets:[...assets.values()]},null,2)+'\n');
console.log('Built public website '+version+': '+names.length+' documents, '+assets.size+' fingerprinted assets, origin '+origin);
