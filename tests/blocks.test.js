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
