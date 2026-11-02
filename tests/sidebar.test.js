import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import ExcelJS from 'exceljs';
import {SIDEBAR_DEFAULTS,validateBundle,importCSV} from '../src/data.js';import {sidebarTextSections} from '../src/sidebar-view.js';import {toXLSX,importXLSX} from '../src/spreadsheet.js';
const demo=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url),'utf8'));
const small=()=>{const data=structuredClone(demo);for(const key of ['publications','projects','patents','revenues'])data[key]=data[key].slice(0,1);return validateBundle(data);};
const configured=()=>{const data=small();Object.assign(data.institution,{sidebarStatus:'Наші відкриті дані',sidebarTagline:'Дослідження\nдля майбутнього',showSidebarStatus:false,showSidebarTagline:true,showSidebarName:false,showSidebarSubtitle:true});return data;};
test('старі JSON отримують попередні тексти й видимість; нові налаштування не губляться при частковому імпорті',()=>{
 const legacy=small();for(const key of Object.keys(SIDEBAR_DEFAULTS))delete legacy.institution[key];const restored=validateBundle(legacy);for(const [key,value]of Object.entries(SIDEBAR_DEFAULTS))assert.equal(restored.institution[key],value);
 const data=configured();assert.deepEqual(validateBundle(JSON.parse(JSON.stringify(data))),data);assert.deepEqual(importCSV('year;source;amountThousandUAH\n2026;Джерело;10','revenues',data).institution,data.institution);
});
test('прапорці повинні бути boolean, тексти можуть бути порожніми; некоректні типи й надмірна довжина відхиляються',()=>{
 for(const change of [{showSidebarStatus:'false'},{showSidebarSubtitle:0},{sidebarStatus:null},{sidebarTagline:[]},{sidebarStatus:'a'.repeat(241)},{sidebarTagline:'a'.repeat(1001)}])assert.throws(()=>validateBundle({...demo,institution:{...demo.institution,...change}}));
 const data=validateBundle({...demo,institution:{...demo.institution,sidebarStatus:'',sidebarTagline:'',subtitle:''}});assert.equal(sidebarTextSections(data.institution).note,'');assert(!sidebarTextSections(data.institution).details.includes('Платформа наукової аналітики'));
});
test('кожен текст ховається незалежно; без усіх текстів немає порожніх контейнерів',()=>{
 const i={...small().institution,sidebarStatus:'Статус',sidebarTagline:'Слоган',name:'Заклад',subtitle:'Підзаголовок'};
 let rendered=sidebarTextSections(i);assert.match(rendered.note,/Статус/);assert.match(rendered.note,/Слоган/);assert.match(rendered.details,/Заклад/);assert.match(rendered.details,/Підзаголовок/);
 assert(!sidebarTextSections({...i,showSidebarStatus:false}).note.includes('live-dot'));assert(sidebarTextSections({...i,showSidebarStatus:false}).note.includes('Слоган'));
 assert(!sidebarTextSections({...i,showSidebarTagline:false}).note.includes('Слоган'));assert(!sidebarTextSections({...i,showSidebarName:false}).details.includes('<a '));assert(sidebarTextSections({...i,showSidebarName:false}).details.includes('Підзаголовок'));
 assert.deepEqual(sidebarTextSections({...i,showSidebarStatus:false,showSidebarTagline:false,showSidebarName:false,showSidebarSubtitle:false}),{note:'',details:''});assert.equal(i.sidebarStatus,'Статус');
});
test('текст виводиться без HTML, перенесення зберігаються, посилання дозволяє лише безпечні адреси',()=>{
 const i={...small().institution,name:'<img src=x>',sidebarStatus:'<script>alert(1)</script>',sidebarTagline:'Рядок 1\nРядок 2',website:'javascript:alert(1)'};const result=sidebarTextSections(i);assert(!result.note.includes('<script>'));assert(!result.details.includes('<img'));assert(!result.details.includes('javascript:'));assert.match(result.note,/Рядок 1<br>Рядок 2/);
 assert.match(sidebarTextSections({...i,website:'https://example.org'}).details,/href="https:\/\/example.org\/"/);
});
test('XLSX зберігає тексти, перенесення та справжні boolean у видимих рядках аркуша Університет',async()=>{
 const data=configured(),bytes=await toXLSX(data,'bundle',ExcelJS),book=new ExcelJS.Workbook();await book.xlsx.load(bytes);const entries=new Map();book.getWorksheet('Університет').eachRow((row,n)=>{if(n>1)entries.set(row.getCell(1).value,row.getCell(2).value);});
 for(const key of Object.keys(SIDEBAR_DEFAULTS))assert.equal(entries.get('institution.'+key),data.institution[key]);assert.equal(typeof entries.get('institution.showSidebarName'),'boolean');assert.deepEqual(await importXLSX(bytes,'bundle',demo,ExcelJS),data);
});
test('старі книги без нових рядків підтримуються; помилки прапорців і дублікати ключів відхиляються',async()=>{
 const data=configured(),book=new ExcelJS.Workbook();await book.xlsx.load(await toXLSX(data,'bundle',ExcelJS));const sheet=book.getWorksheet('Університет');for(let n=sheet.rowCount;n>1;n--)if(Object.keys(SIDEBAR_DEFAULTS).some(key=>sheet.getCell(n,1).value==='institution.'+key))sheet.spliceRows(n,1);
 const legacy=await importXLSX(await book.xlsx.writeBuffer(),'bundle',demo,ExcelJS);for(const [key,value]of Object.entries(SIDEBAR_DEFAULTS))assert.equal(legacy.institution[key],value);assert.equal(legacy.institution.name,data.institution.name);
 await book.xlsx.load(await toXLSX(data,'bundle',ExcelJS));const current=book.getWorksheet('Університет');let flagRow;current.eachRow(row=>{if(row.getCell(1).value==='institution.showSidebarStatus')flagRow=row;});flagRow.getCell(2).value='yes';await assert.rejects(async()=>importXLSX(await book.xlsx.writeBuffer(),'bundle',demo,ExcelJS),/showSidebarStatus/);
 flagRow.getCell(2).value=true;let textRow;current.eachRow(row=>{if(row.getCell(1).value==='institution.sidebarTagline')textRow=row;});textRow.getCell(1).value='institution.sidebarStatus';await assert.rejects(async()=>importXLSX(await book.xlsx.writeBuffer(),'bundle',demo,ExcelJS),/повторюваний/);
});
