// Deterministic release planning; never accesses a user's installed application.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function nextVersion(version){
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid desktop version');
  const parts=version.split('.').map(Number);parts[2]++;return parts.join('.');
}
export function fingerprintEntries(entries){
  const hash=createHash('sha256');
  for(const [name,bytes] of [...entries].sort((a,b)=>a[0].localeCompare(b[0],'en'))){
    const text=/\.(?:js|mjs|json|html|css|cs|csproj|ps1|iss|md|webmanifest|svg|xml|txt)$/.test(name);
    const data=text?Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n')):bytes;
    hash.update(name);hash.update('\0');hash.update(String(data.length));hash.update('\0');hash.update(data);
  }
  return hash.digest('hex');
}
export async function sourceFingerprint(){
  const paths=execFileSync('git',['ls-files','-z','--','kamera','desktop-client','agent','agent-client','agent-contracts','design/marketing'],{encoding:'utf8'}).split('\0').filter(Boolean)
    .filter(p=>!/^kamera\/(updates|downloads)\//.test(p)&&p!=='kamera/desktop-update.json');
  return fingerprintEntries(await Promise.all(paths.map(async p=>[p,await readFile(p)])));
}
export function distribution(manifest){
  if(!/^\d+\.\d+\.\d+$/.test(manifest.version)||!/^[a-f0-9]{64}$/i.test(manifest.sha256))throw Error('Invalid distribution manifest');
  const zip=`kamera/updates/HomeSecurityDesktop-${manifest.version}-win-x64.zip`;
  if(manifest.packageUrl!==`https://dominiksolorz.github.io/${zip}`)throw Error('Unexpected distribution destination');
  return {zip,installer:`kamera/downloads/HOME-SECURITY-Desktop-Setup-${manifest.version}.exe`};
}
async function main(command){
  const manifest=JSON.parse(await readFile('kamera/desktop-update.json','utf8'));
  if(command==='plan'||command==='seed'){
    const fingerprint=await sourceFingerprint();
    if(command==='seed'){
      manifest.sourceFingerprint=fingerprint;await writeFile('kamera/desktop-update.json',JSON.stringify(manifest,null,2)+'\n');return;
    }
    const changed=fingerprint!==manifest.sourceFingerprint;
    console.log(changed?'Source changed: a tested Windows release is needed.':'No application changes; keeping the current installer.');
    if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`changed=${changed}\nversion=${nextVersion(manifest.version)}\n`);
    return;
  }
  if(command==='prepare'){
    const old=manifest.version,version=nextVersion(old);
    for(const path of ['desktop-client/Program.cs','desktop-client/HomeSecurityDesktop.csproj','desktop-client/installer/HomeSecurityDesktop.iss','desktop-client/build-release.ps1','design/marketing/home.html','kamera/index.html','kamera/panel.html','scripts/verify-live-marketing.mjs']){
      let source=(await readFile(path,'utf8')).replaceAll('\r\n','\n');
      if(!source.includes(old))throw Error(`Missing release version in ${path}`);
      source=source.replaceAll(old,version);
      if(path==='desktop-client/Program.cs'){
        const web=JSON.parse(await readFile('kamera/version.json','utf8')).version;
        source=source.replace(/WebPanelBuild = "\d+"/,`WebPanelBuild = "${web}"`);
      }
      await writeFile(path,source);
    }
    execFileSync(process.execPath,['scripts/build-marketing.mjs'],{stdio:'inherit'});return;
  }
  if(command==='finish'){
    const version=nextVersion(manifest.version);
    const zip=`kamera/updates/HomeSecurityDesktop-${version}-win-x64.zip`;
    const installer=`kamera/downloads/HOME-SECURITY-Desktop-Setup-${version}.exe`;
    const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex').toUpperCase();
    await writeFile('kamera/desktop-update.json',JSON.stringify({version,packageUrl:`https://dominiksolorz.github.io/${zip}`,sha256:await hash(zip),installerSha256:await hash(installer),sourceFingerprint:await sourceFingerprint()},null,2)+'\n');return;
  }
  if(command==='fetch'){
    const sha=process.env.GITHUB_SHA;
    if(!/^[a-f0-9]{40}$/i.test(sha||''))throw Error('An immutable GitHub commit is required');
    const {zip,installer}=distribution(manifest);
    const files=[[zip,manifest.sha256],[installer,manifest.installerSha256]];
    if(process.argv.includes('--rollback'))files.push(['kamera/updates/HomeSecurityDesktop-1.4.7-win-x64.zip',null]);
    for(const [path,expected] of files){
      const r=await fetch(`https://raw.githubusercontent.com/DominikSolorz/dominiksolorz.github.io/${sha}/${path}`,{signal:AbortSignal.timeout(240000)});
      if(!r.ok)throw Error(`Distribution HTTP ${r.status}: ${path}`);
      const bytes=Buffer.from(await r.arrayBuffer());
      if(bytes.length<1000000||bytes.length>100000000)throw Error(`Invalid distribution size: ${path}`);
      if(expected&&createHash('sha256').update(bytes).digest('hex').toUpperCase()!==expected.toUpperCase())throw Error(`Distribution checksum mismatch: ${path}`);
      if(path.endsWith('.exe')&&bytes.subarray(0,2).toString()!=='MZ')throw Error('Installer header mismatch');
      await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path,bytes);console.log(`Verified distribution: ${path}`);
    }
    return;
  }
  throw Error('Expected plan, seed, prepare, finish or fetch');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main(process.argv[2]);
