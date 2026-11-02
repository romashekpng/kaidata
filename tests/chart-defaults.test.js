import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import ExcelJS from'exceljs';
import{defaultBlockSettings,defaultCMSBlock,validateCMSBlock,expandSiteBlocks,chartSettingsForLibrary}from'../src/cms-data.js';import{readCMSJSON,cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX}from'../src/cms-io.js';
const site=JSON.parse(await readFile(new URL('../data/pages.json',import.meta.url),'utf8'));
const block=source=>({id:'defaults-'+source,type:'analytics',source,title:'Моя діаграма',visible:true,dataMode:'live',settings:{...defaultBlockSettings(source),legend:'top',legendCentered:false,chartType:source==='quartiles'?'donut':'stacked',segmentPercentages:false}});
test('обидві діаграми публікацій типово мають нижню центровану легенду, квартилі — відсотки до десятих, програми — горизонтальні стовпці',()=>{
 for(const source of['publicationChart','quartiles']){const settings=defaultBlockSettings(source);assert.equal(settings.legend,'bottom');assert.equal(settings.legendCentered,true);}
 assert.equal(defaultBlockSettings('quartiles').segmentPercentages,true);assert.equal(defaultBlockSettings('quartiles').segmentPercentageDecimals,1);assert.equal(defaultBlockSettings('programs').chartType,'horizontal');assert.equal(defaultBlockSettings('faculties').legend,'none');
 const expanded=expandSiteBlocks(site);for(const b of expanded.pages.flatMap(p=>p.blocks)){if(['publicationChart','quartiles'].includes(b.source)){assert.equal(b.settings.legend,'bottom');assert.equal(b.settings.legendCentered,true);}if(b.source==='programs'){assert.equal(b.settings.chartType,'horizontal');assert.equal(b.subtitle,'Надходження коштів, тис. грн');}}
});
test('старі початкові параметри оновлюються для активного й збережених профілів без зміни даних, кольорів і ширини',()=>{
 for(const source of['publicationChart','quartiles','programs']){const old=block(source);old.settings.width=66;old.settings.palette='purple';old.settings.librarySettings={echarts:{legend:'top',legendCentered:false,chartType:old.settings.chartType,segmentPercentages:false},chartjs:{legend:'right',legendCentered:false,chartType:'line',segmentPercentages:false}};const copy=structuredClone(old),next=validateCMSBlock(old);assert.equal(next.chartDefaultsVersion,1);assert.equal(next.settings.width,66);assert.equal(next.settings.palette,'purple');assert.equal(next.title,old.title);assert.deepEqual(old,copy);
  const alternate=chartSettingsForLibrary(next.settings,'chartjs',source);assert.equal(alternate.legend,'right');assert.equal(alternate.chartType,'line');
  if(source==='programs'){assert.equal(next.settings.chartType,'horizontal');assert.equal(next.subtitle,'Надходження коштів, тис. грн');}else{assert.equal(next.settings.legend,'bottom');assert.equal(next.settings.legendCentered,true);}
  if(source==='quartiles')assert.equal(next.settings.segmentPercentages,true);assert.deepEqual(validateCMSBlock(next),next);
 }
});
test('подальші ручні зміни та власний або порожній підзаголовок зберігаються',()=>{
 const migrated=validateCMSBlock(block('quartiles')),chosen=validateCMSBlock({...migrated,settings:{...migrated.settings,legend:'top',legendCentered:false,segmentPercentages:false,segmentPercentageDecimals:0}});assert.equal(chosen.settings.legend,'top');assert.equal(chosen.settings.segmentPercentages,false);assert.equal(chosen.settings.segmentPercentageDecimals,0);assert.deepEqual(validateCMSBlock(chosen),chosen);
 for(const subtitle of['Власний підзаголовок',''])assert.equal(validateCMSBlock({...block('programs'),subtitle}).subtitle,subtitle);
 const fresh={...defaultCMSBlock('analytics'),source:'programs',settings:{...defaultBlockSettings('programs'),chartType:'line'}};assert.equal(validateCMSBlock(fresh).settings.chartType,'line');
});
test('версія типових параметрів і вибір користувача переносяться разом із JSON, CSV та XLSX блока',async()=>{
 const b=validateCMSBlock({...block('programs'),dataMode:'manual',dataTable:{headers:['Програма','Надходження, тис. грн'],rows:[['Horizon','1130']]}});assert.equal(b.settings.chartType,'horizontal');
 assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block:b}),'block',b),b);assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(b),b),b);assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(b,ExcelJS),b,ExcelJS),b);
});
