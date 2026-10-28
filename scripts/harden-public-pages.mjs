// Harden only public documents after JS/CSS minification, so hashes match deployed bytes.
// Private account/camera documents keep their existing loading and authentication gates.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
const digest=text=>createHash('sha256').update(text).digest('base64');
export async function hardenPublicPages(root){
 const camera=resolve(root,'kamera');
 const sitemap=await readFile(resolve(camera,'sitemap.xml'),'utf8');
 const origin='https://dominiksolorz.github.io';
 const pages=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([,href])=>{
  const url=new URL(href);if(url.origin!==origin||!url.pathname.startsWith('/kamera/'))throw Error('Unexpected sitemap origin');
  return resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
 });
 pages.push(...['o-systemie.html','polityka-prywatnosci.html','regulamin.html','rodo.html'].map(path=>resolve(camera,path)));
 for(const path of new Set(pages)){
  let html=await readFile(path,'utf8');
  if(/id="(?:authDialog|panelRuntime)"/.test(html))throw Error('Refusing to apply public-only policy to private panel');
  const localFile=href=>{
   const url=new URL(href,pathToFileURL(path));url.search='';url.hash='';
   if(url.protocol!=='file:')throw Error('Unexpected remote asset '+href);
   const local=resolve(dirname(path),decodeURIComponent(url.pathname));
   if(relative(root,local).startsWith('..'))throw Error('Asset outside deployment root');
   return local;
  };
  // Keep the complete CSS cascade and media queries together, without a flash of unstyled content.
  for(const match of [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]){
   const css=await readFile(localFile(match[1]),'utf8');
   if(/<\/style/i.test(css))throw Error('Unsafe stylesheet terminator');
   html=html.replace(match[0],`<style data-source="${match[1]}">${css}</style>`);
  }
  // This tiny synchronous compatibility check must run before other page modules, without a network hop.
  const bridge=/<script src="public-entry\.js\?v=1"><\/script>/;
  if(bridge.test(html)){
   const js=await readFile(resolve(camera,'public-entry.js'),'utf8');
   if(/<\/script/i.test(js))throw Error('Unsafe script terminator');
   html=html.replace(bridge,`<script data-public-entry>${js}</script>`);
  }
  const canonical=html.match(/rel="canonical" href="([^"]+)"/)?.[1];
  if(canonical){
   const title=html.match(/<title>([^<]+)<\/title>/)?.[1]||'HOME SECURITY';
   const schema={'@context':'https://schema.org','@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:title,inLanguage:'pl-PL',isPartOf:{'@type':'WebSite','@id':origin+'/kamera/#website',url:origin+'/kamera/',name:'HOME SECURITY'}};
   html=html.replace('</head>','<script type="application/ld+json">'+JSON.stringify(schema).replaceAll('<','\\u003c')+'</script></head>');
  }
  const hashes=new Set();
  for(const match of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]){
   const src=match[1].match(/\bsrc="([^"]+)"/)?.[1];
   const bytes=src?await readFile(localFile(src)):match[2];
   const hash='sha256-'+digest(bytes);hashes.add("'"+hash+"'");
   if(src)html=html.replace(match[0],`<script${match[1]} integrity="${hash}" crossorigin="anonymous">${match[2]}</script>`);
  }
  const policy=["default-src 'none'","script-src "+[...hashes].join(' ')+" 'strict-dynamic' 'self'",
   "style-src 'self' 'unsafe-inline'","img-src 'self' data:","font-src 'self'",
   "connect-src 'self' https://ksacbcrzuwdahnmggfxg.supabase.co","manifest-src 'self'",
   "object-src 'none'","base-uri 'none'","form-action 'self' https://ksacbcrzuwdahnmggfxg.supabase.co",
   "require-trusted-types-for 'script'","trusted-types hs-support-static","upgrade-insecure-requests"].join('; ');
  html=html.replace(/(<meta charset="utf-8">)/,'$1<meta http-equiv="Content-Security-Policy" content="'+policy+'">');
  await writeFile(path,html);
  console.log('Public CSS, script integrity, CSP and Trusted Types: '+relative(root,path));
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await hardenPublicPages(resolve(process.argv[2]||'_site'));
