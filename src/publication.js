import { validateBundle } from './data.js?v=catalog-align-20261111';
import { validateSite } from './cms-data.js?v=catalog-align-20261111';
export const CHART_ASSETS=['src/chart-runtime.js','src/vendor/echarts.min.js','src/vendor/echarts.LICENSE.txt','src/vendor/echarts.NOTICE.txt','src/vendor/chart.min.js','src/vendor/chart.LICENSE.txt','src/vendor/plotly.min.js','src/vendor/plotly.LICENSE.txt'];
export const PUBLICATION_ASSETS=['index.html','styles.css','src/app.js','src/viewer.js','src/analytics.js','src/site-view.js','src/publication.js','src/style-data.js','src/data.js','src/money.js','src/icons.js','src/sidebar-view.js','src/branding-data.js','src/spreadsheet.js','src/cms-data.js','src/data-note.js','src/catalog-schema.js','src/catalog-view.js','src/block-view.js','src/cms-io.js','src/cms.js','src/catalog-editor.js','src/catalog-io.js','src/project-reports.js','src/zip.js','src/vendor/exceljs.min.js','src/vendor/exceljs.LICENSE.txt',...CHART_ASSETS];
export const VISITOR_ASSETS=['index.html','styles.css','src/viewer.js','src/analytics.js','src/site-view.js','src/style-data.js','src/data.js','src/money.js','src/icons.js','src/sidebar-view.js','src/branding-data.js','src/cms-data.js','src/data-note.js','src/catalog-schema.js','src/catalog-view.js','src/block-view.js',...CHART_ASSETS];
export function buildPublicationFiles(assets,data,site,mode,selectedTheme){
 if(!['editor','visitor'].includes(mode))throw new Error('Виберіть варіант сайта для публікації.');
 const cleanData=validateBundle(data),cleanSite=validateSite(site),names=mode==='editor'?PUBLICATION_ASSETS:VISITOR_ASSETS;
 const files=names.map(name=>{if(typeof assets[name]!=='string')throw new Error(`Відсутній файл ${name}.`);return {name,data:assets[name]};});
 const html=files.find(file=>file.name==='index.html'),colors={standard:'#101f2c',dark:'#0c1521',warm:'#302922',blue:'#25395d'},theme=selectedTheme??html.data.match(/<html\b[^>]*\bdata-theme="([^"]*)"/)?.[1]??'blue';
 if(!Object.hasOwn(colors,theme))throw new Error('Невідома тема для публікації.');
 html.data=/\bdata-theme="/.test(html.data)?html.data.replace(/(<html\b[^>]*\bdata-theme=")[^"]*(")/,`$1${theme}$2`):html.data.replace('<html ','<html data-theme="'+theme+'" ');
 html.data=html.data.replace(/(<meta\s+name="theme-color"\s+content=")[^"]*(")/,`$1${colors[theme]}$2`);
 if(mode==='visitor'){
  const index=files.find(file=>file.name==='index.html');
  const styles=assets['styles.css'],stylesheet=/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']\.\/styles\.css(?:\?[^"'<>]*)?["'][^>]*>/i;
  if(!styles.trim()||/^\s*(?:<!doctype\s+html\b|<html\b|<head\b|<body\b)/i.test(styles))throw new Error('Файл styles.css порожній або хостинг повернув HTML замість стилів. Оновіть файли сайта й повторіть експорт.');
  if(!stylesheet.test(index.data))throw new Error('Не вдалося знайти стилі сайта для підготовки версії відвідувачів.');
  const entry=/<script type="module" src="\.\/src\/app\.js(?:\?[^"<>]*)?"><\/script>/;
  if(!entry.test(index.data))throw new Error('Не вдалося знайти файл запуску сайта для підготовки версії відвідувачів.');
  index.data=index.data.replace(entry,'<script type="module" src="./src/viewer.js?v=catalog-align-20261111"><\/script>').replace(/\s*<dialog\b[^>]*id="manager"[^>]*>[\s\S]*?<\/dialog>/,'').replace('<html lang="uk"','<html data-publication="visitor" lang="uk"');
  const referenced=new Set(cleanSite.pages.filter(p=>p.visible).flatMap(p=>p.blocks.filter(b=>b.visible&&['dataNote','catalog','chart'].includes(b.type)&&b.binding?.kind==='block').map(b=>b.binding.blockId)));
  cleanSite.pages=cleanSite.pages.filter(p=>p.visible||p.kind==='builtin'||p.blocks.some(b=>referenced.has(b.id))).map(p=>({...p,blocks:p.blocks.filter(b=>(p.visible&&b.visible)||referenced.has(b.id)).map(b=>{const block={...b,visible:p.visible&&b.visible};delete block.metricManualBackup;if(block.type==='analytics'&&block.dataMode!=='manual'){delete block.dataTable;delete block.dataPeriod;}return block;})}));
 }
 const instructions=mode==='editor'
  ?'Варіант: сайт з адмінкою. Доступні редагування сторінок, імпорт, налаштування та новий експорт для публікації. Редагування зберігається у браузері; для спільного оновлення згенеруйте новий ZIP і замініть файли сайта.'
  :'Варіант: сайт без адмінки, лише для відвідувачів. Редактор, імпорт і налаштування відсутні. Для оновлення внесіть зміни у збереженій версії з адмінкою та згенеруйте новий архів для відвідувачів. Ця версія читає опубліковані файли й не використовує старі локальні редагування браузера.';
 files.push({name:'data/demo.json',data:JSON.stringify(cleanData,null,2)},{name:'data/pages.json',data:JSON.stringify(validateSite(cleanSite),null,2)},{name:'.nojekyll',data:''},{name:'PUBLICATION.txt',data:instructions+'\n\nРозпакуйте архів і завантажте весь його вміст у папку сайта: index.html, styles.css, папки src і data зі збереженням вкладених папок. Файли src містять код і бібліотеки графіків; data — опубліковані дані та сторінки. В обох варіантах оформлення підключається з окремого styles.css поруч з index.html. GitHub Pages: main, / (root). Для зміни варіанта сайта замініть старі файли вмістом нового архіву; файли, яких немає в новому архіві, потрібно видалити. Дані та сторінки в архіві стануть опублікованими.'});
 return files;
}
