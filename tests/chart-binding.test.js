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
test('chart sorting uses grouped totals, Ukrainian labels and numeric labels; missing values sort last',()=>{
 const b=block();Object.assign(b.binding,{groupColumn:'Назва',seriesColumn:'',valueColumns:['Число'],periodMode:'all'});
 const ctx={...context(2025),getBlock:()=>({...source,columns:['Назва','Число'],rows:[['Яблуко','4'],['Абрикос','2'],['Ірис',''],['Єнот','0'],['Яблуко','6']]})};
 const labels=()=>resolveChartData(b,ctx).table.rows.map(r=>r[0]);
 assert.deepEqual(labels(),['Яблуко','Абрикос','Ірис','Єнот']);
 for(const [sortOrder,expected]of Object.entries({labelAsc:['Абрикос','Єнот','Ірис','Яблуко'],labelDesc:['Яблуко','Ірис','Єнот','Абрикос'],valueAsc:['Єнот','Абрикос','Яблуко','Ірис'],valueDesc:['Яблуко','Абрикос','Єнот','Ірис']})){b.binding.sortOrder=sortOrder;assert.deepEqual(labels(),expected);}
 ctx.getBlock=()=>({...source,columns:['Назва','Число'],rows:[['10','4'],['2','2'],['2025','1'],['Без року','5']]});b.binding.sortOrder='numberAsc';assert.deepEqual(labels(),['2','10','2025','Без року']);b.binding.sortOrder='numberDesc';assert.deepEqual(labels(),['2025','10','2','Без року']);
 assert.throws(()=>validateCMSBlock({...b,binding:{...b.binding,sortOrder:'invalid'}}));
});
test('chart sort order persists through JSON, CSV and XLSX; legacy bindings keep source order',async()=>{
 const b=block();b.binding.sortOrder='valueDesc';assert.equal(validateCMSBlock(b).binding.sortOrder,'valueDesc');
 for(const copy of [readCMSJSON(JSON.stringify({blockVersion:1,block:b}),'block',b),importCMSBlockCSV(cmsBlockCSV(b),b),await importCMSBlockXLSX(await cmsBlockXLSX(b,ExcelJS),b,ExcelJS)])assert.equal(copy.binding.sortOrder,'valueDesc');
 delete b.binding.sortOrder;assert.equal(validateCMSBlock(b).binding.sortOrder,'source');
});
const rule=(name,values,visible=true)=>({name,column:'indexes',values,visible});
const custom=()=>{const b=block();Object.assign(b.binding,{groupColumn:'Рік',seriesColumn:'',valueColumns:[],periodMode:'all',operation:'count',seriesRules:[rule('Індексовані',['Scopus','WoS','Scopus | WoS']),rule('Категорія Б',['Категорія Б']),rule('Порожні',[''],false)]});return b;};
const customContext=year=>({...context(year),getBlock:()=>({...source,columns:['Рік','indexes','Сума'],rows:[['2024','Scopus','2'],['2024','WoS','3'],['2024','Scopus / WoS','4'],['2024','Категорія Б','5'],['2025','','6'],['2025','Категорія Б','7']]})});
test('custom series match selected source values, count combinations once and omit hidden series',()=>{
 const b=custom(),r=resolveChartData(b,customContext(2025));assert.equal(r.error,'');assert.deepEqual(r.table,{headers:['Рік','Індексовані','Категорія Б'],rows:[['2024','3','1'],['2025','0','1']]});
 b.binding.seriesRules[2].visible=true;assert.equal(resolveChartData(b,customContext(2025)).table.rows[1][3],'1');
 b.binding.seriesRules.forEach(r=>r.visible=false);assert.deepEqual(resolveChartData(b,customContext(2025)).table.rows,[]);
});
test('custom series respect periods and calculations without changing automatic series behavior',()=>{
 const b=custom();Object.assign(b.binding,{periodMode:'year',operation:'sum',valueColumns:['Сума']});assert.deepEqual(resolveChartData(b,customContext(2024)).table.rows,[['2024','9','5']]);
 b.binding.operation='avg';assert.equal(resolveChartData(b,customContext(2024)).table.rows[0][1],'3');
 b.binding.periodMode='fixed';b.binding.period='2024';assert.deepEqual(resolveChartData(b,customContext(2021)),resolveChartData(b,customContext(2026)));
 b.binding.seriesRules[0].column='Deleted';assert.match(resolveChartData(b,customContext(2024)).error,/не знайдено/);
});
test('custom rules persist through site/block JSON and CSV/XLSX and reject ambiguous duplicate names',async()=>{
 const b=custom();for(const copy of [readCMSJSON(JSON.stringify({blockVersion:1,block:b}),'block',b),importCMSBlockCSV(cmsBlockCSV(b),b),await importCMSBlockXLSX(await cmsBlockXLSX(b,ExcelJS),b,ExcelJS)])assert.deepEqual(copy.binding.seriesRules,b.binding.seriesRules);
 b.binding.seriesRules[1].name=b.binding.seriesRules[0].name;assert.throws(()=>validateCMSBlock(b),/унікальними/);
});
