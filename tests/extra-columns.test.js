import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import ExcelJS from 'exceljs';
import {validateBundle,importCSV,toCSV,datasetColumns,EXTRA_COLUMN_KEYS} from '../src/data.js';import {importXLSX,toXLSX} from '../src/spreadsheet.js';import {createAnalytics} from '../src/analytics.js';import {defaultCMSBlock} from '../src/cms-data.js';import {resolveCatalog} from '../src/catalog-view.js';import {defaultCatalogLine} from '../src/catalog-schema.js';
const base=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url),'utf8'));
const small=()=>validateBundle({...base,...Object.fromEntries(['publications','projects','patents','revenues'].map(k=>[k,base[k].slice(0,2)]))});
test('additional columns for every dataset survive JSON, CSV and full/selected XLSX exports',async()=>{
 let data=small();for(const key of Object.keys(EXTRA_COLUMN_KEYS)){data[EXTRA_COLUMN_KEYS[key]]=['custom'];data[key][0].extraFields={custom:'Значення 001'};}data=validateBundle(data);
 assert.deepEqual(validateBundle(JSON.parse(JSON.stringify(data))),data);
 for(const key of Object.keys(EXTRA_COLUMN_KEYS)){assert(datasetColumns(data,key).includes('custom'));const csv=importCSV(toCSV(data,key),key,small());assert.equal(csv[key][0].extraFields.custom,'Значення 001');const xlsx=await importXLSX(await toXLSX(data,key,ExcelJS),key,small(),ExcelJS);assert.deepEqual(xlsx[key],data[key]);}
 const full=await importXLSX(await toXLSX(data,'bundle',ExcelJS),'bundle',small(),ExcelJS);assert.deepEqual(full,data);
});
test('adding patent year to an exported full workbook imports and re-exports without losing columns',async()=>{
 const data=small(),book=new ExcelJS.Workbook();await book.xlsx.load(await toXLSX(data,'bundle',ExcelJS));const sheet=book.getWorksheet('Патенти');sheet.getCell(1,8).value='year';sheet.getCell(2,8).value=2024;sheet.getCell(3,8).value=2025;sheet.getCell(1,9).value='Категорія';sheet.getCell(2,9).value='B';
 const next=await importXLSX(await book.xlsx.writeBuffer(),'bundle',data,ExcelJS);assert.deepEqual(next.patentColumns,['year','Категорія']);assert.equal(next.patents[0].extraFields.year,'2024');assert.equal(next.patents[1].extraFields.Категорія,'');assert.equal(next.patents[0].date,data.patents[0].date);
 const again=await importXLSX(await toXLSX(next,'bundle',ExcelJS),'bundle',data,ExcelJS);assert.deepEqual(again,next);
 const analytics=createAnalytics({getData:()=>next,getYear:()=>2024,getRoute:()=> 'patents',getFilters:()=>({})}),table=analytics.getBlockTable('patents',true);assert(table.headers.includes('year'));assert.equal(table.rows[0][table.headers.indexOf('year')],'2024');
 const block=defaultCMSBlock('catalog');block.binding={...block.binding,source:'patents',periodMode:'all'};block.catalog.searchEnabled=false;block.catalog.filters=[];block.catalog.columns=[{label:'Рік',width:100,align:'left',lines:[defaultCatalogLine('year')]}];const context={year:2024,getTable:analytics.getBlockTable};assert.equal(resolveCatalog(block,context).error,'');block.catalog.columns=[{label:'Назва',width:0,align:'left',lines:[defaultCatalogLine('Назва')]}];assert.equal(resolveCatalog(block,context).error,'');
});
test('custom column schemas retain required fields and reject reserved/duplicate headers and excessive width',()=>{
 const data=small();for(const name of ['id','__proto__','=formula'])assert.throws(()=>validateBundle({...data,patentColumns:[name]}));assert.throws(()=>validateBundle({...data,patentColumns:['x','x']}));assert.throws(()=>validateBundle({...data,patentColumns:Array.from({length:80},(_,i)=>'x'+i)}));assert.throws(()=>importCSV('id;year\na;2024','patents',data),/Відсутні/);
});
test('replacing a table may remove custom columns and preserves fields in other datasets',()=>{
 let data=small();data.patentColumns=['year','Note'];data.patents[0].extraFields={year:'2024',Note:'Keep'};data.projectColumns=['Tag'];data.projects[0].extraFields={Tag:'Project'};data=validateBundle(data);
 const next=importCSV(toCSV({...data,patentColumns:['year'],patents:data.patents.map(p=>({...p,extraFields:{year:p.extraFields.year}}))},'patents'),'patents',data);assert.deepEqual(next.patentColumns,['year']);assert(!Object.hasOwn(next.patents[0].extraFields,'Note'));assert.deepEqual(next.projects,data.projects);
});
