import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {hardenPublicPages} from '../scripts/harden-public-pages.mjs';
import {createSupportMarkup} from '../kamera/support-view.mjs';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Trusted Types support policy rejects all markup except its fixed source template',()=>{
 let validator,name;
 const safe=createSupportMarkup({createPolicy:(n,policy)=>{name=n;validator=policy.createHTML;return {createHTML:value=>({trusted:validator(value)})};}});
 assert.equal(name,'hs-support-static');assert.ok(safe.trusted.includes('hsSupportForm'));
 assert.throws(()=>validator('<img src=x onerror=alert(1)>'),TypeError);
 assert.throws(()=>validator('<script>alert(1)</script>'),TypeError);
 assert.ok(!safe.trusted.includes('${'),'no user interpolation in approved template');
});

test('deployment CSS is inline and strict CSP hashes match the exact deployed script bytes',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'home-security-public-'));
 try{
  const htmlPaths=['pobierz.html','index.html','o-systemie.html','galeria.html','pomoc.html','blog/index.html','blog/pierwsze-uruchomienie.html','blog/zapis-lokalny-i-drive.html','blog/diagnostyka-monitoringu.html','polityka-prywatnosci.html','regulamin.html','rodo.html'];
  const files=new Set(['kamera/sitemap.xml','kamera/public-entry.js']);
  for(const name of htmlPaths){
   const path='kamera/'+name;files.add(path);
   const html=await read(path);
   for(const [,href] of html.matchAll(/(?:src|href)="([^"]+\.(?:m?js|css)(?:\?[^\"]*)?)"/g)){
    const u=new URL(href,new URL(path,root));u.search='';files.add(decodeURIComponent(u.pathname.slice(root.pathname.length)));
   }
  }
  for(const path of files){await mkdir(dirname(join(temp,path)),{recursive:true});await copyFile(new URL(path,root),join(temp,path));}
  await hardenPublicPages(temp);
  for(const name of htmlPaths){
   const path=join(temp,'kamera',name),html=await readFile(path,'utf8');
   assert.ok(!/<link[^>]+rel="stylesheet"/.test(html),name);
   assert.ok(!/<script src="public-entry/.test(html),name);
   assert.ok(!/<style\b/.test(html.slice(html.indexOf('<body'))),'all inline styles must be in the head: '+name);
   const policy=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
   assert.ok(policy.includes("'strict-dynamic'"));assert.ok(policy.includes("require-trusted-types-for 'script'"));
   assert.ok(!policy.includes("script-src 'unsafe-inline'"));assert.ok(!policy.includes("'unsafe-eval'"));
   assert.ok(!policy.includes('frame-ancestors'),'never claim unsupported meta framing protection');
   for(const [,attrs,body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    const src=attrs.match(/src="([^"]+)"/)?.[1];
    const content=src?await readFile(new URL(src,'file://'+path)):body;
    const hash='sha256-'+createHash('sha256').update(content).digest('base64');
    assert.ok(policy.includes("'"+hash+"'"),name);
    if(src)assert.ok(attrs.includes('integrity="'+hash+'"'),name);
    if(attrs.includes('application/ld+json')){
     const data=JSON.parse(body);assert.equal(data['@type'],'WebPage');
     assert.equal(data.url,html.match(/rel="canonical" href="([^"]+)"/)[1]);
    }
   }
  }
 }finally{await rm(temp,{recursive:true,force:true});}
});
