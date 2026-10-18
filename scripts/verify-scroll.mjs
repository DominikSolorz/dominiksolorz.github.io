// Isolated layout fixture: real styles, no camera, account or recorder code.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
const styles=await Promise.all(['style.css','workspace-ui.css'].map(file=>readFile(new URL('../kamera/'+file,import.meta.url),'utf8')));
const rows=Array.from({length:45},(_,i)=>`<p>Wiersz kontrolny ${i+1}</p>`).join('');
const html=`<!doctype html><html lang="pl" class="desktopMode"><meta charset="utf-8"><title>Kontrola przewijania układu</title><style>${styles.join('\n')}</style><body class="desktopMode archiveOpen"><section class="archiveModal" aria-label="Kontrola przewijania"><header class="archiveModalHead"><h1>Kontrola przewijania</h1><p>Układ testowy, bez danych kamery</p></header><div class="archiveWorkspace"><div class="archiveModalBody"><article class="archivePlaybackStage">Obszar podglądu</article><section id="dvrCard" class="card"><h2>Oś czasu</h2>${rows}</section><section id="dvrListCard" class="card"><h2>Lista plików</h2>${rows}</section><p>Koniec lewej kolumny</p></div><aside class="archiveStorageSidebar"><h2>Folder zapisu</h2>${rows}<button>Koniec prawej kolumny</button></aside></div></section></body></html>`;
const server=http.createServer((req,res)=>{
 if(req.url!=='/'||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:html);
});
server.listen(0,'127.0.0.1',()=>console.log(`http://127.0.0.1:${server.address().port}/`));
setTimeout(()=>server.close(),10*60*1000).unref();
