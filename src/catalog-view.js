import {validateCatalogTable,validateCatalogBinding,catalogPageSizes} from './catalog-schema.js?v=chart-series-20261110';
import {validateChartBinding,blockTableData,NOTE_SOURCES} from './cms-data.js?v=chart-series-20261110';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const catalogToken=value=>/^web\s*of\s*science$|^wos$/i.test(value.trim())?'WoS':/^scopus$/i.test(value.trim())?'Scopus':value.trim();
export const catalogTokens=value=>[...new Set(String(value).split(/\s*(?:[;|,\n]|\s*\/\s*)\s*/).map(catalogToken).filter(Boolean))];
export function catalogURL(value){const s=String(value||'').trim();if(!s)return '';try{const u=new URL(/^10\.\d{4,9}\//.test(s)?'https://doi.org/'+s:/^www\./i.test(s)?'https://'+s:s);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export function catalogSourceTable(block,context,all=false){
 const b=block.binding;let table,live=null;
 if(b.kind==='upload'){if(!block.dataTable)throw new Error('Завантажте таблицю CSV або XLSX.');table=block.dataTable;}
 else if(b.kind==='builtin'){live=(a,y)=>context.getTable(b.source,a,y);table=live(true,context.year);}
 else {const source=context.getBlock(b.blockId);if(!source)throw new Error('Таблицю-джерело не знайдено. Виберіть іншу таблицю.');if(['table','chart'].includes(source.type))table=blockTableData(source);else if(source.type==='analytics'&&Object.hasOwn(NOTE_SOURCES,source.source)){if(source.dataMode==='manual')table=source.dataTable;else{live=(a,y)=>context.getTable(source.source,a,y);table=live(true,context.year);}}else throw new Error('Оберіть блок таблиці, діаграми або аналітичної таблиці.');}
 table=validateCatalogTable(table);if(all)return {table,period:'',error:''};
 const auto=table.headers.findIndex(h=>/^(рік|year|publication year|рік публікації|дата|date)$/iu.test(h)),yearColumn=b.yearColumn?table.headers.indexOf(b.yearColumn):auto;
 if(b.yearColumn&&yearColumn<0)throw new Error(`Колонку року «${b.yearColumn}» не знайдено.`);
 const getYear=row=>String(row[yearColumn]||'').match(/^\d{4}(?:\b|[-/])/u)?.[0].slice(0,4),years=table.rows.map(getYear).filter(Boolean).map(Number),parts=b.periodMode==='fixed'?b.period.split('-').map(Number):[context.year],first=parts[0],last=parts[1]??first;
 let rows=table.rows,period=b.periodMode==='all'?(years.length?`${Math.min(...years)}–${Math.max(...years)}`:''):b.periodMode==='fixed'?b.period.replace('-','–'):yearColumn>=0||live?String(context.year):'';
 if(live&&yearColumn<0&&b.periodMode==='fixed'&&first!==last)throw new Error('Для діапазону років оберіть джерело з колонкою року або дати. Це зведене джерело підтримує один рік або всі роки.');
 if(b.periodMode!=='all'){if(yearColumn>=0)rows=rows.filter(row=>{const y=Number(getYear(row));return y>=first&&y<=last;});else if(live&&first===last)rows=validateCatalogTable(live(false,first)).rows;}
 const required=[...block.catalog.columns.flatMap(c=>c.lines.flatMap(l=>[l.field,l.linkField,...(['badges','quartile'].includes(l.format)?l.tokenLinks.map(t=>t.field):[])])),...block.catalog.filters.map(f=>f.field),...(block.catalog.searchEnabled?block.catalog.searchFields:[])].filter(Boolean),missing=[...new Set(required.filter(f=>!table.headers.includes(f)))];if(missing.length)throw new Error(`У таблиці немає колонок: ${missing.join(', ')}. Налаштуйте стовпчики каталогу.`);
 return {table:{headers:table.headers,rows},period,error:''};
}
export function catalogYears(block,context){
 const result=resolveCatalog(block,context,true);if(result.error)return [];const {headers,rows}=result.table,i=block.binding.yearColumn?headers.indexOf(block.binding.yearColumn):headers.findIndex(h=>/^(рік|year|publication year|рік публікації|дата|date)$/iu.test(h));if(i<0)return [];
 return [...new Set(rows.map(row=>Number(String(row[i]).match(/^\d{4}(?:\b|[-/])/u)?.[0].slice(0,4))).filter(Number.isInteger))];
}
export function resolveCatalog(block,context,all=false){try{return catalogSourceTable(all?block:{...block,binding:validateCatalogBinding(block.binding)},context,all);}catch(err){return {table:{headers:[],rows:[]},period:'',error:err.message};}}
function lineHTML(line,row,index){
 const raw=line.field?row[index.get(line.field)]||'':'',present=!line.field||raw&&!/^(false|no|ні|0|—|-)$/iu.test(raw),value=line.fixedText?(present?line.fixedText:''):raw||line.emptyText;if(!value)return '';
 const link=(text,field,cls='')=>{const url=catalogURL(field?row[index.get(field)]:'');return url?`<a class="${cls}" href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(text)}</a>`:`<span class="${cls}">${e(text)}</span>`;};
 let content;
 if(line.format==='badges'||line.format==='quartile')content=`<div class="catalog-tags">${(line.format==='quartile'?[value]:catalogTokens(value)).map(token=>{const t=line.format==='quartile'&&/^[1-4]$/.test(token)?'Q'+token:token,field=line.tokenLinks.find(item=>catalogToken(item.value)===catalogToken(t))?.field||line.linkField;return link(t,field,`catalog-tag ${/^Q[1-4]$/i.test(t)?'catalog-'+t.toLowerCase():''}`);}).join('')}</div>`;
 else content=link(value,line.linkField).replaceAll('\n','<br>');
 return `<div class="catalog-cell-line catalog-cell-${line.style}">${line.label?`<span class="catalog-line-label">${e(line.label)} </span>`:''}${content}</div>`;
}
export function renderCatalog(block,result,state={},previewLimit=0){
 if(result.error)return `<div class="data-catalog" data-catalog-id="${e(block.id)}"><p class="form-error" role="status">${e(result.error)}</p></div>`;
 const c=block.catalog,table=result.table,index=new Map(table.headers.map((h,i)=>[h,i])),options=c.filters.map(f=>[...new Set(table.rows.flatMap(row=>f.multiple?catalogTokens(row[index.get(f.field)]||''):[row[index.get(f.field)]||'']))].sort((a,b)=>a.localeCompare(b,'uk'))),selected=c.filters.map((_,i)=>{const v=state.filters?.[i]||'';return options[i].some(option=>JSON.stringify(option)===v)?v:'';}),query=(state.query||'').toLocaleLowerCase('uk').trim(),rows=table.rows.filter(row=>(!c.searchEnabled||!query||c.searchFields.some(f=>(row[index.get(f)]||'').toLocaleLowerCase('uk').includes(query)))&&c.filters.every((f,i)=>!selected[i]||(f.multiple?catalogTokens(row[index.get(f.field)]||''):[row[index.get(f.field)]||'']).some(v=>JSON.stringify(v)===selected[i]))),choices=catalogPageSizes(c.pageSizes,c.pageSize),selectedSize=choices.includes(state.pageSize)?state.pageSize:c.pageSize,fullList=!previewLimit&&block.settings?.showAll!==false,size=previewLimit||(fullList||selectedSize===0?Math.max(1,rows.length):selectedSize),pages=Math.max(1,Math.ceil(rows.length/size)),page=fullList||selectedSize===0||previewLimit?1:Math.max(1,Math.min(pages,state.page||1)),start=(page-1)*size;
 const filters=c.filters.map((f,i)=>`<label class="catalog-filter"><span>${e(f.label)}</span><select data-catalog-filter="${i}" aria-label="${e(f.label)}"><option value="">Всі</option>${options[i].map(v=>`<option value="${e(JSON.stringify(v))}" ${selected[i]===JSON.stringify(v)?'selected':''}>${e(v||'Без значення')}</option>`).join('')}</select></label>`).join('');
 const search=c.searchEnabled?`<label class="catalog-search"><span>Пошук</span><input type="search" data-catalog-query value="${e(state.query||'')}" placeholder="${e(c.searchPlaceholder)}" aria-label="${e(c.searchPlaceholder||'Пошук у каталозі')}"></label>`:'';
 return `<div class="data-catalog${c.emphasizeLinks?' catalog-link-emphasis':''}" data-catalog-id="${e(block.id)}"><div class="catalog-toolbar">${search}${filters}<button type="button" class="button secondary small" data-cms-action="catalog-reset">Скинути</button></div><div class="data-catalog-results"><div class="catalog-summary"><span>Знайдено <strong>${rows.length}</strong> записів</span>${!fullList&&!previewLimit?`<label class="catalog-page-size">Записів на сторінці<select data-catalog-page-size aria-label="Кількість записів на сторінці">${choices.map(n=>`<option value="${n}" ${n===selectedSize?'selected':''}>${n===0?'Всі':n}</option>`).join('')}</select></label>`:''}</div>${rows.length?`<table class="data-catalog-table"><thead><tr>${c.columns.map(col=>`<th scope="col" style="${col.width?'width:'+col.width+'px;':''}text-align:${col.align}">${e(col.label)}</th>`).join('')}</tr></thead><tbody>${rows.slice(start,start+size).map(row=>`<tr>${c.columns.map(col=>`<td data-label="${e(col.label)}" style="text-align:${col.align}"><div>${col.lines.map(line=>lineHTML(line,row,index)).join('')}</div></td>`).join('')}</tr>`).join('')}</tbody></table>`:'<div class="empty"><p>За цими параметрами записів не знайдено.</p></div>'}<div class="catalog-pagination"><span>${rows.length?start+1:0}–${Math.min(start+size,rows.length)} із ${rows.length}</span>${!fullList&&!previewLimit&&selectedSize!==0?`<div><button class="button secondary small" type="button" data-cms-action="catalog-prev" ${page===1?'disabled':''}>Назад</button><span data-catalog-page="${page}">${page} / ${pages}</span><button class="button secondary small" type="button" data-cms-action="catalog-next" ${page===pages?'disabled':''}>Далі</button></div>`:''}</div></div></div>`;
}

export function resolveChartData(block,context,all=false){
 try{
 const b=validateChartBinding(block.binding);
 const source={...block,binding:{...b,kind:b.kind==='manual'?'upload':b.kind},dataTable:{headers:block.columns,rows:block.rows},catalog:{columns:[],filters:[],searchEnabled:false}};
 let result=catalogSourceTable(source,context,true);if(all)return result;
 const yearHeader=h=>/^(рік|year|publication year|рік публікації|дата|date)$/iu.test(h);
 const raw=result.table;if(!b.yearColumn&&raw.rows.length&&raw.rows.every(r=>/^\d{4}$/.test(r[0])))source.binding.yearColumn=raw.headers[0];
 const wide=raw.headers.some(h=>/^\d{4}$/.test(h)),hasYear=source.binding.yearColumn||raw.headers.some(yearHeader);
 const linked=b.kind==='block'?context.getBlock(b.blockId):null,live=b.kind==='builtin'?b.source:linked?.type==='analytics'&&linked.dataMode!=='manual'?linked.source:null;
 if(wide&&!hasYear){
  const parts=b.periodMode==='fixed'?b.period.split('-').map(Number):[context.year],first=parts[0],last=parts[1]??first;
  const selected=raw.headers.map((h,i)=>({h,i})).filter(({h})=>/^\d{4}$/.test(h)&&(b.periodMode==='all'||+h>=first&&+h<=last));
  const keep=raw.headers.map((h,i)=>({h,i})).filter(({h})=>!/^\d{4}$/.test(h)||selected.some(c=>c.h===h));
  result={table:{headers:keep.map(c=>c.h),rows:selected.length?raw.rows.map(r=>keep.map(c=>r[c.i])):[]},period:b.periodMode==='all'?selected.map(c=>c.h).filter((_,i,a)=>i===0||i===a.length-1).join('–'):b.periodMode==='fixed'?b.period.replace('-','–'):String(context.year),error:''};
 }else if(live&&!hasYear&&(b.periodMode==='fixed'||b.periodMode==='all'&&['stats','fundingStats','patentStats'].includes(live))){
  const parts=b.period.split('-').map(Number),years=b.periodMode==='all'?(context.years||[context.year]):Array.from({length:(parts[1]??parts[0])-parts[0]+1},(_,i)=>parts[0]+i),tables=years.map(year=>context.getTable(live,false,year));
  result={table:{headers:raw.headers,rows:tables.flatMap(t=>t.rows.map(r=>raw.headers.map(h=>r[t.headers.indexOf(h)]??'')))},period:b.periodMode==='all'?years.filter((_,i)=>i===0||i===years.length-1).join('–'):b.period.replace('-','–'),error:''};
 }else result=catalogSourceTable(source,context);
 const {headers,rows}=result.table;
 const index=name=>{const i=headers.indexOf(name);if(i<0)throw new Error(`Колонку «${name}» не знайдено у джерелі.`);return i;};
 const group=b.groupColumn?index(b.groupColumn):0,series=!b.seriesRules.length&&b.seriesColumn?index(b.seriesColumn):-1;
 const rules=b.seriesRules.filter(r=>r.visible).map(rule=>({...rule,index:index(rule.column)}));
 const key=(value,column)=>{const text=String(value??'').trim();return /^(indexes|індексація)$/iu.test(column)?text.split(/\s*[|;/]\s*/u).map(v=>v.trim()).sort().join('|'):text;};
 const number=value=>{const s=String(value??'').trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');return s&&!['—','-'].includes(s)&&Number.isFinite(Number(s))?Number(s):null;};
 const values=b.operation==='count'?[]:b.valueColumns.length?b.valueColumns.filter(h=>!(wide&&!hasYear&&/^\d{4}$/.test(h)&&raw.headers.includes(h)&&!headers.includes(h))).map(index):headers.map((_,i)=>i).filter(i=>i!==group&&i!==series&&!/^(рік|year|дата|date)$/iu.test(headers[i])&&rows.some(r=>number(r[i])!==null));
 if(!values.length&&b.operation!=='count'&&rows.length&&!(wide&&!hasYear))throw new Error('Оберіть числові колонки для розрахунку.');
 const names=new Set(),groups=new Map();
 const ruleName=(rule,i)=>values.length>1?`${rule.name} · ${headers[i]}`:rule.name;
 if(b.seriesRules.length)for(const rule of rules)for(const i of b.operation==='count'?[-1]:values)names.add(ruleName(rule,i));
 for(const row of rows){const label=row[group]||'Без назви';if(!groups.has(label))groups.set(label,new Map());const cells=groups.get(label);
 if(b.seriesRules.length){
  for(const rule of rules){if(!rule.values.some(value=>key(value,rule.column)===key(row[rule.index],rule.column)))continue;
   for(const i of b.operation==='count'?[-1]:values){const name=ruleName(rule,i);if(!cells.has(name))cells.set(name,[]);const n=i<0?1:number(row[i]);if(n!==null)cells.get(name).push(n);}}
  continue;
 }
 for(const i of b.operation==='count'?[-1]:values){const name=series>=0?`${row[series]||'Без назви'}${values.length>1?' · '+headers[i]:''}`:i<0?'Кількість':headers[i];names.add(name);if(!cells.has(name))cells.set(name,[]);const n=i<0?1:number(row[i]);if(n!==null)cells.get(name).push(n);}}
 if(!rows.length||!values.length&&b.operation!=='count')return {...result,table:{headers:[headers[group]||'Назва',...(b.seriesRules.length?[...names]:b.operation==='count'?['Кількість']:values.length?values.map(i=>headers[i]):['Значення'])],rows:[]}};
 const calculate=ns=>!ns?.length?(b.seriesRules.length&&b.operation==='count'?'0':''):String(b.operation==='avg'?ns.reduce((a,n)=>a+n,0)/ns.length:b.operation==='min'?Math.min(...ns):b.operation==='max'?Math.max(...ns):ns.reduce((a,n)=>a+n,0));
 const table={headers:[headers[group],...names],rows:b.seriesRules.length&&!rules.length?[]:[...groups].map(([label,cells])=>[label,...[...names].map(name=>calculate(cells.get(name)))])};
 if(b.sortOrder!=='source'){
  const collator=new Intl.Collator('uk-UA',{sensitivity:'base'}),descending=['labelDesc','numberDesc','valueDesc'].includes(b.sortOrder),direction=descending?-1:1;
  const total=row=>{const ns=row.slice(1).map(number).filter(n=>n!==null);return ns.length?ns.reduce((a,n)=>a+n,0):null;};
  table.rows.sort((a,c)=>{
   if(b.sortOrder.startsWith('label'))return direction*collator.compare(a[0],c[0]);
   const left=b.sortOrder.startsWith('number')?number(a[0]):total(a),right=b.sortOrder.startsWith('number')?number(c[0]):total(c);
   if(left===null||right===null)return left===right?0:left===null?1:-1;
   return direction*(left-right);
  });
 }
 if(['pie','donut','progress'].includes(block.settings?.chartType)&&table.rows.some(row=>row.slice(1).some(v=>Number(v)<0)))throw new Error('Кругова діаграма та смуги прогресу не підтримують від’ємні значення.');
 return {...result,table};
 }catch(error){return {table:{headers:[],rows:[]},period:'',error:error.message};}
}
