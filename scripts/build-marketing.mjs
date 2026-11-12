// Compile public, static marketing pages. The private application stays in panel.html.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url),camera=new URL('kamera/',root),source=new URL('design/marketing/',root);
const check=process.argv.includes('--check');
const normalize=text=>text.replace(/\r\n/g,'\n');
const read=async(base,name)=>normalize(await readFile(new URL(name,base),'utf8'));
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const origin='https://dominiksolorz.github.io/kamera/';
const publicOrigin=origin; // Reliable, tested GitHub Pages release.
const publicBuild=JSON.parse(await read(camera,'version.json')).version;
const currentDesktopRelease=process.env.HOME_SECURITY_DESKTOP_RELEASE||JSON.parse(await read(camera,'desktop-update.json')).version;
async function emit(name,html){
  const file=new URL(name,camera);
  if(check){if(normalize(await readFile(file,'utf8'))!==html)throw new Error('Outdated generated marketing page: '+name);}
  else{await mkdir(new URL('./',file),{recursive:true});await writeFile(file,html);}
}
function head(title,description,path,prefix=''){
const canonical=(path==='pomoc.html'?origin:publicOrigin)+path;
return `<!doctype html>\n<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="home-security-build" content="${publicBuild}"><meta name="home-security-desktop" content="${currentDesktopRelease}"><meta name="theme-color" content="#0b0c10"><meta name="referrer" content="no-referrer"><meta name="robots" content="index,follow"><title>${escape(title)} — HOME SECURITY</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:locale" content="pl_PL"><meta property="og:title" content="${escape(title)} — HOME SECURITY"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}assets/home-security-hero.png"><link rel="icon" href="${prefix}icons/kamera-192.svg" type="image/svg+xml"><link rel="apple-touch-icon" sizes="180x180" href="${prefix}icons/apple-touch-icon.png"><link rel="stylesheet" href="${prefix}marketing.css?v=19"><link rel="stylesheet" href="${prefix}marketing-motion.css?v=3"><script type="module" src="${prefix}marketing-motion.mjs?v=3"></script><link rel="stylesheet" href="${prefix}marketing-navigation.css?v=4"><script type="module" src="${prefix}marketing-navigation.mjs?v=2"></script><link rel="stylesheet" href="${prefix}marketing-auto-update.css?v=3"><script type="module" src="${prefix}marketing-auto-update.mjs?v=6"></script><link rel="stylesheet" href="${prefix}tech-theme.css?v=8"></head>\n<body class="marketingPage">\n`;
}
// Header, mobile menu, footer and phone tab bar come from the homepage source,
// so every public page shows exactly the same navigation as the homepage.
const homeSource=await read(source,'home.html');
const homePart=re=>{const m=homeSource.match(re);if(!m)throw new Error('Homepage navigation part missing: '+re);return m[0];};
const homeHeader=homePart(/<header class="mktHeader">[\s\S]*?<\/header>/),homeFooter=homePart(/<footer class="mktFooter">[\s\S]*?<\/footer>/),homeTabs=homePart(/<nav class="mktTabBar"[\s\S]*?<\/nav>/);
function localize(html,prefix,path){
 return html.replaceAll(' aria-current="page"','').replace(/(href|src)="(?!https?:|mailto:|tel:|#)([^"]*)"/g,(m,attr,value)=>{
  const target=value==='./'?(prefix||'./'):prefix+value;
  const current=attr==='href'&&path!==null&&(value===path||(value==='./'&&path===''));
  return attr+'="'+target+'"'+(current?' aria-current="page"':'');
 });
}
function nav(prefix='',path=null){return '<a class="mktSkip" href="#mkt-content">Przejdź do treści</a>'+localize(homeHeader,prefix,path);}
function footer(prefix='',path=null){return localize(homeFooter,prefix,path)+localize(homeTabs,prefix,path);}
const home=(await read(source,'home.html')).replaceAll('__DESKTOP_RELEASE__',currentDesktopRelease);
const index=await read(camera,'panel.html');
const slot=/<(?:section|div)(?: role="group")? id="publicHome"[\s\S]*?<\/(?:section|div)>(?=\s*<section id="authDialog")/;
if(!slot.test(index))throw new Error('Public marketing slot not found; private panel not modified.');
await emit('panel.html',index.replace(slot,home.trimEnd()));
const publicContent=home;
// Callback OAuth i potwierdzeń kont musi dotrzeć do panelu nawet w sytuacji,
// gdy stary plik public-entry.js pozostał w pamięci PWA.
const accountReturnBridge = `<script src="desktop-auth-return.js?v=1"></script><script>(function(){
  if (window.__hsDesktopOAuthReturning) return;
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (!(query.has("code") || query.has("error") || fragment.has("access_token") ||
        fragment.has("error") || fragment.get("type") === "recovery")) return;
  const target = new URL("./panel.html", location.href);
  target.search = location.search;
  target.searchParams.set("auth", "confirmed");
  target.hash = location.hash;
  location.replace(target.href);
})();</script>`;
const publicHome=head('Monitoring domu i podgląd','HOME SECURITY: monitoring domowy przez komputer Windows i telefon. Zobacz podgląd, archiwum nagrań, wymagania i instrukcje konfiguracji.','')
 .replace('</head>',accountReturnBridge+'<script src="public-entry.js?v=9"></script><link rel="manifest" href="manifest.webmanifest?v=4"></head>')
 +publicContent+'\n</body></html>\n';
