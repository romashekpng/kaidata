import { PUBLICATION_ASSETS } from '../src/publication.js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
const root=new URL('../',import.meta.url);
const read=relative=>readFile(new URL(relative,root),'utf8');
const strip=source=>source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
function module(source){
 const names=[...source.matchAll(/^export (?:async )?(?:const|function) (\w+)/gm)].map(m=>m[1]);
 return `const {${names.join(',')}} = (()=>{\n${strip(source)}\nreturn {${names.join(',')}};\n})();\n`;
}
let app=strip(await read('src/app.js'));
const fetchLine="const response=await fetch('./data/demo.json');if(!response.ok)throw new Error('Не вдалося завантажити початковий набір даних.');demo=validateBundle(await response.json());";
if(!app.includes(fetchLine))throw new Error('Preview builder: application bootstrap changed.');
const demoJSON=(await read('data/demo.json')).replaceAll('<','\\u003c');
app=app.replace(fetchLine,()=>`demo=validateBundle(${demoJSON});`).replace("'kai-science.v1'","'kai-science.offline.v1'").replace("'kai-science.theme.v1'","'kai-science.offline.theme.v1'");
const pagesLine="const pagesResponse=await fetch('./data/pages.json');if(!pagesResponse.ok)throw new Error('Не вдалося завантажити сторінки сайта.');cms.init(await pagesResponse.json());";
if(!app.includes(pagesLine))throw new Error('Preview builder: CMS bootstrap changed.');
const pagesJSON=(await read('data/pages.json')).replaceAll('<','\\u003c');
app=app.replace(pagesLine,()=>`cms.init(${pagesJSON});`);
const names=PUBLICATION_ASSETS;
const assets=Object.fromEntries(await Promise.all(names.map(async name=>[name,await read(name)])));
const script=module(await read('src/style-data.js'))+module(await read('src/data.js'))+module(await read('src/icons.js'))+module(await read('src/spreadsheet.js'))+module(await read('src/cms-data.js'))+module(await read('src/block-view.js'))+module(await read('src/cms-io.js'))+module(await read('src/analytics.js'))+module(await read('src/chart-runtime.js'))+module(await read('src/site-view.js'))+module(await read('src/publication.js'))+module(await read('src/zip.js'))+module(await read('src/cms.js'))+app;
if(/<\/script/i.test(script))throw new Error('Unexpected script closing tag.');
const vendor=(await read('src/vendor/exceljs.min.js')).replace(/<\/script/gi,'<\\/script');
let html=await read('index.html');
const styles=await read('styles.css');
html=html.replace(/<link rel="stylesheet" href="\.\/styles\.css(?:\?[^"<>]*)?">/,()=>`<style>\n${styles}\n</style>`).replace(/<script type="module" src="\.\/src\/app\.js(?:\?[^"<>]*)?"><\/script>/,'');
// Keep one self-contained HTML while avoiding multi-megabyte source lines in the
// chat preview. Library sources remain available byte for byte for ZIP exports.
const payload=gzipSync(Buffer.from(JSON.stringify({assets,vendor,script})),{level:9}).toString('base64').match(/.{1,120}/g).join('\n');
const boot=`<script id="kai-preview-payload" type="application/octet-stream">\n${payload}\n</script>
<script>
(async()=>{
 try{
  const encoded=document.getElementById('kai-preview-payload').textContent.replace(/\\s/g,'');
  const bytes=Uint8Array.from(atob(encoded),character=>character.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const bundle=JSON.parse(await new Response(stream).text());
  globalThis.KAI_PUBLIC_ASSETS=bundle.assets;
  const vendor=document.createElement('script');vendor.textContent=bundle.vendor;document.head.append(vendor);
  const app=document.createElement('script');app.type='module';app.textContent=bundle.script;document.body.append(app);
 }catch(error){
  const target=document.querySelector('#content .loading');
  if(target){target.setAttribute('role','alert');target.textContent='Не вдалося відкрити локальний перегляд. Оновіть браузер до актуальної версії та відкрийте файл повторно.';}
  console.error('KAI preview bootstrap:',error);
 }
})();
<\/script>`;
html=html.replace('</body>',()=>boot+'\n</body>');
const out=path.resolve(process.argv[2]||'/workspace/artifacts/index.html');
await mkdir(path.dirname(out),{recursive:true});await writeFile(out,html);console.log(`Standalone HTML with CSV/XLSX support: ${out}`);
