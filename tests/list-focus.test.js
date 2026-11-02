import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import ExcelJS from 'exceljs';
import {defaultBlockSettings,defaultCMSBlock,validateCMSBlock,chartSettingsForLibrary} from '../src/cms-data.js';
import {defaultSiteStyles,validateSiteStyles,siteStyleVariables} from '../src/style-data.js';
import {validateBundle} from '../src/data.js';import {toXLSX,importXLSX} from '../src/spreadsheet.js';import {readCMSJSON,cmsBlockCSV,importCMSBlockCSV} from '../src/cms-io.js';
const sources=['stats','projects','publications','faculties','patents','fundingTable'];
test('нові блоки всіх редагованих типів починають із повного списку',()=>{
 assert.equal(defaultBlockSettings().showAll,true);
 const fresh=defaultCMSBlock('analytics');assert.equal(validateCMSBlock({...fresh,settings:{...defaultBlockSettings('stats'),showAll:false}}).settings.showAll,false);
 for(const type of ['text','table','list','banner','metrics','chart','analytics']){const block=validateCMSBlock(defaultCMSBlock(type));assert.equal(chartSettingsForLibrary(block.settings||{},undefined,block.source).showAll,true,type);}
});
test('наявні шість видів блоків отримують повний список один раз, решта налаштувань та вміст збережені',()=>{
 for(const source of sources){const old={id:'old-'+source,type:'analytics',source,title:'Моя назва',visible:true,dataMode:'live',settings:{...defaultBlockSettings(source),showAll:false,width:66}};const next=validateCMSBlock(old);assert.equal(next.settings.showAll,true);assert.equal(next.listDisplayVersion,1);assert.equal(next.title,'Моя назва');assert.equal(next.settings.width,66);assert.equal(old.settings.showAll,false);assert.deepEqual(validateCMSBlock(next),next);}
 for(const source of ['quartiles','publicationChart','funding']){const next=validateCMSBlock({id:'other-'+source,type:'analytics',source,title:'Інший блок',visible:true,dataMode:'live',settings:{...defaultBlockSettings(source),showAll:false}});assert.equal(next.settings.showAll,false);}
});
test('ручне вимкнення повного списку після переходу зберігається при валідації та обміні файлами',()=>{
 const initial=validateCMSBlock({id:'catalog-opt-out',type:'analytics',source:'publications',title:'Каталог',visible:true,dataMode:'manual',dataTable:{headers:['Назва','Квартиль'],rows:[['Стаття','Q1']]},settings:{...defaultBlockSettings('publications'),showAll:false}}),chosen=validateCMSBlock({...initial,settings:{...initial.settings,showAll:false}});
 assert.equal(chosen.settings.showAll,false);assert.deepEqual(validateCMSBlock(chosen),chosen);assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block:chosen}),'block',chosen),chosen);assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(chosen),chosen),chosen);
});
test('рамка фокусу типово вимкнена; старі стилі підтримуються, колір і увімкнення утворюють змінні CSS',()=>{
 const initial=defaultSiteStyles();assert.equal(initial.focusHighlight.enabled,false);const legacy=structuredClone(initial);delete legacy.focusHighlight;assert.deepEqual(validateSiteStyles(legacy).focusHighlight,initial.focusHighlight);
 assert.equal(siteStyleVariables(initial)['--site-focus-width'],'0px');initial.focusHighlight={enabled:true,color:'#d946ef'};assert.equal(siteStyleVariables(initial)['--site-focus-width'],'2px');assert.equal(siteStyleVariables(initial)['--site-focus-color'],'#d946ef');
 for(const focusHighlight of [null,{enabled:'true',color:'#123456'},{enabled:true,color:'red'},{enabled:true,color:'#123456;display:none'}])assert.throws(()=>validateSiteStyles({...initial,focusHighlight}));
});
test('JSON та повна XLSX-книга переносять спільний колір рамки разом зі стилями',async()=>{
 const demo=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url),'utf8'));for(const key of ['publications','projects','patents','revenues'])demo[key]=demo[key].slice(0,1);demo.institution.styles=defaultSiteStyles();demo.institution.styles.focusHighlight={enabled:true,color:'#d946ef'};const data=validateBundle(demo);
 assert.deepEqual(validateBundle(JSON.parse(JSON.stringify(data))),data);assert.deepEqual(await importXLSX(await toXLSX(data,'bundle',ExcelJS),'bundle',data,ExcelJS),data);
});
