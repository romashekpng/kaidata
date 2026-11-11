import {parseCSV} from './data.js?v=catalog-align-20261111';
import {readXLSXWorkbook} from './spreadsheet.js?v=catalog-align-20261111';
import {validateCatalogTable} from './catalog-schema.js?v=catalog-align-20261111';
export function catalogCSVTable(text){const {headers,records}=parseCSV(text,true);return validateCatalogTable({headers,rows:records.map(r=>headers.map(h=>r[h]))});}
export function catalogSheetTable(book,name){
 const sheet=book.getWorksheet(name);if(!sheet)throw new Error('Аркуш не знайдено.');if(sheet.columnCount>80||sheet.rowCount>25001)throw new Error('Каталог: до 80 колонок і 25 000 рядків.');
 const cellText=cell=>{const v=cell.value;if(v==null)return '';if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==='object')throw new Error('Формули та складні клітинки не підтримуються. Вставте звичайні значення.');return String(v);};
 const headers=Array.from({length:sheet.columnCount},(_,i)=>cellText(sheet.getCell(1,i+1))),rows=[];for(let i=2;i<=sheet.rowCount;i++){const row=headers.map((_,j)=>cellText(sheet.getCell(i,j+1)));if(row.some(v=>v.trim()))rows.push(row);}return validateCatalogTable({headers,rows});
}
export async function readCatalogUpload(file,engine=globalThis.ExcelJS){
 if(file.size>5*1024*1024)throw new Error('Таблиця: файл до 5 МБ.');if(/\.csv$/i.test(file.name))return {table:catalogCSVTable(await file.text()),sheets:[],book:null,error:''};
 if(!/\.xlsx$/i.test(file.name))throw new Error('Оберіть CSV або XLSX.');const book=await readXLSXWorkbook(await file.arrayBuffer(),engine),sheets=book.worksheets.map(s=>s.name);let table=null,error='';try{table=catalogSheetTable(book,sheets[0]);}catch(err){error=err.message;}return {table,sheets,book,error};
}
