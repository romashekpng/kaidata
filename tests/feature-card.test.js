import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {defaultCMSBlock,defaultBlockSettings,validateCMSBlock,expandSiteBlocks,validateFeatureStyle} from '../src/cms-data.js';
import {renderFeatureCard} from '../src/block-view.js';
import {readCMSJSON,cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX,tableToCMSBlock,blockTable} from '../src/cms-io.js';
test('reusable feature template reproduces the open-science content and keeps optional elements independent',()=>{
 const block=validateCMSBlock(defaultCMSBlock('feature')),html=renderFeatureCard(block);assert.equal(block.title,'Відкрита наука');assert.equal(block.settings.width,34);assert.match(html,/ВІДКРИТА НАУКА/);assert.match(html,/Знання мають бути доступними/);assert.match(html,/href="#publications"/);assert.match(html,/--feature-minHeight:290px/);assert.doesNotMatch(html,/target="_blank"/);
 const empty=renderFeatureCard({...block,eyebrow:'',icon:'none',headline:'',text:'',linkUrl:''});for(const cls of['cms-feature-eyebrow','cms-feature-headline','cms-feature-description','cms-feature-link'])assert(!empty.includes(cls));
 const external=renderFeatureCard({...block,linkUrl:'https://kai.edu.ua',openInNewTab:true,appearance:{...block.appearance,background:'custom',backgroundColor:'#112233',align:'center'}});assert.match(external,/rel="noopener noreferrer"/);assert.match(external,/data-align="center"/);assert.match(external,/--text-block-bg:#112233/);
});
test('legacy open-science cards retain IDs, custom titles, widths, visibility and manual text without replacing unrelated blocks',async()=>{
 const old={id:'saved-insight',type:'analytics',source:'insight',title:'Мій заголовок',visible:false,settings:{...defaultBlockSettings(),width:34}},copy=structuredClone(old),next=validateCMSBlock(old);assert.equal(next.type,'feature');assert.equal(next.id,old.id);assert.equal(next.title,old.title);assert.equal(next.settings.width,34);assert.equal(next.visible,false);assert.deepEqual(old,copy);assert.deepEqual(validateCMSBlock(next),next);
 const manual=validateCMSBlock({...old,dataMode:'manual',dataTable:{headers:['Текст'],rows:[['Перший абзац'],['Другий абзац']]}});assert.equal(manual.text,'Перший абзац\nДругий абзац');assert.equal(manual.headline,'');assert.equal(manual.linkUrl,'');
 const pages=expandSiteBlocks(JSON.parse(await readFile(new URL('../data/pages.json',import.meta.url),'utf8')));assert.equal(pages.pages[0].blocks.filter(b=>b.type==='feature').length,1);assert(!pages.pages.flatMap(p=>p.blocks).some(b=>b.source==='insight'));assert.deepEqual(expandSiteBlocks(pages),pages);
});
test('feature card content and styles survive JSON and tabular data transfers',async()=>{
 const block=validateCMSBlock({...defaultCMSBlock('feature'),headline:'Власний\nзаголовок',text:'Один\nдва',openInNewTab:true,appearance:{...validateFeatureStyle(),headingSize:27,padding:32}});
 assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block}),'block',block),block);assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(block),block),block);assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(block,ExcelJS),block,ExcelJS),block);
 const table=blockTable(block);table.rows[0][table.headers.indexOf('text')]='Новий текст';const changed=tableToCMSBlock(table,block);assert.equal(changed.text,'Новий текст');assert.deepEqual(changed.appearance,block.appearance);assert.deepEqual(changed.settings,block.settings);
 table.rows[0][table.headers.indexOf('openInNewTab')]='yes';assert.throws(()=>tableToCMSBlock(table,block),/true або false/);
});
test('feature templates reject unsafe URLs, injected styles, unknown icons and invalid dimensions; HTML remains text',()=>{
 const block=defaultCMSBlock('feature');for(const linkUrl of['javascript:alert(1)','data:text/html,bad','//evil.test','https://user:password@evil.test'])assert.throws(()=>validateCMSBlock({...block,linkUrl}));
 for(const appearance of[{padding:-1},{headingSize:200},{align:'absolute'},{background:'bad'},{headingColor:'red;display:none'}])assert.throws(()=>validateCMSBlock({...block,appearance}));
 assert.throws(()=>validateCMSBlock({...block,icon:'injected'}));assert.throws(()=>validateCMSBlock({...block,openInNewTab:'true'}));assert.throws(()=>validateCMSBlock({...block,linkLabel:''}));
 const html=renderFeatureCard({...block,headline:'<img src=x onerror=alert(1)>',text:'<script>evil()</script>',linkLabel:'<b>Посилання</b>'});assert(!html.includes('<img'));assert(!html.includes('<script>'));assert(html.includes('&lt;img'));assert(html.includes('&lt;b&gt;'));
});
