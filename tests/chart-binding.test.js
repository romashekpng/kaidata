import test from 'node:test';import assert from 'node:assert/strict';
import {defaultCMSBlock,defaultChartBinding,validateCMSBlock} from '../src/cms-data.js';
import {resolveChartData} from '../src/catalog-view.js';
import {cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX,readCMSJSON} from '../src/cms-io.js';
import ExcelJS from 'exceljs';
const source={...defaultCMSBlock('table'),id:'source',columns:['Рік','Категорія','Серія','Сума'],rows:[['2024','A','X','2'],['2025','A','X','4'],['2025','A','X','6'],['2025','B','Y','—']]};
const block=()=>validateCMSBlock({...defaultCMSBlock('chart'),binding:{...defaultChartBinding(),kind:'block',blockId:'source',groupColumn:'Категорія',seriesColumn:'Серія',valueColumns:['Сума'],periodMode:'year'}});
const context=year=>({year,getBlock:id=>id==='source'?source:null,getTable:()=>({headers:source.columns,rows:source.rows})});
test('chart aggregation and missing cells',()=>{for(const [operation,value]of Object.entries({count:'2',sum:'10',avg:'5',min:'4',max:'6'})){const b=block();b.binding.operation=operation;const r=resolveChartData(b,context(2025));assert.equal(r.error,'');assert.equal(r.table.rows[0][1],value);assert.equal(r.table.rows[1][2],operation==='count'?'1':'');}});
test('chart periods, source errors, static data and legacy compatibility',()=>{const b=block();assert.equal(resolveChartData(b,context(2024)).table.rows[0][1],'2');b.binding.periodMode='fixed';b.binding.period='2024-2025';assert.deepEqual(resolveChartData(b,context(2021)),resolveChartData(b,context(2026)));assert.equal(resolveChartData(b,context(2026)).table.rows[0][1],'12');b.binding.periodMode='all';assert.equal(resolveChartData(b,context(2026)).table.rows[0][1],'12');b.binding.valueColumns=['Deleted'];assert.match(resolveChartData(b,context(2026)).error,/не знайдено/);assert(!validateCMSBlock(defaultCMSBlock('chart')).binding);assert.throws(()=>validateCMSBlock({...block(),binding:{...b.binding,operation:'eval'}}));});
test('chart binding survives JSON CSV and XLSX round trips',async()=>{const b=block();assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block:b}),'block',b),b);assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(b),b),b);assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(b,ExcelJS),b,ExcelJS),b);});
test('manual raw CSV/XLSX records allow text group and series columns',async()=>{
 const b=validateCMSBlock({...defaultCMSBlock('chart'),columns:source.columns,rows:source.rows,binding:{...defaultChartBinding(),groupColumn:'Категорія',seriesColumn:'Серія',valueColumns:['Сума'],periodMode:'year'}});
 assert.equal(resolveChartData(b,context(2025)).table.rows[0][1],'10');
 for(const copy of [importCMSBlockCSV(cmsBlockCSV(b),b),await importCMSBlockXLSX(await cmsBlockXLSX(b,ExcelJS),b,ExcelJS)])assert.deepEqual(copy,b);
});
test('empty year selections render an empty chart rather than a numeric-column error',()=>{
 const b=block();assert.equal(resolveChartData(b,context(2021)).error,'');assert.deepEqual(resolveChartData(b,context(2021)).table.rows,[]);
 b.binding.valueColumns=[];assert.equal(resolveChartData(b,context(2021)).error,'');
});
test('wide year columns follow page, fixed and all periods without losing zero values',()=>{
 const wide={...source,columns:['Назва','2024','2025'],rows:[['A','0','8'],['B','2','']]},b=block(),ctx=year=>({...context(year),getBlock:()=>wide});
 Object.assign(b.binding,{seriesColumn:'',groupColumn:'Назва',valueColumns:[]});
 assert.deepEqual(resolveChartData(b,ctx(2024)).table,{headers:['Назва','2024'],rows:[['A','0'],['B','2']]});
 assert.equal(resolveChartData(b,ctx(2021)).error,'');assert.equal(resolveChartData(b,ctx(2021)).table.rows.length,0);
 Object.assign(b.binding,{periodMode:'fixed',period:'2024-2025'});assert.deepEqual(resolveChartData(b,ctx(2021)),resolveChartData(b,ctx(2026)));
 b.binding.periodMode='all';assert.deepEqual(resolveChartData(b,ctx(2021)).table.headers,['Назва','2024','2025']);
});
test('fixed ranges aggregate annual builtin snapshots independently of page year',()=>{
 const b=block();Object.assign(b.binding,{kind:'builtin',source:'faculties',groupColumn:'Факультет',seriesColumn:'',valueColumns:['Кількість'],periodMode:'fixed',period:'2024-2025'});
 const ctx=year=>({year,getTable:(source,all,y)=>({headers:['Факультет','Кількість'],rows:[['A',String(all?999:y===2024?2:6)]]})});
 assert.equal(resolveChartData(b,ctx(2021)).table.rows[0][1],'8');assert.deepEqual(resolveChartData(b,ctx(2021)),resolveChartData(b,ctx(2026)));
 b.binding.operation='avg';assert.equal(resolveChartData(b,ctx(2026)).table.rows[0][1],'4');
});
test('all-years metric sources aggregate the same annual snapshots for every page year',()=>{
 const b=block();Object.assign(b.binding,{kind:'builtin',source:'stats',groupColumn:'label',seriesColumn:'',valueColumns:['value'],periodMode:'all'});
 const ctx=year=>({year,years:[2024,2025],getTable:(source,all,y)=>({headers:['label','value'],rows:[['Публікації',String(y===2024?2:6)]]})});
 assert.equal(resolveChartData(b,ctx(2021)).table.rows[0][1],'8');assert.deepEqual(resolveChartData(b,ctx(2021)),resolveChartData(b,ctx(2026)));
});
test('negative values are checked after aggregation for the selected chart type',()=>{
 const b=block(),ctx={...context(2025),getBlock:()=>({...source,rows:[['2025','A','X','-4']]})};b.settings.chartType='bar';assert.equal(resolveChartData(b,ctx).error,'');b.settings.chartType='pie';assert.match(resolveChartData(b,ctx).error,/від’ємні/);b.binding.operation='count';assert.equal(resolveChartData(b,ctx).error,'');
});
