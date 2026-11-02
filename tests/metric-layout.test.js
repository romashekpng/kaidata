import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {defaultCMSBlock,defaultBlockSettings,validateBlockSettings,validateCMSBlock} from '../src/cms-data.js';
import {readCMSJSON,cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX} from '../src/cms-io.js';
test('automatic metric columns are optional and retain the saved fixed count',()=>{
 assert.equal(defaultBlockSettings().autoColumns,false);
 const old=validateBlockSettings({columns:4});assert.equal(old.columns,4);assert.equal(old.autoColumns,false);
 const auto=validateBlockSettings({...old,autoColumns:true});assert.equal(auto.autoColumns,true);assert.equal(auto.columns,4);assert.equal(validateBlockSettings({...auto,autoColumns:false}).columns,4);
 assert.throws(()=>validateBlockSettings({autoColumns:'true'}));
});
test('automatic layout persists through native, live and manual metric block transfers',async()=>{
 const settings={...defaultBlockSettings(),autoColumns:true,columns:4};
 const native=validateCMSBlock({...defaultCMSBlock('metrics'),settings});
 const live=validateCMSBlock({id:'live-auto',type:'analytics',source:'stats',title:'Показники',visible:true,dataMode:'live',settings});
 const manual=validateCMSBlock({...live,id:'manual-auto',dataMode:'manual',metricEditingVersion:1,dataTable:{headers:['label','value','unit','note'],rows:[['Власний показник','42','','Примітка']]}});
 for(const block of[native,live,manual])assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block}),'block',block),block);
 for(const block of[native,manual]){
  assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(block),block),block);
  assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(block,ExcelJS),block,ExcelJS),block);
 }
});
