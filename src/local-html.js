import { validateBundle } from './data.js?v=local-save-20261103';
import { validateSite } from './cms-data.js?v=local-save-20261103';
export const LOCAL_HTML_MODULES = ['style-data','money','data','icons','sidebar-view','spreadsheet','cms-data','block-view','cms-io','analytics','chart-runtime','site-view','publication','zip','project-reports','local-html','cms'];
const stripLocalImports = source => source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
function localModule(source) {
 const names=[...source.matchAll(/^export (?:async )?(?:const|function) (\w+)/gm)].map(match=>match[1]);
 return `const {${names.join(',')}} = (()=>{\n${stripLocalImports(source)}\nreturn {${names.join(',')}};\n})();\n`;
}
export function localHTMLParts(assets, data, site, {theme='blue',startRoute='overview',snapshotId=''} = {}) {
 if(!['standard','dark','warm','blue'].includes(theme)||!/^([a-zA-Z0-9_-]{1,80})?$/.test(snapshotId)||!/^([a-zA-Z0-9_-]+|page\/[a-zA-Z0-9_-]+)$/.test(startRoute))throw new Error('Некоректні параметри локального HTML.');
 const read=name=>{if(typeof assets[name]!=='string')throw new Error(`Відсутній файл ${name} для локального HTML.`);return assets[name];};
 const cleanData=validateBundle(data),cleanSite=validateSite(site),json=value=>JSON.stringify(value).replaceAll('<','\\u003c');
 let app=stripLocalImports(read('src/app.js'));
 const fetchLine="const response=await fetch('./data/demo.json');if(!response.ok)throw new Error('Не вдалося завантажити початковий набір даних.');demo=validateBundle(await response.json());";
 const pagesLine="const pagesResponse=await fetch('./data/pages.json');if(!pagesResponse.ok)throw new Error('Не вдалося завантажити сторінки сайта.');cms.init(await pagesResponse.json());";
 if(!app.includes(fetchLine)||!app.includes(pagesLine))throw new Error('Не вдалося підготувати запуск локального HTML.');
 const dataKey=snapshotId?`kai-science.offline.data.${snapshotId}`:'kai-science.offline.v1';
 const themeKey=snapshotId?`kai-science.offline.theme.${snapshotId}`:'kai-science.offline.theme.v1';
 app=app.replace(fetchLine,()=>`demo=validateBundle(${json(cleanData)});`).replace(pagesLine,()=>`cms.init(${json(cleanSite)});`)
  .replace("'kai-science.v1'",JSON.stringify(dataKey)).replace("'kai-science.theme.v1'",JSON.stringify(themeKey)).replace("let theme = 'blue';",`let theme = ${JSON.stringify(theme)};`);
 const script=LOCAL_HTML_MODULES.map(name=>{
  let source=read(`src/${name}.js`);
  if(name==='cms'&&snapshotId)source=source.replace("const CMS_KEY = 'kai-science.pages.v1';",`const CMS_KEY = ${JSON.stringify(`kai-science.offline.pages.${snapshotId}`)};`);
  return localModule(source);
 }).join('')+app;
 if(script.includes('<'+'/script'))throw new Error('Некоректний код запуску локального HTML.');
 const vendor=read('src/vendor/exceljs.min.js').replace(/<\/script/gi,'<\\/script');
 const html=read('index.html').replace(/<link rel="stylesheet" href="\.\/styles\.css(?:\?[^"<>]*)?">/,()=>`<style>\n${read('styles.css')}\n</style>`)
  .replace(/<script type="module" src="\.\/src\/app\.js(?:\?[^"<>]*)?"><\/script>/,'').replace(/data-theme="[^"]*"/,`data-theme="${theme}"`);
 return {html,bundle:{assets,vendor,script},startRoute};
}
export async function buildLocalHTML(assets, data, site, options = {}) {
 const {html,bundle,startRoute}=localHTMLParts(assets,data,site,options);
 const stream=new Blob([JSON.stringify(bundle)]).stream().pipeThrough(new CompressionStream('gzip'));
 const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
 let binary='';for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
 const payload=btoa(binary).match(/.{1,120}/g).join('\n'),endScript='<'+'/script>';
 const boot=`<script id="kai-preview-payload" type="application/octet-stream">\n${payload}\n${endScript}
<script>
(async()=>{
 try{
  const encoded=document.getElementById('kai-preview-payload').textContent.replace(/\\s/g,'');
  const bytes=Uint8Array.from(atob(encoded),character=>character.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const bundle=JSON.parse(await new Response(stream).text());
  globalThis.KAI_PUBLIC_ASSETS=bundle.assets;globalThis.KAI_LOCAL_PREVIEW=true;
  if(!location.hash)location.hash=${JSON.stringify(startRoute)};
  const vendor=document.createElement('script');vendor.textContent=bundle.vendor;document.head.append(vendor);
  const app=document.createElement('script');app.type='module';app.textContent=bundle.script;document.body.append(app);
 }catch(error){
  const target=document.querySelector('#content .loading');
  if(target){target.setAttribute('role','alert');target.textContent='Не вдалося відкрити локальний перегляд. Оновіть браузер до актуальної версії та відкрийте файл повторно.';}
  console.error('KAI preview bootstrap:',error);
 }
})();
${endScript}`;
 return html.replace('</body>',()=>boot+'\n</body>');
}
