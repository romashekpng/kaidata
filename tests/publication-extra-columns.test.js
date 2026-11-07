import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {CSV_HEADERS,validateBundle,importCSV,toCSV,summarize,datasetColumns} from '../src/data.js';
import {toXLSX,importXLSX} from '../src/spreadsheet.js';
import {createAnalytics} from '../src/analytics.js';
import {defaultBlockSettings,validateCMSBlock} from '../src/cms-data.js';
import {tableToCMSBlock,cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX} from '../src/cms-io.js';
import {publicationCatalogConfig,defaultCatalogLine} from '../src/catalog-schema.js';
import {createSiteView} from '../src/site-view.js';
const demo=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url),'utf8'));
const base=()=>validateBundle({...demo,publications:demo.publications.slice(0,2).map((p,i)=>({...p,year:2026-i}))});
const csv=()=>toCSV(base(),'publications').split('\r\n').map((r,i)=>r+(i===0?';DOI;Scopus URL;Journal':i===1?';10.1234/first;https://scopus.com/first;Journal A':';10.1234/second;;Journal B')).join('\r\n');
const imported=()=>importCSV(csv(),'publications',base());
const analytics=data=>createAnalytics({getData:()=>data,getYear:()=>2026,getRoute:()=> 'publications',getPage:()=>null});
const block=()=>({id:'extended-publications',type:'analytics',source:'publications',title:'Публікації в Scopus / Web of Science',visible:true,dataMode:'live',settings:defaultBlockSettings('publications')});
test('publication CSV accepts arbitrary extra columns and keeps analytics unchanged',()=>{
 const data=imported(),before=summarize(base(),2026),after=summarize(data,2026);
 assert.deepEqual(data.publicationColumns,['DOI','Scopus URL','Journal']);
 assert.equal(data.publications[0].extraFields.DOI,'10.1234/first');
 for(const key of ['indexed','q12','publications'])assert.equal(Array.isArray(before[key])?before[key].length:before[key],Array.isArray(after[key])?after[key].length:after[key]);
 assert.deepEqual(data.projects,base().projects);
 const round=importCSV(toCSV(data,'publications'),'publications',base());assert.deepEqual(round.publications,data.publications);assert.deepEqual(round.publicationColumns,data.publicationColumns);
 const clean=importCSV(toCSV(base(),'publications'),'publications',data);assert.equal(clean.publicationColumns,undefined);assert.equal(clean.publications[0].extraFields,undefined);
});
test('JSON, single-table XLSX and full-workbook XLSX preserve extras including empty columns',async()=>{
 const data=imported();assert.deepEqual(validateBundle(JSON.parse(JSON.stringify(data))),data);
 for(const mode of ['publications','bundle']){const round=await importXLSX(await toXLSX(data,mode,ExcelJS),mode,base(),ExcelJS);assert.deepEqual(round.publications,data.publications);assert.deepEqual(round.publicationColumns,data.publicationColumns);}
 const empty=validateBundle({...data,publications:[]}),round=await importXLSX(await toXLSX(empty,'bundle',ExcelJS),'bundle',base(),ExcelJS);assert.deepEqual(round.publicationColumns,data.publicationColumns);assert.deepEqual(round.publications,[]);
});
test('extra column validation limits width, rejects object cells and unsafe keys, and quotes column delimiters',()=>{
 const data=imported();
 for(const header of ['__proto__','constructor','=HYPERLINK("x")'])assert.throws(()=>validateBundle({...data,publicationColumns:[header]}));
 assert.throws(()=>validateBundle({...data,publicationColumns:Array.from({length:71},(_,i)=>'Extra '+i)}),/80/);
 assert.throws(()=>validateBundle({...data,publications:[{...data.publications[0],extraFields:{DOI:{url:'x'}}}]}),/10 000/);
 const changed=validateBundle({...base(),publicationColumns:['Journal; title'],publications:base().publications.map(p=>({...p,extraFields:{'Journal; title':'=not a formula'}}))});
 const round=importCSV(toCSV(changed,'publications'),'publications',base());assert.equal(round.publications[0].extraFields['Journal; title'],"'=not a formula");
 assert.deepEqual(datasetColumns(data,'publications'),[...CSV_HEADERS.publications,...data.publicationColumns]);
});
test('analytics source exposes all added fields for selected years without changing chart totals',()=>{
 const data=imported(),a=analytics(data),table=a.getBlockTable('publications');
 assert(table.headers.includes('DOI'));assert(table.headers.includes('Кафедра'));assert(table.headers.includes('ID'));assert.equal(table.rows.length,1);assert.equal(table.rows[0][table.headers.indexOf('DOI')],'10.1234/first');assert.equal(a.getBlockTable('publications',true).rows.length,2);
 const collision=validateBundle({...data,publicationColumns:[...data.publicationColumns,'Назва'],publications:data.publications.map(p=>({...p,extraFields:{...p.extraFields,'Назва':'Additional title'}}))}),columns=analytics(collision).getBlockTable('publications').headers;assert.equal(new Set(columns).size,columns.length);assert(columns.includes('Назва (додаткове поле)'));
});
test('existing publication block accepts more than 12 raw columns and preserves display config through exports',async()=>{
 const table=analytics(imported()).getBlockTable('publications',true);for(let i=0;i<5;i++){table.headers.push('Extra '+i);table.rows.forEach(r=>r.push('Value '+i));}
 const catalog=publicationCatalogConfig(table.headers);catalog.columns[0].lines[0].linkField='DOI';catalog.columns.push({label:'Журнал',width:0,align:'left',lines:[defaultCatalogLine('Journal')]});
 const b=tableToCMSBlock(table,{...block(),catalog});assert.equal(b.dataTable.headers.length,18);assert.equal(b.dataMode,'manual');assert.equal(validateCMSBlock(b).catalog.columns[0].lines[0].linkField,'DOI');
 assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(b),b),b);assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(b,ExcelJS),b,ExcelJS),b);
});
test('publication presentation selects fields, DOI links, filters and search independently from raw data',()=>{
 const data=imported(),a=analytics(data),catalog=publicationCatalogConfig(a.getBlockTable('publications').headers);catalog.columns[0].lines[0].linkField='DOI';catalog.columns[0].lines.push({...defaultCatalogLine('Journal'),label:'Журнал:'});catalog.searchFields.push('DOI');catalog.filters.push({label:'Журнал',field:'Journal',multiple:false});
 const b=validateCMSBlock({...block(),catalog}),view=createSiteView({getData:()=>data,getYear:()=>2026,getBlock:()=>b,getBlockTable:a.getBlockTable,getBlockPeriod:()=> '2026'}),result=view.catalogTable(b),html=view.renderBlocks({blocks:[b]});
 assert.equal(result.error,'');assert.equal(result.table.rows.length,1);assert.match(html,/href="https:\/\/doi.org\/10.1234\/first"/);assert.match(html,/Журнал:.*Journal A/);assert.doesNotMatch(html,/<th[^>]*>DOI/);assert.match(html,/data-catalog-filter="3"/);
 assert.deepEqual(data.publications,imported().publications);
 const old=publicationCatalogConfig(a.getBlockTable('publications').headers,false);assert.equal(old.columns[0].lines[0].linkField,'');assert.equal(block().catalog,undefined);
});
test('publication extras remain text even when names match fields of other datasets; all 80 columns are available',async()=>{
 const names=['funding','progressByYear','amountUAH',...Array.from({length:67},(_,i)=>'Extra '+i)],data=validateBundle({...base(),publicationColumns:names,publications:base().publications.map(p=>({...p,extraFields:Object.fromEntries(names.map(h=>[h,'Text '+h]))}))});
 assert.equal(datasetColumns(data,'publications').length,80);assert.equal(analytics(data).getBlockTable('publications').headers.length,80);
 assert.deepEqual(importCSV(toCSV(data,'publications'),'publications',base()).publications,data.publications);
 assert.deepEqual((await importXLSX(await toXLSX(data,'publications',ExcelJS),'publications',base(),ExcelJS)).publications,data.publications);
 const table=analytics(data).getBlockTable('publications');assert.equal(tableToCMSBlock(table,block()).dataTable.headers.length,80);
 assert.throws(()=>tableToCMSBlock({headers:[...table.headers,'Too many'],rows:table.rows.map(r=>[...r,''])},block()),/80/);
});
