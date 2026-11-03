import test from 'node:test';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
import{defaultCMSBlock,defaultBlockSettings,validateBlockSettings,validateCMSBlock,blockWidthLabel,selectChartLibrary}from'../src/cms-data.js';import{readCMSJSON,cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX}from'../src/cms-io.js';import{createSiteView}from'../src/site-view.js';
test('block width modes preserve legacy percentages and independently retain pixel and automatic choices',()=>{
 const legacy=validateBlockSettings({width:37.5});assert.equal(legacy.widthMode,'percent');assert.equal(legacy.width,37.5);assert.equal(legacy.widthPixels,250);assert.equal(blockWidthLabel(legacy),'37.5%');
 const fixed=validateBlockSettings({...legacy,widthMode:'fixed',widthPixels:250});assert.equal(blockWidthLabel(fixed),'250 px');const auto=validateBlockSettings({...fixed,widthMode:'auto'});assert.equal(blockWidthLabel(auto),'Авто');assert.equal(auto.width,37.5);assert.equal(auto.widthPixels,250);assert.equal(selectChartLibrary(auto,'chartjs').widthMode,'auto');
 for(const change of[{widthMode:'other'},{widthMode:3},{widthPixels:0},{widthPixels:79},{widthPixels:4001},{widthPixels:250.5},{widthPixels:'250'}])assert.throws(()=>validateBlockSettings(change));
 for(const widthPixels of[80,4000])assert.equal(validateBlockSettings({widthMode:'fixed',widthPixels}).widthPixels,widthPixels);
});
test('JSON and data transfers retain fixed and automatic width settings without changing chart data',async()=>{
 for(const widthMode of['fixed','auto']){const block=validateCMSBlock({...defaultCMSBlock('chart'),settings:{...defaultBlockSettings(),width:50,widthMode,widthPixels:250}});assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block}),'block',block),block);assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(block),block),block);assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(block,ExcelJS),block,ExcelJS),block);assert.equal(selectChartLibrary(block.settings,'plotly').widthPixels,250);}
});
test('mixed rows group adjacent fixed and automatic blocks, respect hidden blocks and leave percentage rows independent',()=>{
 const make=(id,widthMode,visible=true)=>validateCMSBlock({...defaultCMSBlock('text'),id,visible,settings:{...defaultBlockSettings(),widthMode,width:50,widthPixels:250}});
 const view=createSiteView({getData:()=>({institution:{blocks:['publications','projects','patents','funding']}}),getBlockPeriod:()=>''});
 const html=view.renderBlocks({blocks:[make('before','percent'),make('left','auto'),make('hidden','percent',false),make('right','fixed'),make('after','percent'),make('fixed-alone','fixed')]});assert.equal((html.match(/class="cms-mixed-width-row"/g)||[]).length,2);assert(!html.includes('data-widget-id="hidden"'));assert(html.includes('data-widget-id="left" data-width-mode="auto"'));assert(html.includes('--widget-fixed-width:250px'));assert(html.indexOf('data-widget-id="right"')<html.indexOf('data-widget-id="after"'));
 const legacy=view.renderBlocks({blocks:[make('old-left','percent'),make('old-right','percent')]});assert(!legacy.includes('cms-mixed-width-row'));assert(legacy.includes('--widget-basis:calc(50%'));
});
