// Compile public, static marketing pages. The private application stays in panel.html.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url),camera=new URL('kamera/',root),source=new URL('design/marketing/',root);
const check=process.argv.includes('--check');
const normalize=text=>text.replace(/\r\n/g,'\n');
const read=async(base,name)=>normalize(await readFile(new URL(name,base),'utf8'));
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const origin='https://dominiksolorz.github.io/kamera/';
const publicBuild=JSON.parse(await read(camera,'version.json')).version;
async function emit(name,html){
  const file=new URL(name,camera);
  if(check){if(normalize(await readFile(file,'utf8'))!==html)throw new Error('Outdated generated marketing page: '+name);}
  else{await mkdir(new URL('./',file),{recursive:true});await writeFile(file,html);}
}
function head(title,description,path,prefix=''){
return `<!doctype html>\n<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="home-security-build" content="${publicBuild}"><meta name="theme-color" content="#0b0c10"><meta name="referrer" content="no-referrer"><meta name="robots" content="index,follow"><title>${escape(title)} — HOME SECURITY</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${origin+path}"><meta property="og:type" content="website"><meta property="og:locale" content="pl_PL"><meta property="og:title" content="${escape(title)} — HOME SECURITY"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${origin+path}"><meta property="og:image" content="${origin}assets/home-security-hero.png"><link rel="icon" href="${prefix}icons/kamera-192.svg" type="image/svg+xml"><link rel="stylesheet" href="${prefix}marketing.css?v=7"><link rel="stylesheet" href="${prefix}marketing-motion.css?v=2"><script type="module" src="${prefix}marketing-motion.mjs?v=3"></script><link rel="stylesheet" href="${prefix}marketing-auto-update.css?v=1"><script type="module" src="${prefix}marketing-auto-update.mjs?v=4"></script></head>\n<body class="marketingPage">\n`;
}
function nav(prefix=''){
 const panel=prefix+'panel.html';
return `<a class="mktSkip" href="#mkt-content">Przejdź do treści</a><header class="mktHeader"><a class="mktBrand" href="${prefix || './'}" aria-label="DS HOME SECURITY — strona główna"><img src="${prefix}assets/ds-logo.jpg" srcset="${prefix}assets/ds-logo-96.webp 96w" sizes="44px" width="44" height="48" alt="Logo DS"><span>HOME <b>SECURITY</b><small>TWÓJ DOM. TWOJA KONTROLA.</small></span></a><nav aria-label="Nawigacja strony"><a href="${prefix || './'}#mozliwosci">Możliwości</a><a href="${prefix || './'}#specyfikacja">Specyfikacja</a><a href="${prefix}blog/index.html">Poradniki</a><a href="${prefix}pomoc.html">Kontakt</a></nav><a class="mktLogin" href="${panel}?auth=login">Zaloguj się ↗</a></header>`;
}
function footer(prefix=''){
 return `<footer class="mktFooter mktContainer"><div><a class="mktBrand" href="${prefix || './'}"><img src="${prefix}assets/ds-logo.jpg" srcset="${prefix}assets/ds-logo-96.webp 96w" sizes="44px" width="38" height="42" alt="Logo DS"><span>HOME <b>SECURITY</b></span></a><p>Twój dom. Twoja kontrola.</p></div><nav aria-label="Produkt"><b>Poznaj produkt</b><a href="${prefix || './'}#specyfikacja">Specyfikacja</a><a href="${prefix || './'}#stan-projektu">Stan projektu</a><a href="${prefix}galeria.html">Galeria projektów</a><a href="${prefix}blog/index.html">Poradniki</a></nav><nav aria-label="Pomoc i dokumenty"><b>Pomoc i dokumenty</b><a href="${prefix}pomoc.html">Kontakt</a><a href="${prefix}polityka-prywatnosci.html">Polityka prywatności</a><a href="${prefix}regulamin.html">Regulamin</a><a href="${prefix}rodo.html">Informacja RODO</a></nav><p class="mktCopyright">© 2026 HOME SECURITY. System jest rozwijany; sprawdź aktualny zakres funkcji przed instalacją.</p></footer>`;
}
const home=await read(source,'home.html');
const index=await read(camera,'panel.html');
const slot=/<section id="publicHome"[\s\S]*?<\/section>(?=\s*<section id="authDialog")/;
if(!slot.test(index))throw new Error('Public marketing slot not found; private panel not modified.');
await emit('panel.html',index.replace(slot,home.trimEnd()));
const publicHome=head('Monitoring domu z podglądem na telefonie','HOME SECURITY: monitoring domowy przez komputer Windows i telefon. Zobacz podgląd, archiwum nagrań, wymagania i instrukcje konfiguracji.','').replace('</head>','<script src="public-entry.js?v=1"></script><link rel="manifest" href="manifest.webmanifest?v=3"></head>')+home+'\n</body></html>\n';
await emit('index.html',publicHome);
// Keep old inbound product links working; canonical points at the single homepage.
await emit('o-systemie.html',publicHome);
const posts=JSON.parse(await read(source,'posts.json'));
for(const post of posts)if(!/^[a-z0-9-]+$/.test(post.slug))throw new Error('Invalid article slug.');
const cards=posts.map(post=>`<a class="mktPost" href="${post.slug}.html"><span class="mktPostArt ${escape(post.art)}" aria-hidden="true">${escape(post.number)} <i>PORADNIK</i></span><span class="mktPostCategory">${escape(post.category.toUpperCase())}</span><h3>${escape(post.title)}</h3><p>${escape(post.description)}</p><span class="mktTextLink">Czytaj poradnik ↗</span></a>`).join('\n');
await emit('blog/index.html',head('Blog i poradniki','Praktyczne poradniki HOME SECURITY: pierwsze uruchomienie, kamera, folder nagrań, Google Drive i diagnostyka.','blog/index.html','../')+nav('../')+`<main id="mkt-content" class="mktPageMain"><p class="mktBreadcrumb"><a href="../">Strona główna</a> / Centrum wiedzy</p><p class="mktEyebrow">BLOG I PORADNIKI</p><h1 class="mktPageTitle">Więcej wiedzy.<br>Mniej zgadywania.</h1><p class="mktPageLead">Praktyczne wyjaśnienia działania HOME SECURITY. Od pierwszego uruchomienia po czytanie komunikatów diagnostycznych.</p><div class="mktPosts">${cards}</div><div class="mktNote">Poradniki opisują obecne możliwości i ograniczenia projektu. Nie zastępują sprawdzenia rzeczywistej kamery, pliku i połączenia w Twojej instalacji.</div></main>`+footer('../')+'\n</body></html>\n');
for(const post of posts){
 const article=await read(source,post.slug+'.html');
 const related=posts.filter(other=>other.slug!==post.slug).map(other=>`<a href="${other.slug}.html">${escape(other.title)} ↗</a>`).join('');
 await emit('blog/'+post.slug+'.html',head(post.title,post.description,'blog/'+post.slug+'.html','../')+nav('../')+`<main id="mkt-content" class="mktPageMain"><p class="mktBreadcrumb"><a href="../">Strona główna</a> / <a href="index.html">Poradniki</a> / ${escape(post.category)}</p><p class="mktEyebrow">${escape(post.category)}</p><h1 class="mktPageTitle">${escape(post.title)}</h1><p class="mktPageLead">${escape(post.description)}</p><p class="mktArticleMeta">Dokumentacja HOME SECURITY · Aktualizacja: <time datetime="2026-10-25">25 października 2026</time></p><div class="mktArticleLayout"><article class="mktArticle">${article}</article><aside class="mktArticleAside"><h2>Przydatne dalej</h2>${related}<a href="../pomoc.html">Skontaktuj się z administratorem ↗</a><a href="../#stan-projektu">Sprawdź stan projektu ↗</a></aside></div></main>`+footer('../')+'\n</body></html>\n');
}
const gallery=await read(source,'gallery.html');
await emit('galeria.html',head('Galeria projektów panelu i telefonu','Zobacz osiem koncepcji interfejsu HOME SECURITY: pulpit, sterowanie, nagrania, diagnostyka i telefon. To projekty UI, nie rzeczywiste zrzuty aplikacji.','galeria.html')+nav()+gallery+footer()+'\n</body></html>\n');
const contact=await read(source,'contact.html');
await emit('pomoc.html',head('Kontakt i pomoc','Skontaktuj się z administratorem HOME SECURITY. Pomoc techniczna, konfiguracja, nagrania i pytania o produkt.','pomoc.html')+nav()+contact+footer()+'<script src="vendor/supabase.js?v=2.117.2"></script><script type="module" src="marketing-contact.js?v=8"></script>\n</body></html>\n');
const paths=['','galeria.html','pomoc.html','blog/index.html',...posts.map(post=>'blog/'+post.slug+'.html')];
await emit('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+paths.map(path=>`<url><loc>${origin+path}</loc></url>`).join('\n')+'\n</urlset>\n');
console.log((check?'Verified':'Generated')+' marketing home, UI gallery, contact, blog index, 3 articles and sitemap.');
