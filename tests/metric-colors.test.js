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

test('зміна лише фону чи порядку зберігає автоматичний режим та передає оформлення через JSON/CSV/XLSX',async()=>{
 const {metricAppearanceFromTable,applyMetricAppearance}=await import('../src/cms-data.js');
 const current={id:'live-metrics',type:'analytics',source:'stats',title:'Показники',visible:true,dataMode:'live',dataTable:structuredClone(table)};
 const edited=moveTableItem(table,'row',0,1);edited.rows[1][4]='green';
 const next=tableToCMSBlock(edited,current);assert.equal(next.dataMode,'live');assert.equal(next.metricAppearance[0].key,'Гранти');
 assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block:next}),'block',next),next);
 assert.equal(importCMSBlockCSV(cmsBlockCSV(next),next).dataMode,'live');assert.equal((await importCMSBlockXLSX(await cmsBlockXLSX(next,ExcelJS),next,ExcelJS)).dataMode,'live');
 const updated=structuredClone(table);updated.rows[0][1]='150';const styled=applyMetricAppearance(updated,metricAppearanceFromTable(edited));assert.equal(styled.rows[1][1],'150');assert.equal(styled.rows[1][4],'green');
 const changed=structuredClone(edited);changed.rows[0][1]='999';const manual=tableToCMSBlock(changed,current);assert.equal(manual.dataMode,'manual');assert.equal(manual.metricEditingVersion,1);
});

test('виправлення старих кольорових знімків повертає автоматику без втрати фону та не підміняє власні дані',async()=>{
 const {restoreMetricSnapshot}=await import('../src/cms-data.js');
 const old={id:'old-stats',type:'analytics',source:'stats',title:'Показники',visible:true,dataMode:'manual',dataPeriod:'2026',dataTable:structuredClone(table)};
 const restored=restoreMetricSnapshot(old,table);assert.equal(restored.dataMode,'live');assert.equal(restored.metricAppearance[0].background,'menu');assert.deepEqual(restored.dataTable,old.dataTable);assert.equal(old.dataMode,'manual');
 const custom=structuredClone(old);custom.dataTable.rows[0][1]='999';assert.equal(restoreMetricSnapshot(custom,table),custom);
 const explicit={...old,metricEditingVersion:1};assert.equal(restoreMetricSnapshot(explicit,table),explicit);
 const withBackup=validateCMSBlock({...restored,metricManualBackup:{dataTable:custom.dataTable,dataPeriod:'2026'}});assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block:withBackup}),'block',withBackup).metricManualBackup.dataTable,custom.dataTable);
});
