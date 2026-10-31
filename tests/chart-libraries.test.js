import test from 'node:test';import assert from 'node:assert/strict';
import {defaultCMSBlock,defaultBlockSettings,validateBlockSettings,validateCMSBlock,selectChartLibrary,rememberChartSettings,chartSettingsForLibrary} from '../src/cms-data.js';
import {readCMSJSON,cmsBlockXLSX,importCMSBlockXLSX} from '../src/cms-io.js';import ExcelJS from 'exceljs';
import {chartModel,wrapChartLabel} from '../src/chart-runtime.js';
test('старі діаграми починають з ECharts, а профілі трьох бібліотек перемикаються незалежно',()=>{
 let settings=validateBlockSettings({palette:'purple',height:420});assert.equal(settings.chartLibrary,'echarts');
 settings=selectChartLibrary(settings,'chartjs');settings.height=260;settings.legend='bottom';settings=rememberChartSettings(settings);
 settings=selectChartLibrary(settings,'plotly');settings.height=510;settings.customColors=['#123456'];settings.palette='custom';settings=rememberChartSettings(settings);
 settings=selectChartLibrary(settings,'echarts');assert.equal(settings.height,420);assert.equal(settings.palette,'purple');
 settings=selectChartLibrary(settings,'chartjs');assert.equal(settings.height,260);assert.equal(settings.legend,'bottom');
 settings=validateBlockSettings(settings);assert.equal(chartSettingsForLibrary(settings,'plotly').height,510);assert.deepEqual(chartSettingsForLibrary(settings,'plotly').customColors,['#123456']);
 const clone=chartSettingsForLibrary(settings,'plotly');clone.customColors.push('#654321');assert.equal(settings.librarySettings.plotly.customColors.length,1);
});
test('схема відхиляє невідому бібліотеку, вкладені та некоректні неактивні профілі',()=>{
 for(const settings of [{chartLibrary:'unknown'},{librarySettings:[]},{librarySettings:{unknown:{}}},{librarySettings:{chartjs:{height:900}}},{librarySettings:{chartjs:{librarySettings:{}}}},{librarySettings:{plotly:{segmentValues:'yes'}}}])assert.throws(()=>validateBlockSettings(settings));
 const b=defaultCMSBlock('chart');b.rows=[['A','-1','2']];b.settings.librarySettings={plotly:{chartType:'pie'}};assert.throws(()=>validateCMSBlock(b));
});
test('JSON та XLSX блоків зберігають активну бібліотеку та всі її профілі',async()=>{
 const b=defaultCMSBlock('chart');b.settings=selectChartLibrary(b.settings,'plotly');b.settings.segmentPercentages=true;b.settings=rememberChartSettings(b.settings);
 const valid=validateCMSBlock(b);assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block:valid}),'block',b),valid);assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(b,ExcelJS),b,ExcelJS),valid);
});
test('спільна модель бібліотек зберігає нулі, пропуски, знаки й підсумовує лише видимі серії або сектори',()=>{
 const table={headers:['Назва','A','B'],rows:[['Перший','0','5'],['Другий','-2',''],['Третій','10,5','2']]};
 const model=chartModel({table,settings:{...defaultBlockSettings(),chartType:'horizontalStacked'},hidden:[1]});assert.equal(model.horizontal,true);assert.deepEqual(model.totals,[0,-2,10.5]);assert.deepEqual(model.series[0].values,[0,-2,10.5]);
 const pie=chartModel({table:{...table,rows:[['A','10','5'],['B','20','5']]},settings:{chartType:'donut'},hidden:[0]});assert.equal(pie.total,25);assert.deepEqual(pie.values,[15,25]);
 assert.deepEqual(wrapChartLabel('Факультет транспорту та інженерії',20),['Факультет транспорту','та інженерії']);assert(wrapChartLabel('А'.repeat(80),20).every(line=>line.length<=20));
});
