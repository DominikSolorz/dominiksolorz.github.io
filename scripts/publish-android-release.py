#!/usr/bin/env python3
"""Publish only verified distribution files, then advance the update channel."""
import base64,hashlib,json,os,pathlib,subprocess,sys,time
root=pathlib.Path(sys.argv[1]);meta=json.loads((root/'android-update.json').read_text())
repo=os.environ['GITHUB_REPOSITORY'];tag='android-'+meta['versionName'];apk=root/('HOME-SECURITY-Android-'+meta['versionName']+'.apk')
def gh(*args,stdin=None,check=True):
    return subprocess.run(['gh',*args],input=stdin,capture_output=True,text=True,check=check)
assert repo=='DominikSolorz/dominiksolorz.github.io'
assert meta['packageName']=='pl.solorz.homesecurity'
assert meta['sha256']==hashlib.sha256(apk.read_bytes()).hexdigest()
assert meta['size']==apk.stat().st_size
notes=root/'notes.txt'
notes.write_text('HOME SECURITY Android '+meta['versionName']+' (Android 11+).\n'
    'Wydanie rozwojowe, podpisane stalym kluczem wlasciciela. Aktualizator sprawdza nowe wersje po uruchomieniu, po wznowieniu i co 10 minut na pierwszym planie. Instalacje potwierdza uzytkownik w Androidzie.\n'
    'Logowanie: e-mail, haslo i PIN. Logowanie Google w APK nie jest jeszcze dostepne. Wymagany Android System WebView 124+.\n'
    'Testy: kompilacja, testy jednostkowe, lint, podpis i instalacja oraz aktualizacja na emulatorze Android API 35. Bez testu na fizycznym telefonie.\n'
    'Wczesniejszy APK 0.2.0-preview jest osobna aplikacja. Nie przenosimy ani nie usuwamy automatycznie jego danych.\n'
    'Source: '+meta['sourceCommit']+'\n')
existing=gh('release','view',tag,'--json','tagName',check=False)
if existing.returncode==0:
    dest=root/'existing';dest.mkdir()
    gh('release','download',tag,'--pattern',apk.name,'--dir',str(dest))
    if hashlib.sha256((dest/apk.name).read_bytes()).hexdigest()!=meta['sha256']:
        raise RuntimeError('Existing release preserved; APK differs')
else:
    gh('release','create',tag,str(apk),str(root/'SIGNATURE.txt'),str(root/'PACKAGE.txt'),str(root/'SHA256SUMS.txt'),str(root/'android-update.json'),
       '--target',meta['sourceCommit'],'--title','HOME SECURITY Android '+meta['versionName']+' — APK z aktualizacjami',
       '--notes-file',str(notes),'--prerelease','--latest=false')
for attempt in range(3):
    current=json.loads(gh('api','repos/'+repo+'/contents/kamera/android-update.json?ref=main').stdout)
    old=json.loads(base64.b64decode(current['content']))
    if int(old.get('versionCode',0))>=meta['versionCode']:break
    payload={'message':'Wydaj podpisany Android '+meta['versionName'],'branch':'main','sha':current['sha'],'content':base64.b64encode((root/'android-update.json').read_bytes()).decode()}
    result=gh('api','--method','PUT','repos/'+repo+'/contents/kamera/android-update.json','--input','-',stdin=json.dumps(payload),check=False)
    if result.returncode==0:break
    if attempt==2:raise RuntimeError('Could not advance update channel; existing channel preserved')
    time.sleep(2)
gh('workflow','run','pages.yml','--ref','main')
print('Published Android',meta['versionName'],'and requested Pages deployment.')
