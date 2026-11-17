import test from 'node:test';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
import {defaultCMSBlock,validateCMSBlock,defaultBlockSettings} from '../src/cms-data.js';import {renderBlockTable} from '../src/block-view.js';import {renderCatalog} from '../src/catalog-view.js';import {cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX,readCMSJSON} from '../src/cms-io.js';
const table={headers:['Назва'],rows:[['A'],['B']]};
test('zebra is enabled by default for legacy blocks, can be disabled, and survives transfers',async()=>{
 assert.equal(defaultBlockSettings().zebraRows,true);
 for(const type of ['table','list','catalog']){
  const block=defaultCMSBlock(type);assert.equal(validateCMSBlock({...block,settings:{}}).settings.zebraRows,true);block.settings={...block.settings,zebraRows:false};const valid=validateCMSBlock(block);
  for(const copy of [readCMSJSON(JSON.stringify({blockVersion:1,block:valid}),'block',valid),importCMSBlockCSV(cmsBlockCSV(valid),valid),await importCMSBlockXLSX(await cmsBlockXLSX(valid,ExcelJS),valid,ExcelJS)])assert.equal(copy.settings.zebraRows,false);
 }
 assert.throws(()=>validateCMSBlock({...defaultCMSBlock('table'),settings:{zebraRows:'false'}}));
});
test('table and catalog zebra can be toggled independently without changing records',()=>{
 assert(renderBlockTable(table).includes('row-zebra'));assert(!renderBlockTable(table,false,false).includes('row-zebra'));
 const b=defaultCMSBlock('catalog');b.catalog.columns=[{label:'Назва',width:0,align:'left',lines:[{field:'Назва',style:'text',format:'text',label:'',tokenLinks:[]}]}];
 assert(renderCatalog(b,{table,error:''}).includes('row-zebra'));b.settings={...b.settings,zebraRows:false};const html=renderCatalog(b,{table,error:''});assert(!html.includes('row-zebra'));assert(html.includes('A'));assert(html.includes('B'));
});
