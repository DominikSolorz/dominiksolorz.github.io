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
 assert.ok(prepare.includes('kamera/panel.html'));
 assert.ok(!prepare.includes("'scripts/verify-live-marketing.mjs'"),
   'the production checker is manifest-driven and must not be treated as release-number template');
 const live=await readFile(new URL('../scripts/verify-live-marketing.mjs',import.meta.url),'utf8');
 assert.ok(live.includes('expectedDesktop.version'),'live checker uses current manifest version');
 assert.ok(live.includes("await get('desktop-update.json')"),'live checker verifies published version');
});
