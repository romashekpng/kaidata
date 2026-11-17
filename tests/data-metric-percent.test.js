import test from 'node:test';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
import {defaultCMSBlock,validateCMSBlock} from '../src/cms-data.js';import {resolveDataMetrics} from '../src/data-metrics.js';import {cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX,readCMSJSON} from '../src/cms-io.js';
const table={headers:['Рік','Індексація','Квартиль','Міжнародний','Сума'],rows:[['2024','Scopus','Q1','true','10'],['2025','Scopus','Q1','true','30'],['2025','Scopus / WoS','Q2','false','20'],['2025','','','false','50'],['2026','','','true','0']]};
const ctx=(year=2025)=>({year,years:[2024,2025,2026],getTable:()=>structuredClone(table)});
const block=mode=>{const b=defaultCMSBlock('dataMetrics');b.cards[0].noteCalculation.mode=mode;b.cards[0].note='{percent} від усіх';return b;};
const result=(b,year=2025)=>resolveDataMetrics(b,ctx(year)).results[0];
test('indexed share counts combined indexes once and permits an independently filtered denominator',()=>{
 const b=block('share'),c=b.cards[0];c.filters=[{column:'Індексація',match:'tokens',values:['Scopus','WoS']}];assert.equal(result(b).number,2);assert.equal(result(b).note,'66,7% від усіх');
 c.filters.push({column:'Квартиль',match:'exact',values:['Q1']});c.noteCalculation.denominatorFilters=[{column:'Індексація',match:'tokens',values:['Scopus','WoS']}];assert.equal(result(b).note,'50% від усіх');
 c.note='Індексованих: {percent}; {numerator} / {denominator}';assert.equal(result(b).note,'Індексованих: 50%; 1 / 2');
});
test('independent numerator supports international project counts and funding shares without altering main number',()=>{
 const b=block('share'),c=b.cards[0];Object.assign(c.noteCalculation,{useCardFilters:false,numeratorFilters:[{column:'Міжнародний',match:'exact',values:['true']}]});
 assert.equal(result(b).number,3);assert.equal(result(b).note,'33,3% від усіх');
 c.binding.operation='sum';c.binding.valueColumns=['Сума'];assert.equal(result(b).number,100);assert.equal(result(b).note,'30% від усіх');
 c.note='— міжнародні програми';assert.equal(result(b).note,'30% — міжнародні програми');
});
test('yearly dynamics preserve filters, sign, previous value and update with selected year',()=>{
 const b=block('delta'),c=b.cards[0];c.note='{percent} до {previousPeriod} ({previous})';assert.equal(result(b).note,'+200% до 2024 (1)');assert.equal(result(b,2026).note,'-66,7% до 2025 (3)');
 c.filters=[{column:'Індексація',match:'tokens',values:['Scopus']}];assert.equal(result(b).note,'+100% до 2024 (1)');
 c.binding.operation='sum';c.binding.valueColumns=['Сума'];assert.equal(result(b).note,'+400% до 2024 (10)');
});
test('fixed periods shift one year, while all-years and zero denominators never produce Infinity',()=>{
 const b=block('delta'),c=b.cards[0];c.binding.periodMode='fixed';c.binding.period='2025';assert.equal(result(b,2026).percentage,200);
 c.binding.period='2025-2026';assert.equal(result(b).percentage,0);
 c.binding.periodMode='all';assert.equal(result(b).percent,'—');assert.equal(result(b).number,5);
 c.binding.periodMode='year';assert.equal(result(b,2024).percent,'—');
 c.noteCalculation.mode='share';c.binding.operation='sum';c.binding.valueColumns=['Сума'];assert.equal(result(b,2026).percent,'—');assert.equal(result(b,2026).number,0);
});
test('legacy manual notes remain unchanged; invalid comparison configuration is rejected',()=>{
 const b=block('manual');delete b.cards[0].noteCalculation;b.cards[0].note='За {period}: {value}';assert.equal(result(b).note,'За 2025: 3');
 const c=block('share');c.cards[0].noteCalculation.decimals=7;assert.throws(()=>validateCMSBlock(c));c.cards[0].noteCalculation.decimals=1;c.cards[0].noteCalculation.mode='unknown';assert.throws(()=>validateCMSBlock(c));
});
test('complete percentage rules survive JSON and CSV/XLSX export/import',async()=>{
 const b=block('share'),c=b.cards[0];Object.assign(c.noteCalculation,{background:'custom',backgroundColor:'#123456',useCardFilters:false,numeratorFilters:[{column:'Міжнародний',match:'exact',values:['true']}],denominatorFilters:[{column:'Індексація',match:'tokens',values:['Scopus']}]});
 const valid=validateCMSBlock(b);for(const copy of [readCMSJSON(JSON.stringify({blockVersion:1,block:valid}),'block',valid),importCMSBlockCSV(cmsBlockCSV(valid),valid),await importCMSBlockXLSX(await cmsBlockXLSX(valid,ExcelJS),valid,ExcelJS)]){assert.deepEqual(copy,valid);assert.equal(result(copy).percentage,50);}
});
test('percentage highlights target calculated tokens only, escape text and keep the card background independent',async()=>{
 const {renderDataMetrics}=await import('../src/data-metrics.js');const b=block('share'),c=b.cards[0];c.background='amber';Object.assign(c.noteCalculation,{background:'green',backgroundColor:'#123456'});c.note='<img src=x> {percent} від усіх; текст 100%';
 let r=resolveDataMetrics(b,ctx()),html=renderDataMetrics(b,r);assert(html.includes('cms-metric-note-highlight cms-text-bg-green'));assert(html.includes('cms-card-background cms-text-bg-amber'));assert(!html.includes('<img src=x>'));assert(html.includes('&lt;img src=x&gt;'));assert.equal((html.match(/cms-metric-note-highlight/g)||[]).length,1);assert(html.includes('текст 100%'));
 c.noteCalculation.background='custom';html=renderDataMetrics(b,resolveDataMetrics(b,ctx()));assert(html.includes('--text-block-bg:#123456'));assert(html.includes('--text-block-ink:#ffffff'));
 c.note='від усіх';assert(renderDataMetrics(b,resolveDataMetrics(b,ctx())).includes('cms-metric-note-highlight'));
 c.noteCalculation.background='default';assert(!renderDataMetrics(b,resolveDataMetrics(b,ctx())).includes('cms-metric-note-highlight'));
 c.noteCalculation.mode='delta';c.noteCalculation.background='green';assert(!renderDataMetrics(b,resolveDataMetrics(b,ctx(2024))).includes('cms-metric-note-highlight'));
});
