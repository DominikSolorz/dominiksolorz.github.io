// Static imports under a hash-based strict CSP must not create untrusted child requests.
// Bundle the two small dependency trees; the assistant still initializes only after a click.
import {build} from 'esbuild';
import {resolve,basename} from 'node:path';
import {writeFile} from 'node:fs/promises';
const camera=resolve(process.argv[2]||'_site','kamera');
for(const entry of ['marketing-auto-update.mjs','support-entry.mjs']){
 const result=await build({entryPoints:[resolve(camera,entry)],outfile:resolve(camera,entry),
  allowOverwrite:true,write:false,bundle:true,format:'esm',platform:'browser',
  minify:true,keepNames:true,sourcemap:'external',legalComments:'inline',
  plugins:[{name:'local-versioned-imports',setup(builder){
   builder.onResolve({filter:/\?v=\d+$/},args=>({path:resolve(args.resolveDir,args.path.split('?')[0])}));
  }}]});
 for(const file of result.outputFiles)await writeFile(file.path,file.path.endsWith(".mjs") ? file.text+"\n//# sourceMappingURL="+basename(file.path)+".map\n" : file.contents);
 console.log('Bundled public dependency tree: '+entry);
}
