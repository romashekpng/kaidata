import test from 'node:test';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
import {defaultCMSBlock,validateCMSBlock} from '../src/cms-data.js';import {inferCatalogConfig} from '../src/catalog-schema.js';import {renderCatalog} from '../src/catalog-view.js';import {readCMSJSON,cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX} from '../src/cms-io.js';
const table={headers:['Номер'],rows:[['146770']]};
const block=()=>validateCMSBlock({...defaultCMSBlock('catalog'),binding:{...defaultCMSBlock('catalog').binding,kind:'upload',periodMode:'all'},dataTable:table,catalog:inferCatalogConfig(table.headers,'table')});
test('catalog heading, content and individual line alignment are independent and survive transfers',async()=>{
 const b=block(),col=b.catalog.columns[0];col.align='center';col.contentAlign='right';col.lines[0].align='left';col.lines[0].style='mutedItalic';col.lines[0].format='badges';const valid=validateCMSBlock(b),html=renderCatalog(valid,{table,error:''});assert(html.includes('catalog-cell-mutedItalic'));assert.match(html,/<th[^>]*text-align:center/);assert.match(html,/<td[^>]*text-align:right/);assert(html.includes('--catalog-content-justify:flex-end'));assert(html.includes('--catalog-line-justify:flex-start'));
 for(const restored of [readCMSJSON(JSON.stringify({blockVersion:1,block:valid}),'block',valid),importCMSBlockCSV(cmsBlockCSV(valid),valid),await importCMSBlockXLSX(await cmsBlockXLSX(valid,ExcelJS),valid,ExcelJS)])assert.deepEqual(restored.catalog,valid.catalog);
});
test('legacy catalogs retain inherited alignment; invalid alignments are rejected',()=>{
 const b=block();b.catalog.columns[0].align='center';const html=renderCatalog(b,{table,error:''});assert.match(html,/<td[^>]*text-align:center/);assert(html.includes('--catalog-content-justify:center'));
 for(const key of ['contentAlign','align']){const clone=structuredClone(b);if(key==='align')clone.catalog.columns[0].lines[0].align='justify';else clone.catalog.columns[0][key]='justify';assert.throws(()=>validateCMSBlock(clone),/вирівнювання/);}
});