await emit('index.html',publicHome);
// Keep old inbound product links working; canonical points at the single homepage.
await emit('o-systemie.html',publicHome);
const topicPages=JSON.parse(await read(source,'pages.json'));
for(const page of topicPages){
 if(!/^[a-z0-9-]+$/.test(page.slug))throw Error('Invalid topic slug');
 const file=page.slug+'.html';
 const body=(await read(source,file)).replaceAll('__DESKTOP_RELEASE__',currentDesktopRelease);
 const assets=page.assets==='gallery'?'<link rel="stylesheet" href="marketing-gallery.css?v=5"><script type="module" src="marketing-gallery.mjs?v=2"></script>':page.assets==='start'?'<link rel="stylesheet" href="marketing-start.css?v=4"><script type="module" src="marketing-start.mjs?v=2"></script>':page.assets==='support'?'<link rel="stylesheet" href="support.css?v=2"><script type="module" src="support-entry.mjs?v=4"></script>':'';
 const intro=`<div class="mktPageIntro mktContainer"><p class="mktBreadcrumb"><a href="./">Strona główna</a> / ${escape(page.title)}</p><h1 class="mktPageTitle">${escape(page.title)}</h1><p class="mktPageLead">${escape(page.description)}</p></div>`;
 await emit(file,head(page.title,page.description,file).replace('</head>',assets+'</head>')+'<div role="group" id="publicHome" class="publicHome mktSite" aria-label="'+escape(page.title)+'">'+nav('',file)+'<main id="mkt-content" class="mktMain">'+intro+body+'</main>'+footer('',file)+'</div>\n</body></html>\n');
}
const posts=JSON.parse(await read(source,'posts.json'));
for(const post of posts)if(!/^[a-z0-9-]+$/.test(post.slug))throw new Error('Invalid article slug.');
const cards=posts.map(post=>`<a class="mktPost" href="${post.slug}.html"><span class="mktPostArt ${escape(post.art)}" aria-hidden="true">${escape(post.number)} <i>PORADNIK</i></span><span class="mktPostCategory">${escape(post.category.toUpperCase())}</span><h2>${escape(post.title)}</h2><p>${escape(post.description)}</p><span class="mktTextLink">Czytaj poradnik ↗</span></a>`).join('\n');
await emit('blog/index.html',head('Blog i poradniki','Praktyczne poradniki HOME SECURITY: pierwsze uruchomienie, kamera, folder nagrań, Google Drive i diagnostyka.','blog/index.html','../')+nav('../','blog/index.html')+`<main id="mkt-content" class="mktPageMain"><p class="mktBreadcrumb"><a href="../">Strona główna</a> / Centrum wiedzy</p><p class="mktEyebrow">BLOG I PORADNIKI</p><h1 class="mktPageTitle">Blog i poradniki<br>HOME SECURITY</h1><p class="mktPageLead">Blog i poradniki HOME SECURITY pomagają przygotować komputer, otworzyć panel na telefonie i sprawdzić, czy nagrania rzeczywiście trafiają do wybranego folderu.</p><div class="mktPosts">${cards}</div><section class="mktReadingGuide" aria-labelledby="guide-reading-title"><h2 id="guide-reading-title">Który poradnik wybrać?</h2><p>Jeśli uruchamiasz HOME SECURITY po raz pierwszy, zacznij od instrukcji instalacji i konfiguracji. Opisuje kolejność przygotowania komputera, konta, PIN-u oraz folderu na nagrania. Telefon otwiera panel właściciela; komputer z kamerą pozostaje nadajnikiem obrazu. Najpierw sprawdź działanie tego zestawu w swojej sieci.</p><p>Poradnik o zapisie lokalnym i Google Drive przyda się wtedy, gdy chcesz ustalić, gdzie znajdują się pliki. Oddziela potwierdzenie zapisu na dysku od potwierdzenia kopii w chmurze. Sam podgląd obrazu nie dowodzi, że nagranie powstało i można je odtworzyć.</p><p>Gdy obraz działa, ale zapis lub połączenie sprawia kłopot, wybierz instrukcję diagnostyczną. Sprawdź osobno stan kamery, harmonogramu, folderu i sieci. Blog i poradniki opisują funkcje oraz ograniczenia rozwijanego systemu. Przed zgłoszeniem problemu zanotuj urządzenie, godzinę zdarzenia i treść komunikatu. Do formularza pomocy nie wpisuj haseł, PIN-u ani prywatnych linków do podglądu.</p></section><div class="mktNote">Poradniki opisują obecne możliwości i ograniczenia projektu. Nie zastępują sprawdzenia rzeczywistej kamery, pliku i połączenia w Twojej instalacji.</div></main>`+footer('../','blog/index.html')+'\n</body></html>\n');
for(const post of posts){
 const article=await read(source,post.slug+'.html');
 const related=posts.filter(other=>other.slug!==post.slug).map(other=>`<a href="${other.slug}.html">${escape(other.title)} ↗</a>`).join('');
 await emit('blog/'+post.slug+'.html',head(post.title,post.description,'blog/'+post.slug+'.html','../')+nav('../','blog/index.html')+`<main id="mkt-content" class="mktPageMain"><p class="mktBreadcrumb"><a href="../">Strona główna</a> / <a href="index.html">Poradniki</a> / ${escape(post.category)}</p><p class="mktEyebrow">${escape(post.category)}</p><h1 class="mktPageTitle">${escape(post.title)}</h1><p class="mktPageLead">${escape(post.description)}</p><p class="mktArticleMeta">Dokumentacja HOME SECURITY · Aktualizacja: <time datetime="2026-10-25">25 października 2026</time></p><div class="mktArticleLayout"><article class="mktArticle">${article}</article><aside class="mktArticleAside"><h2>Przydatne dalej</h2>${related}<a href="../pomoc.html">Skontaktuj się z administratorem ↗</a><a href="../stan-projektu.html">Sprawdź stan projektu ↗</a></aside></div></main>`+footer('../','blog/index.html')+'\n</body></html>\n');
}
const gallery=await read(source,'gallery.html');
await emit('galeria.html',head('Galeria projektów panelu i telefonu','Zobacz osiem koncepcji interfejsu HOME SECURITY: pulpit, sterowanie, nagrania, diagnostyka i telefon. To projekty UI, nie rzeczywiste zrzuty aplikacji.','galeria.html')+nav('','galeria.html')+gallery+footer('','galeria.html')+'\n</body></html>\n');
const contact=await read(source,'contact.html');
const helpLinks=await read(source,'help-links.html');
const contactRuntime='<script src="vendor/supabase.js?v=2.117.2"></script><script type="module" src="marketing-contact.js?v=9"></script>\n</body></html>\n';
await emit('kontakt.html',head('Kontakt z administratorem','Napisz do administratora HOME SECURITY. Formularz kontaktowy oraz dane kontaktu.','kontakt.html')+nav('','kontakt.html')+contact+footer('','kontakt.html')+contactRuntime);
const help=contact.replace(/(<p class="mktPageLead">[\s\S]*?<\/p>)/,'$1'+helpLinks);
await emit('pomoc.html',head('Kontakt i pomoc','Skontaktuj się z administratorem HOME SECURITY. Pomoc techniczna, konfiguracja, nagrania i pytania o produkt.','pomoc.html')+nav('','pomoc.html')+help+footer('','pomoc.html')+'<script src="vendor/supabase.js?v=2.117.2"></script><script type="module" src="marketing-contact.js?v=9"></script>\n</body></html>\n');


