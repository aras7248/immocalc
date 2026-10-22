import { mkdir,copyFile,readdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url);const out=new URL('public/ocr/',root);
await mkdir(new URL('core/',out),{recursive:true});await mkdir(new URL('lang/',out),{recursive:true});
await copyFile(new URL('node_modules/tesseract.js/dist/worker.min.js',root),new URL('worker.min.js',out));
for(const name of await readdir(new URL('node_modules/tesseract.js-core/',root))){if(/^tesseract-core.*\.(wasm|js)$/.test(name))await copyFile(new URL('node_modules/tesseract.js-core/'+name,root),new URL('core/'+name,out));}
const expected='10a2a6384a31c960d9152b8a25792078ee3d0f55';
const target=new URL('lang/deu.traineddata.gz',out);
const gitHash=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
let bytes;try{bytes=await readFile(target);}catch{/* First build downloads a pinned language asset. */}
if(!bytes||gitHash(bytes)!==expected){
 const response=await fetch('https://raw.githubusercontent.com/naptha/tessdata/806cd9adc8c6e8abc11c782db1818c990576bebc/4.0.0/deu.traineddata.gz');
 if(!response.ok)throw Error('Deutsche OCR-Sprachdaten konnten nicht bereitgestellt werden.');
 bytes=Buffer.from(await response.arrayBuffer());if(gitHash(bytes)!==expected)throw Error('OCR-Sprachdaten: Integritätsprüfung fehlgeschlagen.');await writeFile(target,bytes);
}
for(const pkg of ['tesseract.js','tesseract.js-core']){
 for(const name of await readdir(new URL('node_modules/'+pkg+'/',root)))if(/^license/i.test(name))await copyFile(new URL('node_modules/'+pkg+'/'+name,root),new URL(pkg+'-'+name,out));
}
await writeFile(new URL('NOTICE.txt',out),'OCR worker and WebAssembly core: Tesseract.js/Tesseract.js-core, licenses alongside. German traineddata: https://github.com/naptha/tessdata/tree/806cd9adc8c6e8abc11c782db1818c990576bebc/4.0.0\nPinned Git blob: '+expected+'\n');
console.log('OCR-Worker, WebAssembly-Core und deutsche Sprachdaten lokal bereitgestellt.');
