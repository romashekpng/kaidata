import { validateBundle } from './data.js?v=compact-project-table-20261031';
import { validateSite } from './cms-data.js?v=compact-project-table-20261031';
export const CHART_ASSETS=['src/chart-runtime.js','src/vendor/echarts.min.js','src/vendor/echarts.LICENSE.txt','src/vendor/echarts.NOTICE.txt','src/vendor/chart.min.js','src/vendor/chart.LICENSE.txt','src/vendor/plotly.min.js','src/vendor/plotly.LICENSE.txt'];
export const PUBLICATION_ASSETS=['index.html','styles.css','src/app.js','src/viewer.js','src/analytics.js','src/site-view.js','src/publication.js','src/style-data.js','src/data.js','src/icons.js','src/spreadsheet.js','src/cms-data.js','src/block-view.js','src/cms-io.js','src/cms.js','src/zip.js','src/vendor/exceljs.min.js','src/vendor/exceljs.LICENSE.txt',...CHART_ASSETS];
export const VISITOR_ASSETS=['index.html','styles.css','src/viewer.js','src/analytics.js','src/site-view.js','src/style-data.js','src/data.js','src/icons.js','src/cms-data.js','src/block-view.js',...CHART_ASSETS];
export function buildPublicationFiles(assets,data,site,mode){
 if(!['editor','visitor'].includes(mode))throw new Error('Виберіть варіант сайта для публікації.');
 const cleanData=validateBundle(data),cleanSite=validateSite(site),names=mode==='editor'?PUBLICATION_ASSETS:VISITOR_ASSETS;
 const files=names.map(name=>{if(typeof assets[name]!=='string')throw new Error(`Відсутній файл ${name}.`);return {name,data:assets[name]};});
 if(mode==='visitor'){
  const index=files.find(file=>file.name==='index.html');
  const entry=/<script type="module" src="\.\/src\/app\.js(?:\?[^"<>]*)?"><\/script>/;
  if(!entry.test(index.data))throw new Error('Не вдалося знайти файл запуску сайта для підготовки версії відвідувачів.');
  index.data=index.data.replace(entry,'<script type="module" src="./src/viewer.js?v=compact-project-table-20261031"><\/script>').replace(/\s*<dialog\b[^>]*id="manager"[^>]*>[\s\S]*?<\/dialog>/,'').replace('<html lang="uk"','<html data-publication="visitor" lang="uk"');
  cleanSite.pages=cleanSite.pages.filter(p=>p.visible||p.kind==='builtin').map(p=>({...p,blocks:p.visible?p.blocks.filter(b=>b.visible).map(b=>{const block={...b};delete block.metricManualBackup;if(block.type==='analytics'&&block.dataMode!=='manual'){delete block.dataTable;delete block.dataPeriod;}return block;}):[]}));
 }
 const instructions=mode==='editor'
  ?'Варіант: сайт з адмінкою. Доступні редагування сторінок, імпорт, налаштування та новий експорт для публікації. Редагування зберігається у браузері; для спільного оновлення згенеруйте новий ZIP і замініть файли сайта.'
  :'Варіант: сайт без адмінки, лише для відвідувачів. Редактор, імпорт і налаштування відсутні. Для оновлення внесіть зміни у збереженій версії з адмінкою та згенеруйте новий архів для відвідувачів. Ця версія читає опубліковані файли й не використовує старі локальні редагування браузера.';
 files.push({name:'data/demo.json',data:JSON.stringify(cleanData,null,2)},{name:'data/pages.json',data:JSON.stringify(validateSite(cleanSite),null,2)},{name:'.nojekyll',data:''},{name:'PUBLICATION.txt',data:instructions+'\n\nРозпакуйте архів і завантажте його вміст у корінь сайта. GitHub Pages: main, / (root). Для зміни варіанта сайта замініть старі файли вмістом нового архіву; файли, яких немає в новому архіві, потрібно видалити. Дані та сторінки в архіві стануть опублікованими.'});
 return files;
}
