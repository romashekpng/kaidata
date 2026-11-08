import test from 'node:test';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
import {defaultCMSBlock,validateCMSBlock} from '../src/cms-data.js';
import {renderTextBlock,renderDataNote} from '../src/block-view.js';
import {resolveDataNote} from '../src/data-note.js';
import {readCMSJSON,cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX,tableToCMSBlock} from '../src/cms-io.js';
const block=(type,extra={})=>validateCMSBlock({...defaultCMSBlock(type),text:'Перше речення.\n\nДізнайтеся більше:',linkLabel:'Дослідити публікації',linkUrl:'#publications',...extra});
const context={year:2026,getBlock:()=>null,getTable:()=>({headers:['Рік','Значення'],rows:[['2026','12'],['2025','7']]})};
test('old text and data notes remain valid with no link and new blocks have empty link defaults',()=>{
 for(const type of ['text','dataNote']){const legacy=defaultCMSBlock(type);for(const key of ['linkLabel','linkUrl','linkPlacement','openInNewTab'])delete legacy[key];const current=validateCMSBlock(legacy);assert.equal(current.linkUrl,'');assert.equal(current.linkPlacement,'inline');assert.equal(current.openInNewTab,false);assert.deepEqual(validateCMSBlock(current),current);const html=type==='text'?renderTextBlock(current):renderDataNote(current,resolveDataNote(current,context));assert(!html.includes('cms-block-link'));}
});
test('text links join the last paragraph or render as a separate paragraph without altering line breaks',()=>{
 const inline=renderTextBlock(block('text'));assert.match(inline,/Дізнайтеся більше: <a class="cms-block-link" href="#publications">/);assert.equal((inline.match(/<p>/g)||[]).length,2);
 const separate=renderTextBlock(block('text',{linkPlacement:'line'}));assert.match(separate,/Дізнайтеся більше:<\/p><p><a/);assert.equal((separate.match(/<p>/g)||[]).length,3);
 assert.match(renderTextBlock(block('text',{text:'Один\nдва'})),/Один<br>два <a/);
 assert.match(renderTextBlock(block('text',{text:''})),/<p><a/);assert(!renderTextBlock(block('text',{linkUrl:''})).includes('cms-block-link'));
});
test('data note links preserve calculation and period substitutions in both placements',()=>{
 const n=block('dataNote',{lead:'За {period}:',text:'Разом {value}.',binding:{...defaultCMSBlock('dataNote').binding,source:'publicationChart',unit:''}}),result=resolveDataNote(n,context);
 assert.equal(result.number,12);assert.equal(result.text,'Разом 12.');assert.equal(result.lead,'За 2026:');
 assert.match(renderDataNote(n,result),/<span>Разом 12\.<\/span> <a class="cms-block-link"/);
 assert.match(renderDataNote({...n,linkPlacement:'line'},result),/<span>Разом 12\.<\/span><span class="cms-block-link-row"><a/);
 assert.equal(resolveDataNote({...n,linkPlacement:'line'},context).number,12);
});
test('link addresses and labels are escaped, unsafe URLs rejected, and new tabs use noopener',()=>{
 for(const type of ['text','dataNote']){
  const n=block(type,{linkLabel:'<img src=x>',linkUrl:'https://example.org/?a=1&b=2',openInNewTab:true}),html=type==='text'?renderTextBlock(n):renderDataNote(n,{text:'Результат',lead:''});
  assert.match(html,/href="https:\/\/example.org\/\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"/);assert.match(html,/&lt;img src=x&gt;/);assert(!html.includes('<img'));
  for(const linkUrl of ['javascript:alert(1)','data:text/html,x','https://user:secret@example.org','//example.org'])assert.throws(()=>block(type,{linkUrl}));
  assert.throws(()=>block(type,{linkLabel:''}));assert.throws(()=>block(type,{linkPlacement:'floating'}));assert.throws(()=>block(type,{openInNewTab:'true'}));
  assert.equal(block(type,{linkUrl:'#page/details'}).linkUrl,'#page/details');
 }
});
test('text and note links round-trip through JSON, CSV and XLSX including new-tab booleans',async()=>{
 for(const type of ['text','dataNote'])for(const openInNewTab of [false,true]){const n=block(type,{openInNewTab,linkPlacement:'line'});assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block:n}),'block',n),n);assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(n),n),n);assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(n,ExcelJS),n,ExcelJS),n);}
});
test('legacy content tables without link columns preserve existing links when reimported',()=>{
 for(const type of ['text','dataNote']){const n=block(type,{openInNewTab:true}),headers=type==='text'?['title','text']:['title','lead','text','emptyText','icon'],rows=[headers.map(h=>n[h])],restored=tableToCMSBlock({headers,rows},n);assert.deepEqual(restored,n);assert.throws(()=>tableToCMSBlock({headers:[...headers,'openInNewTab'],rows:[[...rows[0],'yes']]},n),/openInNewTab/);}
});
