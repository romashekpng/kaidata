import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {expandSiteBlocks,validateSite,defaultCMSBlock} from '../src/cms-data.js';
import {cmsBlockXLSX,importCMSBlockXLSX} from '../src/cms-io.js';
const initial=JSON.parse(await readFile(new URL('../data/pages.json',import.meta.url),'utf8'));
const defaults=expandSiteBlocks(initial);
const publications=site=>site.pages.find(p=>p.id==='publications');
const legacy=()=>{const site=structuredClone(defaults),p=publications(site);delete p.scopusLayoutVersion;p.blocks=p.blocks.filter(b=>b.id!=='scopus-document-types');const f=p.blocks.find(b=>b.source==='faculties');f.settings.width=100;p.blocks=p.blocks.filter(b=>b!==f).concat(f);return site;};
test('Scopus source table and stacked chart defaults match the attached workbook',async()=>{
 const page=publications(defaults),chart=page.blocks.find(b=>b.id==='scopus-document-types'),i=page.blocks.indexOf(chart);
 assert.equal(chart.title,'Публікації в Scopus за типом документів');assert.equal(chart.type,'chart');assert.equal(chart.settings.width,66);assert.equal(chart.settings.chartType,'stacked');assert.equal(chart.settings.legend,'bottom');assert.equal(chart.settings.legendCentered,true);assert.equal(chart.settings.allYears,true);
 assert.deepEqual(chart.columns,['Рік','Conference paper','Article','Book chapter','Book','Other publications']);
 assert.deepEqual(chart.rows,[['2021','251','236','25','0','7'],['2022','205','253','29','2','11'],['2023','238','241','61','3','14'],['2024','279','225','45','1','16'],['2025','252','198','46','1','7'],['2026','84','115','21','1','8']]);
 assert.deepEqual(chart.rows.map(r=>r.slice(1).reduce((a,b)=>a+Number(b),0)),[519,500,557,566,504,229]);
 assert.equal(page.blocks[i+1].source,'faculties');assert.equal(page.blocks[i+1].settings.width,34);assert.equal(page.blocks[i+2].source,'publications');assert.equal(page.scopusLayoutVersion,1);
 assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(chart,ExcelJS),chart,ExcelJS),chart);
});
test('saved publication page gains the new chart once while retaining custom content and faculty data',()=>{
 const old=legacy(),p=publications(old),faculty=p.blocks.find(b=>b.source==='faculties');faculty.dataMode='manual';faculty.dataTable={headers:['Факультет','Публікації'],rows:[['Власний факультет','123']]};faculty.settings.customColors=['#123456'];p.blocks.unshift(defaultCMSBlock('text'));const snapshot=structuredClone(old);
 const migrated=expandSiteBlocks(old,defaults),next=publications(migrated),index=next.blocks.findIndex(b=>b.id==='scopus-document-types');
 assert.equal(next.blocks[index-1].source,'quartiles');assert.equal(next.blocks[index+1].id,faculty.id);assert.equal(next.blocks[index+1].settings.width,34);assert.deepEqual(next.blocks[index+1].dataTable,faculty.dataTable);assert.deepEqual(next.blocks[index+1].settings.customColors,['#123456']);assert.equal(next.blocks[0].type,'text');assert.deepEqual(old,snapshot);assert.deepEqual(expandSiteBlocks(migrated,defaults),migrated);
 next.blocks=next.blocks.filter(b=>b.id!=='scopus-document-types');next.blocks.find(b=>b.source==='faculties').settings.width=45;assert.deepEqual(expandSiteBlocks(migrated,defaults),validateSite(migrated));
});
test('matching existing Scopus chart is retained and full pages remain valid',()=>{
 const old=legacy(),p=publications(old),chart=structuredClone(publications(defaults).blocks.find(b=>b.type==='chart'));chart.id='user-scopus';chart.rows[0][1]='999';p.blocks.push(chart);
 const migrated=publications(expandSiteBlocks(old,defaults));assert.equal(migrated.blocks.filter(b=>b.title===chart.title).length,1);assert.equal(migrated.blocks.find(b=>b.id===chart.id).rows[0][1],'999');assert.equal(migrated.blocks[migrated.blocks.findIndex(b=>b.id===chart.id)+1].source,'faculties');
 const full=legacy();while(publications(full).blocks.length<50)publications(full).blocks.push(defaultCMSBlock('text'));assert.equal(publications(expandSiteBlocks(full,defaults)).blocks.length,50);assert.equal(publications(expandSiteBlocks(full,defaults)).scopusLayoutVersion,undefined);
});
