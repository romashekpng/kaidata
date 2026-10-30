import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import path from 'node:path';
import {PUBLICATION_ASSETS,VISITOR_ASSETS,buildPublicationFiles} from '../src/publication.js';import {expandSiteBlocks,defaultCMSBlock} from '../src/cms-data.js';
const assets=Object.fromEntries(await Promise.all(PUBLICATION_ASSETS.map(async name=>[name,await readFile(new URL('../'+name,import.meta.url),'utf8')]))),data=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url),'utf8')),base=expandSiteBlocks(JSON.parse(await readFile(new URL('../data/pages.json',import.meta.url),'utf8')));
test('архів з адмінкою містить редактор і всі файли для подальшого експорту обох варіантів',()=>{
 const files=buildPublicationFiles(assets,data,base,'editor'),names=files.map(f=>f.name);for(const name of PUBLICATION_ASSETS)assert(names.includes(name));
 assert.equal(files.find(f=>f.name==='index.html').data,assets['index.html']);assert.deepEqual(JSON.parse(files.find(f=>f.name==='data/demo.json').data),data);
});
test('архів для відвідувачів не містить адмінку, імпорт чи бібліотеку XLSX і має повний набір залежностей',()=>{
 const files=buildPublicationFiles(assets,data,base,'visitor'),byName=new Map(files.map(f=>[f.name,f.data]));
 for(const name of ['src/app.js','src/cms.js','src/cms-io.js','src/spreadsheet.js','src/publication.js','src/zip.js','src/vendor/exceljs.min.js'])assert(!byName.has(name));
 const html=byName.get('index.html');assert(html.includes('src/viewer.js?'));assert(!html.includes('src/app.js'));assert(!html.includes('id="manager"'));assert(html.includes('</script>'));
 for(const name of VISITOR_ASSETS.filter(n=>n.endsWith('.js')))for(const match of byName.get(name).matchAll(/^import .*?from ['"]([^'"]+)['"]/gm)){const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1].split('?')[0]));assert(byName.has(dependency),name+' requires '+dependency);}
});
test('версія для відвідувачів зберігає оформлення й ручні дані, прибирає приховані блоки та резервні дані редактора без зміни оригіналу',()=>{
 const site=structuredClone(base),stats=site.pages[0].blocks.find(b=>b.source==='stats');stats.metricAppearance=[{key:'Наукових публікацій',background:'blue',backgroundColor:'#25395d'}];stats.metricManualBackup={dataTable:{headers:['label','value'],rows:[['Секретна чернетка','999']]},dataPeriod:'2026'};
 const hidden=defaultCMSBlock('text');hidden.visible=false;hidden.text='Прихований текст';site.pages[0].blocks.push(hidden);
 const before=JSON.stringify(site),files=buildPublicationFiles(assets,data,site,'visitor'),published=JSON.parse(files.find(f=>f.name==='data/pages.json').data),copied=published.pages[0].blocks.find(b=>b.id===stats.id);
 assert.deepEqual(copied.metricAppearance,stats.metricAppearance);assert(!copied.metricManualBackup);assert(!published.pages[0].blocks.some(b=>b.id===hidden.id));assert.equal(JSON.stringify(site),before);
 assert.throws(()=>buildPublicationFiles(assets,data,site,'wrong'));assert.throws(()=>buildPublicationFiles({},data,site,'visitor'));assert.throws(()=>buildPublicationFiles({...assets,'index.html':'<html></html>'},data,site,'visitor'));
});
