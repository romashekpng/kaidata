import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root=new URL('../',import.meta.url);
const read=relative=>readFile(new URL(relative,root),'utf8');
const strip=source=>source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
function module(source){
 const names=[...source.matchAll(/^export (?:async )?(?:const|function) (\w+)/gm)].map(m=>m[1]);
 return `const {${names.join(',')}} = (()=>{\n${strip(source)}\nreturn {${names.join(',')}};\n})();\n`;
}
let app=strip(await read('src/app.js'));
const fetchLine="const response=await fetch('/data/demo.json');if(!response.ok)throw new Error('Не вдалося завантажити початковий набір даних.');demo=validateBundle(await response.json());";
if(!app.includes(fetchLine))throw new Error('Preview builder: application bootstrap changed.');
app=app.replace(fetchLine,`demo=validateBundle(${(await read('data/demo.json')).replaceAll('<','\\u003c')});`).replace("'kai-science.v1'","'kai-science.offline.v1'");
const script=module(await read('src/data.js'))+module(await read('src/icons.js'))+module(await read('src/spreadsheet.js'))+app;
if(/<\/script/i.test(script))throw new Error('Unexpected script closing tag.');
const vendor=(await read('src/vendor/exceljs.min.js')).replace(/<\/script/gi,'<\\/script');
let html=await read('index.html');
html=html.replace('<link rel="stylesheet" href="/styles.css">',`<style>\n${await read('styles.css')}\n</style>`).replace('<script type="module" src="/src/app.js"></script>','');
html=html.replace('</body>',`<script>\n${vendor}\n</script><script type="module">\n${script}\n</script>\n</body>`);
const out=path.resolve(process.argv[2]||'/workspace/artifacts/kai-science.html');
await mkdir(path.dirname(out),{recursive:true});await writeFile(out,html);console.log(`Standalone HTML with CSV/XLSX support: ${out}`);
