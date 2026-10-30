import test from 'node:test';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
import {defaultCMSBlock,defaultBlockSettings,validateCMSBlock,metricColorTable,moveTableItem} from '../src/cms-data.js';
import {blockTable,tableToCMSBlock,cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX,readCMSJSON} from '../src/cms-io.js';
import {renderMetricTable} from '../src/block-view.js';
const table={headers:['label','value','unit','note','background','backgroundColor'],rows:[['Публікації','128','','За рік','menu','#25395d'],['Гранти','12','','Виконуються','custom','#ffff00']]};
test('фон кожної картки залишається з її даними при переміщенні рядків і колонок',()=>{
 const moved=moveTableItem(moveTableItem(table,'row',0,1),'column',4,0);const block=tableToCMSBlock(moved,defaultCMSBlock('metrics'));
 assert.equal(block.items[0].label,'Гранти');assert.equal(block.items[0].background,'custom');assert.equal(block.items[0].backgroundColor,'#ffff00');assert.equal(block.items[1].background,'menu');
 const html=renderMetricTable(blockTable(block),defaultBlockSettings());assert(html.includes('cms-text-bg-custom'));assert(html.includes('--text-block-ink:#000000'));assert(html.includes('cms-text-bg-menu'));
 assert(!renderMetricTable({headers:['label','value','unit','note'],rows:[['A','1','','']]},defaultBlockSettings()).includes('cms-card-background'));
});
test('нативні та аналітичні показники переносять індивідуальні фони через JSON, CSV та XLSX',async()=>{
 for(const current of [defaultCMSBlock('metrics'),{id:'stats-color',type:'analytics',source:'stats',title:'Показники',visible:true}]){
  const block=tableToCMSBlock(table,current);assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block}),'block',block),block);assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(block),block),block);assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(block,ExcelJS),block,ExcelJS),block);
 }
 const old=defaultCMSBlock('metrics');assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(old),old),old);
 const initialized=metricColorTable(blockTable(old));assert.equal(initialized.headers.length,6);assert.equal(initialized.rows[0][4],'default');assert.equal(blockTable(old).headers.length,4);
});
test('фон карток перевіряється під час імпорту, довільні класи й CSS не потрапляють у відображення',()=>{
 for(const [background,color]of [['bad','#123456'],['custom','red'],['menu onclick=x','#123456'],['custom','#123456;display:none']]){
  const invalid=structuredClone(table);invalid.rows[0][4]=background;invalid.rows[0][5]=color;
  for(const current of [defaultCMSBlock('metrics'),{id:'stats-bad',type:'analytics',source:'stats',title:'Показники',visible:true}])assert.throws(()=>tableToCMSBlock(invalid,current));
 }
 assert.throws(()=>validateCMSBlock({...defaultCMSBlock('metrics'),items:[{label:'A',value:'1',unit:'',note:'',background:0}]}));
});

test('фон не витісняє наявні колонки: аналітичні показники з 12 колонками даних переносяться через XLSX',async()=>{
 const original={headers:['label','value','unit','note',...Array.from({length:8},(_,i)=>'extra'+i)],rows:[['A','1','','',...Array(8).fill('Збережено')]]};
 const colored=metricColorTable(original);colored.rows[0][12]='menu';
 const block=tableToCMSBlock(colored,{id:'wide-metrics',type:'analytics',source:'stats',title:'Показники',visible:true});
 assert.equal(block.dataTable.headers.length,14);assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(block,ExcelJS),block,ExcelJS),block);
});
