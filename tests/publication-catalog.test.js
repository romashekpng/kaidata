import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {readFile} from 'node:fs/promises';
import {publicationsFromTable,filterPublications,renderPublicationCatalog} from '../src/block-view.js';
import {createSiteView} from '../src/site-view.js';
import {createAnalytics} from '../src/analytics.js';
import {defaultBlockSettings,validateCMSBlock,validateBlockSettings} from '../src/cms-data.js';
import {tableToCMSBlock,cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX} from '../src/cms-io.js';
const demo=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url),'utf8'));
const table={headers:['Назва','Автори','Рік','Факультет','Індексація','Квартиль','Тип','Посилання'],rows:[['Бета','Іваненко О. В.','2026','Факультет А','Scopus / WoS','Q1','Стаття','https://example.org/article?x=1&y=2'],['Альфа','Петренко М. С.','2026','Факультет Б','','Без квартиля','Тези',''],['Гамма','Іваненко О. В.','2026','Факультет А','Web of Science','Q4','Стаття','']]};
const block=()=>({id:'publication-test',type:'analytics',source:'publications',title:'Каталог публікацій',visible:true,dataMode:'manual',dataPeriod:'2026',dataTable:structuredClone(table),settings:defaultBlockSettings('publications')});
test('поля каталогу визначаються за назвами колонок після зміни порядку',()=>{
 const reordered={headers:[...table.headers].reverse(),rows:table.rows.map(row=>[...row].reverse())};
 assert.deepEqual(publicationsFromTable(reordered),publicationsFromTable(table));
 assert.deepEqual(publicationsFromTable(table).map(r=>r.indexes),[['Scopus','WoS'],[],['WoS']]);
 assert.equal(publicationsFromTable({headers:['Назва','Квартиль'],rows:[['Без авторів',''] ]})[0].authors,'');
});
test('пошук за авторами та назвою поєднується з факультетом, індексацією й квартилем',()=>{
 const records=publicationsFromTable(table);
 assert.deepEqual(filterPublications(records).rows.map(r=>r.title),['Альфа','Бета','Гамма']);
 assert.equal(filterPublications(records,{query:'ІВАНЕНКО',faculty:'Факультет А',index:'Scopus',quartile:'Q1'}).rows[0].title,'Бета');
 assert.equal(filterPublications(records,{index:'none',quartile:'none'}).rows[0].title,'Альфа');
 assert.equal(filterPublications(records,{query:'немає записів'}).rows.length,0);
 assert.equal(filterPublications(records,{page:999}).selected.page,1);
});
test('каталог має чотири стовпці, мітки та активну назву; вимкнена опція і небезпечні адреси не створюють посилань',()=>{
 const html=renderPublicationCatalog(table,{}, {},'catalog','2026');
 assert.equal((html.match(/<th scope=/g)||[]).length,4);assert.match(html,/class="title-cell"><strong><a href="https:\/\/example.org\/article\?x=1&amp;y=2"/);assert.match(html,/Без квартиля/);assert.match(html,/class="pill blue"/);assert.doesNotMatch(html,/<th[^>]*>Посилання/);
 assert.doesNotMatch(renderPublicationCatalog(table,{publicationTitleLinks:false}),/<a href=/);
 for(const url of ['javascript:alert(1)','data:text/html,test','https://user:password@example.org']){const changed=structuredClone(table);changed.rows[0][7]=url;assert.doesNotMatch(renderPublicationCatalog(changed),/<a href=/);}
 const escaped=structuredClone(table);escaped.rows[0][0]='<img src=x onerror=alert(1)>';assert.match(renderPublicationCatalog(escaped),/&lt;img/);assert.doesNotMatch(renderPublicationCatalog(escaped),/<img/);
});
test('спільні й власні дані публікацій використовують однаковий оформлений каталог',()=>{
 const manual=block(),live={...manual,dataMode:'live'},data={...demo,institution:{...demo.institution,blocks:['publications']}},options={getData:()=>data,getYear:()=>2026,getBlockTable:()=>structuredClone(table),getBlockPeriod:()=> '2026',getBlock:()=>null};
 const view=createSiteView(options);
 assert.equal(view.renderBlocks({blocks:[manual]}),view.renderBlocks({blocks:[live]}));
});
test('редагування створює окремі дані, зберігає налаштування посилань і не змінює спільні записи',()=>{
 const analytics=createAnalytics({getData:()=>demo,getYear:()=>2026,getRoute:()=> 'publications',getPage:()=>null}),original=analytics.getBlockTable('publications'),before=JSON.stringify(demo);
 const live={...block(),dataMode:'live',dataTable:structuredClone(original),settings:{...defaultBlockSettings('publications'),publicationTitleLinks:false}},changed=structuredClone(original);changed.rows[0][7]='https://example.org/new';
 const manual=tableToCMSBlock(changed,live);assert.equal(manual.dataMode,'manual');assert.equal(manual.settings.publicationTitleLinks,false);assert.equal(manual.dataTable.rows[0][7],'https://example.org/new');assert.equal(JSON.stringify(demo),before);assert.deepEqual(analytics.getBlockTable('publications'),original);
});
test('опція активної назви увімкнена за замовчуванням; JSON, CSV й XLSX зберігають ручні дані та налаштування',async()=>{
 assert.equal(validateBlockSettings({},'publications').publicationTitleLinks,true);assert.throws(()=>validateBlockSettings({publicationTitleLinks:'false'},'publications'));
 const original=validateCMSBlock({...block(),settings:{...defaultBlockSettings('publications'),publicationTitleLinks:false}});
 assert.deepEqual(validateCMSBlock(JSON.parse(JSON.stringify(original))),original);
 assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(original),original),original);
 assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(original,ExcelJS),original,ExcelJS),original);
});
