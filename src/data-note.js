import { validateNoteBinding, blockTableData, NOTE_SOURCES } from './cms-data.js?v=text-note-links-20261108';
const noteNumber=value=>{const s=String(value??'').trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');return s&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)&&Number.isFinite(Number(s))?Number(s):null;};
export function notePeriod(binding,year){
 const text=binding.periodMode==='fixed'?binding.period:String(year),parts=text.split('-').map(Number),first=parts[0],last=parts[1]??first;
 return {years:Array.from({length:last-first+1},(_,i)=>first+i),text:first===last?String(first):`${first}–${last}`,label:first===last?`у ${first} році`:`за ${first}–${last} роки`};
}
export function noteTableSource(note,{getBlock,getTable}){
 const b=note.binding;
 if(b.kind==='builtin')return {name:NOTE_SOURCES[b.source],live:true,table:(year,all=false)=>getTable(b.source,all,year)};
 if(b.kind==='manual')return {name:'Власне значення',live:false,table:()=>({headers:[],rows:[]})};
 const source=getBlock(b.blockId);if(!source)throw new Error('Блок-джерело не знайдено. Оберіть іншу таблицю або діаграму.');
 if(source.type==='analytics'&&Object.hasOwn(NOTE_SOURCES,source.source))return {name:source.title||NOTE_SOURCES[source.source],live:source.dataMode!=='manual',table:(year,all=false)=>source.dataMode==='manual'?source.dataTable:getTable(source.source,all,year)};
 if(!['table','chart'].includes(source.type))throw new Error('Джерелом може бути таблиця, діаграма або аналітична таблиця.');
 return {name:source.title||'Таблиця',live:false,table:()=>blockTableData(source)};
}
function noteYearColumn(table){let index=table.headers.findIndex(h=>/^(рік|year|дата|date)$/iu.test(h.trim()));if(index<0&&table.rows.length&&table.rows.every(r=>/^\d{4}$/.test(String(r[0]))))index=0;return index;}
export function resolveDataNote(note,context){
 try{
  const binding=validateNoteBinding(note.binding),period=notePeriod(binding,context.year),source=noteTableSource({...note,binding},context);
  let number=null,value='',hasValue=false;
  if(binding.kind==='manual'){value=binding.manualValue;hasValue=!!value;number=noteNumber(value);}
  else{
   const numbers=[],cells=[],names=[];let rowCount=0;
   for(const year of period.years){
    const table=source.table(year),yearColumn=noteYearColumn(table),wide=table.headers.some(h=>/^\d{4}$/.test(h));
    let rows=table.rows.filter(row=>(yearColumn<0||Number(String(row[yearColumn]).slice(0,4))===year)&&(!binding.row||String(row[0]).trim()===binding.row));
    const unitColumn=table.headers.indexOf('unit');if(unitColumn>=0&&!binding.row&&!['count','distinct'].includes(binding.operation)&&new Set(rows.map(row=>row[unitColumn])).size>1)throw new Error('Показники мають різні одиниці виміру. Виберіть рядок конкретної картки.');
    const allColumns=binding.column==='*';let column=binding.column&&!allColumns?table.headers.indexOf(binding.column):-1;
    if(binding.column&&!allColumns&&column<0)throw new Error(`Колонку «${binding.column}» не знайдено у джерелі.`);
    if(wide){if(!binding.column||allColumns)column=table.headers.indexOf(String(year));else if(/^\d{4}$/.test(binding.column)&&Number(binding.column)!==year)rows=[];}
    if(!binding.column&&!wide)column=table.headers.findIndex((h,i)=>i>0&&i!==yearColumn&&!/^(рік|year|дата|date)$/iu.test(h)&&rows.some(row=>noteNumber(row[i])!==null));
    if(!binding.column&&!wide&&column<0)column=table.headers.findIndex((h,i)=>i>0&&i!==yearColumn&&!/^(рік|year|дата|date)$/iu.test(h));
    if(wide&&column<0)rows=[];
    if(column<0&&binding.operation==='value'&&!wide)column=0;
    if(!allColumns&&!['count','distinct'].includes(binding.operation)&&column<0&&!wide)throw new Error('У джерелі немає числової колонки. Виберіть колонку вручну.');
    for(const row of rows){rowCount++;names.push(String(row[0]));const indexes=allColumns&&!wide?table.headers.map((_,i)=>i).filter(i=>i>0&&i!==yearColumn):column>=0?[column]:[];for(const i of indexes){cells.push(String(row[i]??''));const n=noteNumber(row[i]);if(n!==null)numbers.push(n);}}
    if(!source.live&&yearColumn<0&&!wide)break;
   }
   if(binding.operation==='count')number=rowCount;
   else if(binding.operation==='distinct')number=new Set(names).size;
   else if(binding.operation==='value'){if(cells.length>1)throw new Error('Для одного значення виберіть конкретний рядок і один рік; для періоду використайте суму або середнє.');value=cells[0]||'';number=noteNumber(value);hasValue=!!value;}
   else if(numbers.length)number=binding.operation==='avg'?numbers.reduce((a,b)=>a+b,0)/numbers.length:binding.operation==='min'?numbers.reduce((a,b)=>Math.min(a,b)):binding.operation==='max'?numbers.reduce((a,b)=>Math.max(a,b)):numbers.reduce((a,b)=>a+b,0);
   if(number!==null)hasValue=true;
  }
  if(number!==null)value=new Intl.NumberFormat('uk-UA',{maximumFractionDigits:binding.decimals}).format(number);
  const tokens={value:hasValue?value:note.emptyText,period:period.text,periodLabel:period.label,unit:hasValue?binding.unit:'',source:source.name};
  const fill=text=>text.replace(/\{(value|period|periodLabel|unit|source)\}/g,(_,key)=>tokens[key]).replace(/[ \t]+([.,;:!?])/g,'$1');
  return {lead:fill(note.lead),text:fill(note.text),period:period.text,number,hasValue,error:''};
 }catch(error){return {lead:'',text:error.message,period:'',number:null,hasValue:false,error:error.message};}
}
