import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {execFileSync} from 'node:child_process';
test('legal document generation and checks agree for Windows CRLF source checkouts',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'HomeSecurity-documents-'));
 try{
  await mkdir(join(directory,'scripts'));await mkdir(join(directory,'kamera'));
  await cp(new URL('../scripts/build-documents.mjs',import.meta.url),join(directory,'scripts/build-documents.mjs'));
  await cp(new URL('../design/documents/',import.meta.url),join(directory,'design/documents'),{recursive:true});
  const run=args=>execFileSync(process.execPath,['scripts/build-documents.mjs',...args],{cwd:directory,encoding:'utf8'});
  run([]);const before=await readFile(join(directory,'kamera/rodo.html'),'utf8');
  for(const name of await readdir(join(directory,'design/documents'))){const file=join(directory,'design/documents',name);await writeFile(file,(await readFile(file,'utf8')).replaceAll('\r\n','\n').replaceAll('\n','\r\n'));}
  assert.match(run(['--check']),/Verified six/);
  run([]);assert.equal(await readFile(join(directory,'kamera/rodo.html'),'utf8'),before);
 }finally{
  if(dirname(resolve(directory))!==resolve(tmpdir())||!basename(directory).startsWith('HomeSecurity-documents-'))throw Error('Unexpected test cleanup path');
  await rm(directory,{recursive:true,force:true});
 }
});
