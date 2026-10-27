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
 assert.ok((await read('kamera/index.html')).includes('src="marketing-downloads.mjs?v=1"'));
 assert.ok((await read('kamera/marketing-auto-update.mjs')).includes("import './marketing-downloads.mjs?v=1'"));
});
