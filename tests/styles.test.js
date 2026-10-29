import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {defaultSiteStyles,validateSiteStyles,siteStyleVariables} from '../src/style-data.js';
import {validateBundle,importCSV,toCSV} from '../src/data.js';
import {toXLSX,importXLSX,SHEET_NAMES} from '../src/spreadsheet.js';
const demo=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url),'utf8'));
const configured=()=>{const data=validateBundle(demo);data.institution.styles=defaultSiteStyles();data.institution.styles.presets.push({id:'my-style',name:'Власний',values:{...data.institution.styles.presets[1].values,bodySize:17,blockGap:32}});data.institution.styles.defaultPreset='my-style';return data;};
test('стилі зберігають власні пресети, типовий вибір та налаштування під час JSON і часткового CSV імпорту',()=>{
 const data=configured();assert.deepEqual(validateBundle(JSON.parse(JSON.stringify(data))),data);
 const updated=importCSV(toCSV(data,'revenues'),'revenues',data);assert.deepEqual(updated.institution.styles,data.institution.styles);
 assert.equal(siteStyleVariables(data.institution.styles)['--site-body-size'],'17px');
 assert.equal(siteStyleVariables(data.institution.styles)['--site-line-height'],'1.25');
 assert.equal(validateBundle(demo).institution.styles,undefined);
});
test('стилі відхиляють відсутній типовий пресет, повтори ID, порожні назви, надмірні розміри та CSS замість чисел',()=>{
 const invalid=[];let s=defaultSiteStyles();s.defaultPreset='missing';invalid.push(s);
 s=defaultSiteStyles();s.presets[1].id=s.presets[0].id;invalid.push(s);
 s=defaultSiteStyles();s.presets[0].name=' ';invalid.push(s);
 for(const value of [0,1000,NaN,Infinity,'16px;display:none']){s=defaultSiteStyles();s.presets[0].values.bodySize=value;invalid.push(s);}
 s=defaultSiteStyles();s.presets=Array.from({length:21},(_,i)=>({...s.presets[0],id:'s'+i}));invalid.push(s);
 for(const styles of invalid)assert.throws(()=>validateBundle({...demo,institution:{...demo.institution,styles}}));
 assert.equal(validateSiteStyles(defaultSiteStyles()).defaultPreset,'standard');
});
test('повна XLSX-книга переносить стилі, старі книги без стилів підтримуються, некоректний JSON стилів відхиляється',async()=>{
 const data=configured();for(const key of ['publications','projects','patents','revenues'])data[key]=data[key].slice(0,1);
 const bytes=await toXLSX(data,'bundle',ExcelJS);assert.deepEqual(await importXLSX(bytes,'bundle',demo,ExcelJS),data);
 const legacy={...data,institution:{...data.institution}};delete legacy.institution.styles;
 assert.deepEqual(await importXLSX(await toXLSX(legacy,'bundle',ExcelJS),'bundle',demo,ExcelJS),legacy);
 const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);const sheet=book.getWorksheet(SHEET_NAMES.settings);sheet.getCell(sheet.rowCount,2).value='{bad json';
 const bad=await book.xlsx.writeBuffer();await assert.rejects(()=>importXLSX(bad,'bundle',demo,ExcelJS),/JSON стилів/);
});
