import test from 'node:test';import assert from 'node:assert/strict';
import {chartModel,chartTooltipText} from '../src/chart-runtime.js';
import {renderChartTable} from '../src/block-view.js';import {defaultCMSBlock,defaultBlockSettings} from '../src/cms-data.js';
const table={headers:['Тип','Conference paper','Article','Book chapter','Book'],rows:[['Article','','108','',''],['Book','','','','0'],['Conference paper','84','','','']]};
test('library tooltips include only numeric series for the current category, preserving real zero and totals',()=>{
 for(const chartLibrary of ['echarts','chartjs','plotly']){const m=chartModel({table,settings:{...defaultBlockSettings(),chartLibrary,tooltipTotal:true}});assert.equal(chartTooltipText(m,0),'Article\nArticle: 108\nРазом: 108');assert.equal(chartTooltipText(m,1),'Book\nBook: 0\nРазом: 0');assert.doesNotMatch(chartTooltipText(m,2),/Article:|Book:|немає даних/);}
 const hidden=chartModel({table,settings:defaultBlockSettings(),hidden:[1]});assert.doesNotMatch(chartTooltipText(hidden,0),/Article:/);
});
test('fallback chart tooltips omit missing series across vertical, line, horizontal and progress charts',()=>{
 for(const chartType of ['bar','stacked','line','horizontal','horizontalStacked','progress']){const block=defaultCMSBlock('chart');block.settings={...block.settings,chartType};const html=renderChartTable(block,table);assert(!html.includes('немає даних'));const tips=[...html.matchAll(/(?:<title>|title=")([^<"]*)/g)].map(m=>m[1]);assert(tips.some(t=>t.includes('Article: 108')));assert(tips.filter(t=>t.includes('Article: 108')).every(t=>!t.includes('Book:')&&!t.includes('Conference paper:')));}
});
