import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {defaultCMSBlock, defaultBlockSettings, validateCMSBlock, validateBlockSettings, validateBlockTable, expandSiteBlocks, moveTableItem} from '../src/cms-data.js';
import {cmsBlockCSV, importCMSBlockCSV, cmsBlockXLSX, importCMSBlockXLSX, tableToCMSBlock, readCMSJSON} from '../src/cms-io.js';
import {renderChartTable} from '../src/block-view.js';
const site=JSON.parse(await readFile(new URL('../data/pages.json',import.meta.url),'utf8'));
test('розділення старих сторінок зберігає порядок, користувацький вміст та стабільні ID',()=>{
 const input=structuredClone(site),custom=defaultCMSBlock('text');input.pages[0].blocks.push(custom);
 const expanded=expandSiteBlocks(input);
 assert.equal(input.pages[0].blocks.length,2);
 assert.equal(expanded.pages[0].blocks.at(-1).id,custom.id);
 assert(expanded.pages[0].blocks.some(b=>b.source==='publicationChart'));
 assert(expanded.pages[0].blocks.some(b=>b.source==='quartiles'));
 assert(!expanded.pages.flatMap(p=>p.blocks).some(b=>b.type==='existing'));
 assert.deepEqual(expandSiteBlocks(expanded),expanded);
 const ids=expanded.pages.flatMap(p=>p.blocks.map(b=>b.id));assert.equal(new Set(ids).size,ids.length);
});
test('ширина, картки, палітри та прокрутка перевіряються й зберігаються в JSON',()=>{
 const b={...defaultCMSBlock('list'),settings:{...defaultBlockSettings(),width:37.5,columns:4,showAll:true,palette:'custom',customColors:['#123456']}};
 assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block:b}),'block',b),validateCMSBlock(b));
 for(const change of [{width:0},{width:101},{columns:7},{height:100},{showAll:'false'},{legend:'bad'},{palette:'bad'},{customColors:['red']},{customColors:['#123456;display:none']}])assert.throws(()=>validateBlockSettings(change));
 assert.equal(defaultBlockSettings().showAll,false);
});
test('переміщення колонки переміщує відповідні значення всіх рядків і не змінює оригінал',()=>{
 const original={headers:['Рік','A','B'],rows:[['2025','10','20'],['2026','30','40']]};
 assert.deepEqual(moveTableItem(original,'column',2,1),{headers:['Рік','B','A'],rows:[['2025','20','10'],['2026','40','30']]});
 assert.deepEqual(moveTableItem(original,'row',0,1).rows,[['2026','30','40'],['2025','10','20']]);
 assert.deepEqual(original.rows,[['2025','10','20'],['2026','30','40']]);
 assert.deepEqual(moveTableItem(original,'column',0,-1),original);
});
test('числові графіки приймають нулі й пропуски, відхиляють текст і некоректні структури',()=>{
 const b=defaultCMSBlock('chart');b.rows=[['2026','0','']];assert.deepEqual(validateCMSBlock(b).rows,b.rows);
 assert.throws(()=>validateCMSBlock({...b,rows:[['2026','не число','1']]}));
 assert.throws(()=>validateBlockTable({headers:['A','A'],rows:[]}));
 assert.throws(()=>validateCMSBlock({...b,rows:[['2026','Infinity','1']]}));
 assert.throws(()=>validateCMSBlock({...b,settings:{...b.settings,chartType:'pie'},rows:[['2026','-1','1']]}));
});
test('дані графіка та його налаштування проходять CSV/XLSX, зокрема від’ємні числа',async()=>{
 const b=defaultCMSBlock('chart');b.settings.width=50;b.settings.legend='right';b.settings.palette='purple';b.rows=[['2025','-20','0'],['2026','15.5','']];
 assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(b),b),validateCMSBlock(b));
 assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(b,ExcelJS),b,ExcelJS),validateCMSBlock(b));
});
test('ручна таблиця аналітики змінює лише блок і зберігає джерело й оформлення',()=>{
 const b={...defaultCMSBlock('analytics'),source:'publicationChart',settings:{...defaultBlockSettings('publicationChart'),width:66}};
 const next=tableToCMSBlock({headers:['Рік','Scopus'],rows:[['2026','155']]},b);
 assert.equal(next.dataMode,'manual');assert.equal(next.source,'publicationChart');assert.equal(next.settings.width,66);assert.equal(b.dataTable,undefined);
 assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(next),next),next);
});
test('графіки екранують підписи, а приховані серії не входять до підсумків',()=>{
 const b=defaultCMSBlock('chart'),table={headers:['Рік','A','B'],rows:[['<img src=x>','10','20']]};
 b.title='<script>alert(1)</script>';
 const html=renderChartTable(b,table,[1]);
 assert(!html.includes('<img'));assert(!html.includes('<script>'));assert(html.includes('&lt;img'));assert(html.includes('Разом: 10'));assert(!html.includes('Разом: 30'));
 for(const type of ['stacked','bar','line','donut','pie'])assert(renderChartTable({...b,settings:{...b.settings,chartType:type}},table).includes('<svg'));
 const blank=renderChartTable(b,{headers:['Рік','A'],rows:[]});assert(blank.includes('Додайте дані'));
});
test('Внесок факультетів початково має смуги прогресу з нумерацією та підзаголовком',()=>{
 const block=expandSiteBlocks(site).pages[0].blocks.find(b=>b.source==='faculties');
 assert.equal(block.settings.chartType,'progress');assert.equal(block.settings.numbering,true);assert.equal(block.settings.legend,'none');
 assert.equal(block.subtitle,'За кількістю записів у вибраному році');
});
test('оновлення збережених стовпчиків факультетів зберігає дані, ширину й користувацьку палітру',()=>{
 const settings={...defaultBlockSettings('faculties'),chartType:'stacked',width:50,palette:'purple'};delete settings.numbering;delete settings.wrapLabels;
 const legacy={id:'legacy-faculties',type:'analytics',title:'Мої факультети',visible:true,source:'faculties',dataMode:'manual',settings,dataTable:{headers:['Факультет','Кількість'],rows:[['Факультет А','15'],['Факультет Б','14']]}};
 const updated=validateCMSBlock(legacy);assert.equal(updated.settings.chartType,'progress');assert.equal(updated.settings.width,50);assert.equal(updated.settings.palette,'purple');assert.deepEqual(updated.dataTable,legacy.dataTable);
 assert.deepEqual(validateCMSBlock(updated),updated);
 const chosen={...updated,settings:{...updated.settings,chartType:'stacked'}};assert.equal(validateCMSBlock(chosen).settings.chartType,'stacked');
 const negative={...legacy,dataTable:{headers:['Факультет','Зміна'],rows:[['А','-1']]}};assert.equal(validateCMSBlock(negative).settings.chartType,'stacked');
});
test('смуги прогресу масштабуються відносно найбільшого значення, нумерація вимикається',()=>{
 const b={...defaultCMSBlock('chart'),settings:{...defaultBlockSettings(),chartType:'progress',numbering:true,legend:'none'}};
 const table={headers:['Факультет','Кількість'],rows:[['Факультет А','15'],['Факультет Б','14']]};
 const html=renderChartTable(b,table);assert.match(html,/cms-progress-number">01/);assert.match(html,/aria-valuemax="15" aria-valuenow="14"/);assert.match(html,/width:93\.333/);
 const noNumbers=renderChartTable({...b,settings:{...b.settings,numbering:false}},table);assert(!noNumbers.includes('cms-progress-number'));assert(noNumbers.includes('Факультет А'));
 assert.throws(()=>validateCMSBlock({...b,rows:[['А','-1','0']]}),/від’ємні/);
});
test('горизонтальні смуги підтримують довгі підписи, значення праворуч і приховування серій',()=>{
 const b={...defaultCMSBlock('chart'),settings:{...defaultBlockSettings(),chartType:'horizontal',wrapLabels:true}};
 const table={headers:['Факультет','A','B'],rows:[['Факультет архітектури, будівництва та енергетики <img src=x>','10','5']]};
 const html=renderChartTable(b,table);assert(html.includes('cms-horizontal-chart wrap-labels totals-visible'));assert.match(html,/cms-horizontal-total[^>]*>15/);assert(!html.includes('<img'));assert(html.includes('&lt;img'));
 const hidden=renderChartTable(b,table,[1]);assert.match(hidden,/cms-horizontal-total[^>]*>10/);assert(hidden.includes('Разом: 10'));assert(!hidden.includes('Разом: 15'));
 const plain=renderChartTable({...b,settings:{...b.settings,wrapLabels:false,totalLabels:false}},table);assert(!plain.includes('wrap-labels'));assert(!plain.includes('cms-horizontal-total'));
});
test('горизонтальна шкала обробляє нулі, пропуски та від’ємні числа без некоректної геометрії',()=>{
 const b={...defaultCMSBlock('chart'),settings:{...defaultBlockSettings(),chartType:'horizontal'}};
 for(const rows of [[['А','0','0']],[['А','','']],[['А','-10','5'],['Б','-3','2']]]){
  const html=renderChartTable(b,{headers:['Факультет','A','B'],rows});assert(!html.includes('NaN'));assert(!html.includes('Infinity'));assert(html.includes('cms-horizontal-axis'));
 }
});
test('нові типи, нумерація й перенесення назв зберігаються через JSON, CSV та XLSX',async()=>{
 for(const chartType of ['progress','horizontal']){
  const b={...defaultCMSBlock('chart'),settings:{...defaultBlockSettings(),chartType,numbering:false,wrapLabels:true}};
  assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block:b}),'block',b),validateCMSBlock(b));
  assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(b),b),validateCMSBlock(b));
  assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(b,ExcelJS),b,ExcelJS),validateCMSBlock(b));
 }
 for(const change of [{numbering:'false'},{wrapLabels:'true'}])assert.throws(()=>validateBlockSettings(change));
});
