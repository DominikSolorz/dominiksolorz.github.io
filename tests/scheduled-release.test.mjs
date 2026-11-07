import test from 'node:test';
import assert from 'node:assert/strict';
import {nextVersion,fingerprintEntries,distribution} from '../scripts/desktop-release.mjs';
import {installerFor} from '../kamera/marketing-downloads.mjs';
import {readFile} from 'node:fs/promises';
test('scheduled release increments only the desktop patch',()=>{
 assert.equal(nextVersion('1.4.11'),'1.4.12');assert.throws(()=>nextVersion('latest'));assert.throws(()=>nextVersion('../1.4.11'));
});
test('source fingerprint is cross-platform, order independent and detects actual changes',()=>{
 const a=[['a.cs',Buffer.from('a\r\nb')],['b.png',Buffer.from([0,1,2])]];
 const b=[['b.png',Buffer.from([0,1,2])],['a.cs',Buffer.from('a\nb')]];
 assert.equal(fingerprintEntries(a),fingerprintEntries(b));
 assert.notEqual(fingerprintEntries(a),fingerprintEntries([['a.cs',Buffer.from('changed')],a[1]]));
 assert.notEqual(fingerprintEntries(a),fingerprintEntries([a[0],['b.png',Buffer.from([0,1,3])]]));
});
test('distribution rejects external destinations and malformed release metadata',()=>{
 const m={version:'1.4.11',sha256:'a'.repeat(64),packageUrl:'https://dominiksolorz.github.io/kamera/updates/HomeSecurityDesktop-1.4.11-win-x64.zip'};
 assert.ok(distribution(m).installer.endsWith('1.4.11.exe'));
 assert.throws(()=>distribution({...m,packageUrl:'https://evil.example/update.zip'}));
 assert.throws(()=>distribution({...m,sha256:''}));
});
test('public download derives its location from a validated version, never a supplied external URL',()=>{
 assert.ok(installerFor({version:'1.4.12',installerUrl:'https://evil.example/a.exe'}).endsWith('/downloads/HOME-SECURITY-Desktop-Setup-1.4.12.exe'));
 assert.throws(()=>installerFor({version:'../../evil'}));
});
test('the main homepage and brochure both load manifest-driven downloads',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
 assert.ok((await read('kamera/panel.html')).includes('src="marketing-downloads.mjs?v=2"'));
 assert.ok((await read('kamera/marketing-auto-update.mjs')).includes("import './marketing-downloads.mjs?v=2'"));
});

test('Windows release retries promptly when tests are fixed after a failed push',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/desktop-scheduled-release.yml',import.meta.url),'utf8');
 assert.ok(workflow.includes("- 'tests/**'"),'test-only fixes must trigger a new release check');
 assert.ok(workflow.includes("node scripts/desktop-release.mjs plan"),'unchanged application sources must not create duplicate installers');
});


test('Windows patch preparation never rewrites metadata-driven production release checker',async()=>{
 const script=await readFile(new URL('../scripts/desktop-release.mjs',import.meta.url),'utf8');
 const prepare=script.slice(script.indexOf("if(command==='prepare')"),script.indexOf("if(command==='finish')"));
 assert.ok(prepare.includes('desktop-client/Program.cs'));
 assert.ok(prepare.includes('scripts/build-marketing.mjs'),'generated public pages must use the release renderer');
 assert.ok(!prepare.includes("'scripts/verify-live-marketing.mjs'"),
   'the production checker is manifest-driven and must not be treated as release-number template');
 const live=await readFile(new URL('../scripts/verify-live-marketing.mjs',import.meta.url),'utf8');
 assert.ok(live.includes('expectedDesktop.version'),'live checker uses current manifest version');
 assert.ok(live.includes("await get('desktop-update.json')"),'live checker verifies published version');
});


test('finishing a Windows release regenerates download pages before fingerprinting',async()=>{
 const {mkdtemp,mkdir,writeFile,rm,copyFile}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {execFileSync}=await import('node:child_process');
 const root=await mkdtemp(join(tmpdir(),'hs-release-sync-'));
 try {
  for(const dir of ['scripts','kamera/updates','kamera/downloads'])await mkdir(join(root,dir),{recursive:true});
  await copyFile(new URL('../scripts/desktop-release.mjs',import.meta.url),join(root,'scripts/desktop-release.mjs'));
  await writeFile(join(root,'scripts/build-marketing.mjs'),`import {readFile,writeFile} from 'node:fs/promises';const m=JSON.parse(await readFile('kamera/desktop-update.json','utf8'));await writeFile('kamera/pobierz.html','Windows '+m.version);`);
  await writeFile(join(root,'kamera/desktop-update.json'),JSON.stringify({version:'1.2.3'}));
  await writeFile(join(root,'kamera/pobierz.html'),'Windows 1.2.3');
  await writeFile(join(root,'kamera/updates/HomeSecurityDesktop-1.2.4-win-x64.zip'),'package');
  await writeFile(join(root,'kamera/downloads/HOME-SECURITY-Desktop-Setup-1.2.4.exe'),'installer');
  execFileSync('git',['init','-q'],{cwd:root});execFileSync('git',['add','.'],{cwd:root});
  execFileSync(process.execPath,['scripts/desktop-release.mjs','finish'],{cwd:root});
  const manifest=JSON.parse(await readFile(join(root,'kamera/desktop-update.json'),'utf8'));
  assert.equal(manifest.version,'1.2.4');
  assert.equal(await readFile(join(root,'kamera/pobierz.html'),'utf8'),'Windows 1.2.4');
  const paths=execFileSync('git',['ls-files','-z','--','kamera'],{cwd:root,encoding:'utf8'}).split('\0').filter(p=>p&&!/^kamera\/(updates|downloads)\//.test(p)&&p!=='kamera/desktop-update.json');
  assert.equal(manifest.sourceFingerprint,fingerprintEntries(await Promise.all(paths.map(async p=>[p,await readFile(join(root,p))]))));
 }finally{await rm(root,{recursive:true,force:true});}
});
