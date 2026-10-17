import http from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=await realpath(fileURLToPath(new URL('../kamera/',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.ico':'image/x-icon','.exe':'application/octet-stream'};
const server=http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const url=new URL(req.url,'http://127.0.0.1:4173');
  const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const candidate=path.resolve(root,relative||'index.html');
  const resolved=await realpath(candidate);
  if(resolved!==root&&!resolved.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const details=await stat(resolved);if(!details.isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(resolved)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:await readFile(resolved));
 }catch{res.writeHead(404);res.end('Nie znaleziono pliku.');}
});
server.listen(4173,'127.0.0.1',()=>console.log('HOME SECURITY preview: http://127.0.0.1:4173/'));
