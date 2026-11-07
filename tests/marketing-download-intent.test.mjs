import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('brochure does not fetch installer metadata until download; click verifies latest release',async()=>{
 const listeners={},requests=[],navigations=[];
 const link={href:'https://example.test/kamera/downloads/HOME-SECURITY-Desktop-Setup-1.0.0.exe',addEventListener:(name,fn)=>listeners[name]=fn,after(node){this.nextElementSibling=node;}};
 const document={querySelectorAll:()=>[link],createElement:()=>({className:'',setAttribute(){}})};
 const window={location:{assign:href=>navigations.push(href)},addEventListener(){throw Error('Unnecessary focus refresh');},setInterval(){throw Error('Unnecessary polling');}};
 const code=(await readFile(new URL('../kamera/marketing-downloads.mjs',import.meta.url),'utf8')).replaceAll('export function','function').replaceAll('import.meta.url',JSON.stringify('https://example.test/kamera/marketing-downloads.mjs'));
 vm.runInNewContext(code,{document,window,URL,Date,AbortSignal,fetch:async(url)=>{requests.push(url.href);return {ok:true,json:async()=>({version:'1.9.2'})};}});
 assert.equal(requests.length,0);assert.equal(navigations.length,0);
 let prevented=false;await listeners.click({preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(requests.length,1);
 assert.match(requests[0],/\/kamera\/desktop-update\.json\?check=/);
 assert.deepEqual(navigations,['https://example.test/kamera/downloads/HOME-SECURITY-Desktop-Setup-1.9.2.exe']);
 assert.equal(link.href,navigations[0]);
});