if(!/^\d+\.\d+\.\d+$/.test(currentDesktopRelease))throw new Error('Invalid published Windows version');
const androidFallback={url:'https://github.com/DominikSolorz/dominiksolorz.github.io/releases/download/android-preview-0.2.0-7c3871b/HOME-SECURITY-Android-0.2.0-preview.apk',versionName:'0.2.0-preview',size:5593362};
const androidMeta=JSON.parse(await read(camera,'android-update.json'));
const androidRelease=androidMeta.enabled?androidMeta:androidFallback;
if(!/^https:\/\/github\.com\/DominikSolorz\/dominiksolorz\.github\.io\/releases\/download\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+\.apk$/.test(androidRelease.url)||!/^\d+\.\d+\.\d+(?:-preview)?$/.test(androidRelease.versionName)||!Number.isSafeInteger(androidRelease.size)||androidRelease.size<=0)throw Error('Invalid Android release metadata');

const downloadSource=(await read(source,'pobierz.html')).replaceAll('__DESKTOP_RELEASE__',currentDesktopRelease).replaceAll('__ANDROID_APK_URL__',escape(androidRelease.url)).replaceAll('__ANDROID_VERSION__',escape(androidRelease.versionName)).replaceAll('__ANDROID_SIZE__',(androidRelease.size/1000000).toFixed(1).replace('.',','));
const downloadStyles=downloadSource.match(/<style>[\s\S]*?<\/style>/)?.[0]||'';
const downloads=downloadSource.replace(downloadStyles,'');
await emit('pobierz.html',head('Pobierz aplikację na Windows, Android i iPhone','Pobierz HOME SECURITY na Windows i sprawdź, jak dodać panel na Androidzie i iPhonie. Instalator, wymagania i instrukcje w jednym miejscu.','pobierz.html').replace('</head>',downloadStyles+'<link rel="manifest" href="manifest.webmanifest?v=4"><script type="module" src="android-install.mjs?v=1"></script></head>')+nav('','pobierz.html')+downloads+footer('','pobierz.html')+'\n</body></html>\n');
const paths=['','kontakt.html','pomoc.html',...topicPages.map(page=>page.slug+'.html'),'pobierz.html','galeria.html','blog/index.html',...posts.map(post=>'blog/'+post.slug+'.html')];
await emit('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+paths.map(path=>`<url><loc>${publicOrigin+path}</loc></url>`).join('\n')+'\n</urlset>\n');
console.log((check?'Verified':'Generated')+' marketing home, UI gallery, contact, blog index, 3 articles and sitemap.');
await import('./build-documents.mjs');
