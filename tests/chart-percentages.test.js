import test from 'node:test';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
import {formatSegmentPercentage,defaultCMSBlock,defaultBlockSettings,validateBlockSettings,validateCMSBlock,selectChartLibrary,rememberChartSettings,chartSettingsForLibrary} from '../src/cms-data.js';
import {chartModel} from '../src/chart-runtime.js';import {renderChartTable} from '../src/block-view.js';
import {readCMSJSON,cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX} from '../src/cms-io.js';
test('частки округлюються до десятих або до цілих; виняток менше 1% перемикається окремо',()=>{
 assert.equal(formatSegmentPercentage(1,3),'33,3%');assert.equal(formatSegmentPercentage(1,3,{segmentPercentageDecimals:0}),'33%');
 assert.equal(formatSegmentPercentage(.4,100,{segmentPercentageDecimals:0,smallPercentagesAsDecimal:true}),'0,4%');assert.equal(formatSegmentPercentage(.4,100,{segmentPercentageDecimals:0,smallPercentagesAsDecimal:false}),'0%');
 assert.equal(formatSegmentPercentage(1.4,100,{segmentPercentageDecimals:0,smallPercentagesAsDecimal:true}),'1%');assert.equal(formatSegmentPercentage(.96,100,{segmentPercentageDecimals:0,smallPercentagesAsDecimal:true}),'1%');
 assert.equal(formatSegmentPercentage(.44,100,{segmentPercentageDecimals:1,smallPercentagesAsDecimal:false}),'0,4%');assert.equal(formatSegmentPercentage(0,100,{segmentPercentageDecimals:0}),'0%');assert.equal(formatSegmentPercentage(0,0),'0%');
});
test('відсотки використовують суму видимих секторів для кожної бібліотеки',()=>{
 const table={headers:['Категорія','Сума'],rows:[['Мала','0.4'],['Велика','32.9'],['Інша','66.7']]};
 for(const library of ['echarts','chartjs','plotly']){
  const settings={...defaultBlockSettings(),chartLibrary:library,chartType:'pie',segmentPercentages:true,segmentPercentageDecimals:0,smallPercentagesAsDecimal:true};
  const all=chartModel({table,settings,hidden:[]}),filtered=chartModel({table,settings,hidden:[2]});assert.equal(formatSegmentPercentage(all.values[0],all.total,all.s),'0,4%');assert.equal(formatSegmentPercentage(filtered.values[0],filtered.total,filtered.s),'1%');
 }
});
test('резервні SVG-діаграми теж показують потрібну точність, включно з частками менше 1%',()=>{
 const table={headers:['Категорія','Сума'],rows:[['Мала','0.4'],['Велика','32.9'],['Інша','66.7']]};
 for(const chartType of ['pie','donut']){
  const block={...defaultCMSBlock('chart'),settings:{...defaultBlockSettings(),chartType,segmentPercentages:true,segmentPercentageDecimals:0,smallPercentagesAsDecimal:true}};
  const html=renderChartTable(block,table);assert.match(html,/>0,4%<\/text>/);assert.match(html,/>33%<\/text>/);assert.match(html,/>67%<\/text>/);
  assert.match(renderChartTable({...block,settings:{...block.settings,smallPercentagesAsDecimal:false}},table),/>0%<\/text>/);
  assert.match(renderChartTable({...block,settings:{...block.settings,segmentPercentageDecimals:1}},table),/>32,9%<\/text>/);
  assert.doesNotMatch(renderChartTable({...block,settings:{...block.settings,segmentPercentages:false}},table),/0,4%/);
 }
});
test('точність зберігається окремо для бібліотек, а некоректні параметри відхиляються',()=>{
 let settings=validateBlockSettings({segmentPercentageDecimals:0,smallPercentagesAsDecimal:true});settings=selectChartLibrary(settings,'chartjs');settings.segmentPercentageDecimals=1;settings.smallPercentagesAsDecimal=false;settings=rememberChartSettings(settings);settings=selectChartLibrary(settings,'echarts');
 assert.equal(settings.segmentPercentageDecimals,0);assert.equal(settings.smallPercentagesAsDecimal,true);assert.equal(chartSettingsForLibrary(settings,'chartjs').segmentPercentageDecimals,1);assert.equal(chartSettingsForLibrary(settings,'chartjs').smallPercentagesAsDecimal,false);
 assert.equal(validateBlockSettings({}).segmentPercentageDecimals,1);
 for(const change of [{segmentPercentageDecimals:2},{segmentPercentageDecimals:'0'},{smallPercentagesAsDecimal:'true'},{librarySettings:{plotly:{segmentPercentageDecimals:-1}}}])assert.throws(()=>validateBlockSettings(change));
});
test('JSON, CSV та XLSX зберігають опції округлення разом із даними блока',async()=>{
 const block=validateCMSBlock({...defaultCMSBlock('chart'),settings:{...defaultBlockSettings(),chartType:'donut',segmentPercentages:true,segmentPercentageDecimals:0,smallPercentagesAsDecimal:true}});
 assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block}),'block',block),block);assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(block),block),block);assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(block,ExcelJS),block,ExcelJS),block);
});
