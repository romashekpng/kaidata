import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import ExcelJS from 'exceljs';
import {scaleMoney,convertMoneyText,formatMoney} from '../src/money.js';
import {validateBundle,importCSV,toCSV,CSV_HEADERS,summarize} from '../src/data.js';
import {validateCMSBlock,defaultBlockSettings} from '../src/cms-data.js';
import {cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX} from '../src/cms-io.js';
import {toXLSX,importXLSX} from '../src/spreadsheet.js';import {createAnalytics} from '../src/analytics.js';import {renderProjectTable} from '../src/block-view.js';
const demo=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url),'utf8'));
const legacyData=()=>{const old=structuredClone(demo);old.schemaVersion=1;for(const entry of [...old.revenues,...old.projects.flatMap(p=>p.funding)]){entry.amountUAH=scaleMoney(entry.amountThousandUAH,3);delete entry.amountThousandUAH;}return old;};
const analytic=(source,table)=>({id:'money-test',type:'analytics',source,title:'Кошти',visible:true,dataMode:'manual',dataTable:table,settings:defaultBlockSettings(source)});
test('початкова база та нові JSON використовують тис. грн; старі гривні переходять один раз без зміни вартості',()=>{
 assert.equal(demo.schemaVersion,2);assert.equal(demo.revenues[0].amountThousandUAH,2280);
 const migrated=validateBundle(legacyData());assert.deepEqual(migrated,validateBundle(demo));assert.deepEqual(validateBundle(migrated),migrated);
 assert.equal(scaleMoney(9.29,3),9290);assert.equal(scaleMoney(.01,-3),.00001);
 const old=legacyData();old.revenues[0].amountThousandUAH=2280;assert.throws(()=>validateBundle(old),/лише/);
});
test('старий CSV у гривнях і новий CSV у тисячах дають однакові суми; нуль, пропуски та копійки збережені',()=>{
 const modern=importCSV('year;source;amountThousandUAH\n2026;Тест;"2280,00001"','revenues',demo),legacy=importCSV('year;source;amountUAH\n2026;Тест;"2280000,01"','revenues',demo);
 assert.deepEqual(modern.revenues,legacy.revenues);assert.equal(modern.revenues[0].amountThousandUAH,2280.00001);assert.match(toCSV(modern,'revenues'),/amountThousandUAH/);assert.doesNotMatch(toCSV(modern,'revenues'),/amountUAH/);
 assert.equal(summarize(importCSV('year;source;amountUAH\n2026;Тест;0','revenues',demo),2026).revenue,0);assert.equal(summarize({...modern,revenues:[]},2026).revenue,null);
 assert.throws(()=>importCSV('year;source;amountUAH;amountThousandUAH\n2026;Тест;1000;1','revenues',demo),/лише/);
});
test('нова XLSX-книга зберігає тисячі, стара повна книга з гривнями імпортується без повторного масштабування',async()=>{
 const data=validateBundle({...demo,projects:demo.projects.slice(0,1),publications:[],patents:[],revenues:demo.revenues.slice(0,1)}),book=new ExcelJS.Workbook();await book.xlsx.load(await toXLSX(data,'bundle',ExcelJS));
 assert.equal(book.getWorksheet('Надходження').getCell('C1').value,'amountThousandUAH');assert.equal(book.getWorksheet('Надходження').getCell('C2').value,2280);
 const settings=book.getWorksheet('Університет');settings.eachRow(row=>{if(row.getCell(1).value==='schemaVersion')row.getCell(2).value=1;});
 const revenues=book.getWorksheet('Надходження');revenues.getCell('C1').value='amountUAH';revenues.getCell('C2').value=2280000;
 const projects=book.getWorksheet('Проєкти'),column=CSV_HEADERS.projects.indexOf('funding')+1;projects.getRow(2).getCell(column).value=JSON.stringify(legacyData().projects[0].funding);
 assert.deepEqual(await importXLSX(await book.xlsx.writeBuffer(),'bundle',demo,ExcelJS),data);
});
test('ручні фінансові графіки перераховуються з мільйонів, а річна таблиця — з гривень; міграція ідемпотентна',()=>{
 for(const source of ['programs','fundingSources','funding']){
  const old=analytic(source,{headers:[source==='funding'?'Рік':'Програма','Надходження, млн ₴'],rows:[[source==='funding'?'2026':'Horizon','1,13'],[source==='funding'?'2025':'МОН','0'],[source==='funding'?'2024':'НФДУ','']]}),next=validateCMSBlock(old);
  assert.equal(next.dataTable.headers[1],'Надходження, тис. грн');assert.deepEqual(next.dataTable.rows.map(r=>r[1]),['1130','0','']);assert.deepEqual(validateCMSBlock(next),next);
 }
 const table=validateCMSBlock(analytic('fundingTable',{headers:['Джерело','2021','2022','2023'],rows:[['Державне фінансування','2280000','0','']]}));
 assert.deepEqual(table.dataTable,{headers:['Джерело, тис. грн','2021','2022','2023'],rows:[['Державне фінансування','2280','0','']]});assert.deepEqual(validateCMSBlock(table),table);
 const custom=validateCMSBlock({id:'custom-money',type:'table',title:'Надходження за джерелами',visible:true,columns:['Джерело','2021','2022'],rows:[['Державне фінансування','2280000','0']],caption:''});assert.deepEqual(custom.rows,[['Державне фінансування','2280','0']]);assert.deepEqual(validateCMSBlock(custom),custom);
 const unlabelled=validateCMSBlock(analytic('programs',{headers:['Програма','Кошти'],rows:[['A','1.13']]}));assert.equal(unlabelled.dataTable.rows[0][1],'1130');assert.deepEqual(validateCMSBlock(unlabelled),unlabelled);
});
test('ручні картки, резервні дані та довільні таблиці з одиницями зберігають числа, роки, частки й текст',()=>{
 const metric={id:'money-metric',type:'metrics',title:'Показники',visible:true,items:[{label:'Гранти',value:'1,13',unit:'млн ₴',note:'За рік'},{label:'Частка',value:'65',unit:'%',note:''}]};
 const converted=validateCMSBlock(metric);assert.equal(converted.items[0].value,formatMoney(1130));assert.equal(converted.items[0].unit,'тис. грн');assert.equal(converted.items[1].value,'65');assert.deepEqual(validateCMSBlock(converted),converted);
 const chart=validateCMSBlock({id:'money-chart',type:'chart',title:'Кошти, млн грн',visible:true,columns:['Рік','Програма А','Програма Б','Частка, %'],rows:[['2026','1.13','2.28','65']],settings:defaultBlockSettings()});assert.equal(chart.title,'Кошти, тис. грн');assert.deepEqual(chart.rows,[['2026','1130','2280','65']]);assert.deepEqual(validateCMSBlock(chart),chart);
 const count=validateCMSBlock({id:'count-table',type:'table',title:'Публікації',visible:true,columns:['Рік','Кількість'],rows:[['2026','1130']],caption:''});assert.deepEqual(count.rows,[['2026','1130']]);assert.equal(count.moneyUnit,undefined);
 assert.equal(convertMoneyText('Надійшло 1,13 млн ₴ за 2026 рік'),`Надійшло ${formatMoney(1130)} тис. грн за 2026 рік`);
});
test('проєкти у власних даних з гривнями, мільйонами й тисячами показують ту саму суму',()=>{
 const headers=['Назва','Програма','Початок','Завершення','Роль','Надходження, грн','Посилання','Міжнародний'];
 for(const [unit,value]of [['грн','1130000'],['млн ₴','1.13'],['тис. грн','1130']]){
  const block=validateCMSBlock(analytic('projects',{headers:headers.map(h=>h==='Надходження, грн'?`Надходження, ${unit}`:h),rows:[['Проєкт','МОН','2024-01-01','2028-12-31','Партнер',value,'','false']]}));
  assert.equal(block.dataTable.rows[0][5],'1130');assert.match(renderProjectTable(block.dataTable,{}, {},block.id,'2026-11-01'),/тис\. грн/);assert.deepEqual(validateCMSBlock(block),block);
 }
});
test('JSON, CSV та XLSX блоків експортують перераховані значення й витримують повторний імпорт',async()=>{
 const block=validateCMSBlock(analytic('programs',{headers:['Програма','Надходження, млн ₴'],rows:[['Horizon','1.13']]}));
 assert.deepEqual(validateCMSBlock(JSON.parse(JSON.stringify(block))),block);assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(block),block),block);assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(block,ExcelJS),block,ExcelJS),block);assert.match(cmsBlockCSV(block),/1130/);assert.doesNotMatch(cmsBlockCSV(block),/млн/);
});
test('пов’язані картки, програми й таблиці надходжень беруть суми в тих самих тисячах',()=>{
 const data=validateBundle(demo),analytics=createAnalytics({getData:()=>data,getYear:()=>2024,getRoute:()=> 'projects',getPage:()=>null}),project=analytics.getBlockTable('projects').rows[0];
 const p=data.projects.find(p=>p.title===project[0]);assert.equal(Number(project[5]),p.funding.find(f=>f.year===2024).amountThousandUAH);
 const program=analytics.getBlockTable('programs').rows.find(r=>r[0]===p.program),expected=data.projects.flatMap(p2=>p2.program===p.program?p2.funding.filter(f=>f.year===2024):[]).reduce((sum,f)=>sum+f.amountThousandUAH,0);assert.equal(Number(program[1]),expected);
 assert.equal(analytics.getBlockTable('fundingTable',true).rows[0][1],'2280');assert(analytics.getBlockTable('funding').headers[1].includes('тис. грн'));
});
