import {createAnalytics} from '../src/analytics.js';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import ExcelJS from 'exceljs';
import {currentReportingYear,reportingYears,reportDate,projectReceipts,updateProjectReports,validateBundle,toCSV,importCSV,parseCSV,importTable} from '../src/data.js';import {toXLSX,importXLSX} from '../src/spreadsheet.js';
const demo=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url),'utf8')),asOf='2026-11-01T10:00:00Z';
const project=()=>({...demo.projects[0],id:'annual-test',startDate:'2024-01-01',endDate:'2028-12-31',funding:[{year:2024,amountUAH:250000},{year:2025,amountUAH:900000},{year:2026,amountUAH:120000},{year:2027,amountUAH:9999999}]});
test('звітні роки завершуються поточним роком Києва, наступний рік відкривається з календарем',()=>{
 const data={...demo,projects:[project()]};assert.deepEqual(reportingYears(data,asOf),[2021,2022,2023,2024,2025,2026]);assert.equal(currentReportingYear('2026-12-31T22:30:00Z'),2027);assert.equal(reportingYears(data,'2026-12-31T22:30:00Z').at(-1),2027);assert.equal(reportDate(2024,asOf),'2024-12-31');assert.equal(reportDate(2026,asOf),'2026-11-01');
});
test('річні кошти не розподіляються пропорційно, майбутні не входять до підсумку, порожнє відрізняється від нуля',()=>{
 const p=project();assert.equal(projectReceipts(p,2024,asOf),250000);assert.equal(projectReceipts(p,2026,asOf),120000);assert.equal(projectReceipts(p,null,asOf),1270000);assert.equal(projectReceipts(p,2027,asOf),null);p.funding=[{year:2025,amountUAH:0}];assert.equal(projectReceipts(p,2024,asOf),null);assert.equal(projectReceipts(p,2025,asOf),0);
});
test('редактор зберігає фактичні роки, нуль, ручний прогрес і не видаляє майбутні вихідні записи',()=>{
 const p=project(),next=updateProjectReports(p,[{year:2024,amount:'1 234,50',percent:''},{year:2025,amount:'',percent:''},{year:2026,amount:'0',percent:'65'}],asOf);
 assert.deepEqual(next.funding,[{year:2024,amountUAH:1234.5},{year:2026,amountUAH:0},{year:2027,amountUAH:9999999}]);assert.deepEqual(next.progressByYear,[{year:2026,percent:65}]);assert.equal(p.funding.length,4);assert.equal(next.title,p.title);
 for(const row of [{year:2027,amount:'1'},{year:2026,amount:'-1'},{year:2026,amount:'bad'},{year:2026,percent:'37'}])assert.throws(()=>updateProjectReports(p,[row],asOf));
});
test('річні суми та ручний прогрес проходять CSV/XLSX; старі CSV без необов’язкової колонки підтримуються',async()=>{
 const p={...project(),progressByYear:[{year:2024,percent:25},{year:2026,percent:65}]},data=validateBundle({...demo,projects:[p]});
 assert.deepEqual(importCSV(toCSV(data,'projects'),'projects',demo).projects,data.projects);assert.deepEqual((await importXLSX(await toXLSX(data,'projects',ExcelJS),'projects',demo,ExcelJS)).projects,data.projects);
 const legacy=parseCSV(toCSV({...data,projects:[project()]},'projects'));legacy.headers=legacy.headers.filter(h=>h!=='progressByYear');legacy.records.forEach(r=>delete r.progressByYear);assert.deepEqual(importTable(legacy,'projects',demo).projects,validateBundle({...demo,projects:[project()]}).projects);
});

test('картки й програми використовують однакові річні суми; загальний звіт виключає майбутні надходження',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date(asOf)});
 const p={...project(),progressByYear:[{year:2026,percent:65}]},data=validateBundle({...demo,projects:[p]}),analytics=createAnalytics({getData:()=>data,getYear:()=>2026,getRoute:()=>'projects',getPage:()=>null});
 const annual=analytics.getBlockTable('projects'),all=analytics.getBlockTable('projects',true);
 assert.equal(annual.rows[0][annual.headers.indexOf('Надходження, грн')],'120000');assert.equal(annual.rows[0][annual.headers.indexOf('Виконання, %')],'65');
 assert.equal(all.rows[0][all.headers.indexOf('Надходження, грн')],'1270000');assert.equal(analytics.getBlockTable('programs').rows[0][1],'0.12');assert.equal(analytics.getBlockTable('programs',true).rows[0][1],'1.27');
 assert.equal(analytics.getBlockPeriod({type:'analytics',source:'projects',dataMode:'live',settings:{allYears:true}},all),'2024-2026');
 assert(analytics.getBlockTable('projectChart',true).rows.every(r=>+r[0]<=2026));
});
