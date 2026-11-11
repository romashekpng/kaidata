export const CATALOG_SOURCES={publications:'Публікації сайта',patents:'Патенти сайта'};
export const DEFAULT_CATALOG_PAGE_SIZES=Object.freeze([20,50,100,0]);
export function catalogPageSizes(value,legacySize=20){
 const sizes=value===undefined?[...new Set([...DEFAULT_CATALOG_PAGE_SIZES,legacySize])]:value;
 if(!Array.isArray(sizes)||!sizes.length||sizes.length>20||sizes.some(n=>!Number.isInteger(n)||(n!==0&&(n<5||n>1000)))||new Set(sizes).size!==sizes.length)throw new Error('Варіанти кількості: унікальні числа від 5 до 1000 або «Всі», до 20 варіантів.');
 return [...sizes].sort((a,b)=>a===0?1:b===0?-1:a-b);
}
const object=v=>v&&typeof v==='object'&&!Array.isArray(v),fail=t=>{throw new Error(t);};
const text=(v,label,max=160)=>{if(typeof v!=='string'||v.length>max)fail(`${label}: текст до ${max} символів.`);return v.trim();};
const flag=(v,label)=>{if(typeof v!=='boolean')fail(`${label}: потрібне true або false.`);return v;};
export function defaultCatalogLine(field=''){return {field,label:'',format:'text',style:'text',linkField:'',fixedText:'',emptyText:'',tokenLinks:[]};}
export function defaultCatalogBinding(){return {kind:'builtin',source:'publications',blockId:'',periodMode:'year',period:'',yearColumn:''};}
export function defaultCatalogConfig(){return {
 emphasizeLinks:false,searchEnabled:true,searchFields:['Назва','Автори'],searchPlaceholder:'Назва публікації або автор…',pageSize:20,pageSizes:[...DEFAULT_CATALOG_PAGE_SIZES],
 columns:[{label:'Публікація',width:0,align:'left',lines:[{...defaultCatalogLine('Назва'),style:'title',linkField:'Посилання'},{...defaultCatalogLine('Автори'),style:'muted'}]},{label:'Тип',width:160,align:'left',lines:[defaultCatalogLine('Тип')]},{label:'Індексація',width:170,align:'left',lines:[{...defaultCatalogLine('Індексація'),format:'badges',emptyText:'Без індексації',tokenLinks:[{value:'Scopus',field:''},{value:'WoS',field:''}]}]},{label:'Квартиль',width:120,align:'left',lines:[{...defaultCatalogLine('Квартиль'),format:'quartile',emptyText:'Без квартиля'}]}],
 filters:[{label:'Тип',field:'Тип',multiple:false},{label:'Індексація',field:'Індексація',multiple:true},{label:'Квартиль',field:'Квартиль',multiple:false}]
};}
export function validateCatalogBinding(value){
 if(!object(value))fail('Перевірте джерело каталогу.');const b={...defaultCatalogBinding(),...value};
 if(!['builtin','block','upload'].includes(b.kind)||!Object.hasOwn(CATALOG_SOURCES,b.source)||!['year','fixed','all'].includes(b.periodMode))fail('Перевірте джерело та період каталогу.');
 b.blockId=text(b.blockId,'ID таблиці',80);if(b.kind==='block'&&!/^[a-zA-Z0-9_-]{1,80}$/.test(b.blockId))fail('Оберіть таблицю-джерело.');
 b.yearColumn=text(b.yearColumn,'Колонка року');b.period=text(b.period,'Період',20);if(b.period){const m=b.period.match(/^(\d{4})(?:\s*[-–—]\s*(\d{4}))?$/);if(!m||+m[1]<1000||m[2]&&(+m[2]<+m[1]||+m[2]-+m[1]>99))fail('Період: вкажіть рік або діапазон до 100 років, наприклад 2021–2026.');b.period=m[2]?`${m[1]}-${m[2]}`:m[1];}if(b.periodMode==='fixed'&&!b.period)fail('Вкажіть фіксований рік або період.');
 return Object.fromEntries(Object.keys(defaultCatalogBinding()).map(k=>[k,b[k]]));
}
export function validateCatalogTable(value){
 if(!object(value)||!Array.isArray(value.headers)||!value.headers.length||value.headers.length>80)fail('Таблиця каталогу: від 1 до 80 колонок.');
 const headers=value.headers.map(h=>text(h,'Назва колонки'));if(headers.some(h=>!h)||new Set(headers).size!==headers.length)fail('Назви колонок мають бути непорожніми та унікальними.');
 if(!Array.isArray(value.rows)||value.rows.length>25000)fail('Таблиця каталогу: до 25 000 рядків.');
 const rows=value.rows.map((row,i)=>{if(!Array.isArray(row)||row.length!==headers.length)fail(`Рядок ${i+1}: кількість клітинок не відповідає заголовкам.`);return row.map(cell=>text(cell,`Рядок ${i+1}`,10000));});return {headers,rows};
}
export function validateCatalogConfig(value){
 if(!object(value)||!Array.isArray(value.columns)||!value.columns.length||value.columns.length>20)fail('Каталог: від 1 до 20 стовпчиків відображення.');
 const out={emphasizeLinks:flag(value.emphasizeLinks===undefined?false:value.emphasizeLinks,'Оформлення посилань'),searchEnabled:flag(value.searchEnabled,'Пошук'),searchPlaceholder:text(value.searchPlaceholder,'Підказка пошуку',240),pageSize:value.pageSize};
 if(!Number.isInteger(out.pageSize)||(out.pageSize!==0&&(out.pageSize<5||out.pageSize>1000)))fail('На сторінці: від 5 до 1000 записів або «Всі».');
 out.pageSizes=catalogPageSizes(value.pageSizes,out.pageSize);if(!out.pageSizes.includes(out.pageSize))fail('Кількість за замовчуванням має входити до варіантів для відвідувача.');
 if(!Array.isArray(value.searchFields)||value.searchFields.length>80)fail('Оберіть колонки для пошуку.');out.searchFields=[...new Set(value.searchFields.map(s=>text(s,'Колонка пошуку')).filter(Boolean))];
 if(out.searchEnabled&&!out.searchFields.length)fail('Для пошуку виберіть хоча б одну колонку або вимкніть пошук.');
 out.columns=value.columns.map(col=>{if(!object(col)||!Array.isArray(col.lines)||!col.lines.length||col.lines.length>20)fail('У стовпчику має бути від 1 до 20 рядків.');if(!['left','center','right'].includes(col.align)||!Number.isInteger(col.width)||col.width<0||col.width>1600)fail('Перевірте вирівнювання та ширину стовпчика (0–1600 px).');return {label:text(col.label,'Заголовок стовпчика',240),width:col.width,align:col.align,lines:col.lines.map(line=>{if(!object(line)||!['text','badges','quartile'].includes(line.format)||!['title','text','muted'].includes(line.style)||!Array.isArray(line.tokenLinks)||line.tokenLinks.length>20)fail('Перевірте формат рядка та посилання міток.');return {field:text(line.field,'Колонка даних'),label:text(line.label,'Підпис рядка',240),format:line.format,style:line.style,linkField:text(line.linkField,'Колонка посилання'),fixedText:text(line.fixedText,'Власний текст',240),emptyText:text(line.emptyText,'Текст порожнього значення',240),tokenLinks:line.tokenLinks.map(t=>({value:text(t.value,'Назва мітки',240),field:text(t.field,'Колонка посилання')}))};})};});
 if(!Array.isArray(value.filters)||value.filters.length>20)fail('Каталог: до 20 фільтрів.');out.filters=value.filters.map(f=>({label:text(f.label,'Назва фільтра',240),field:text(f.field,'Колонка фільтра'),multiple:flag(f.multiple,'Кілька значень у клітинці')}));return out;
}
export function inferCatalogConfig(headers,template='publication'){
 const norm=s=>s.toLowerCase().replace(/[\s_.-]+/g,''),find=names=>headers.find(h=>names.some(n=>norm(h)===norm(n)))||'';
 if(template==='table')return {...defaultCatalogConfig(),searchFields:[...headers],columns:headers.slice(0,20).map(field=>({label:field,width:0,align:'left',lines:[defaultCatalogLine(field)]})),filters:[]};
 const title=find(['Назва','Назва публікації','Title','Publication title','Document title'])||headers[0]||'',authors=find(['Автори','Authors','Author full names']),type=find(['Тип','Тип публікації','Document type','Type']),index=find(['Індексація','Індекси','Indexes','Index','Database']),quartile=find(['Квартиль','Quartile','Scopus quartile']),url=find(['Посилання','URL','Link','DOI','DOI URL']),scopus=find(['Scopus URL','Scopus link','Посилання Scopus']),wos=find(['WoS URL','Web of Science URL','WoS link','Посилання WoS']);
 const c=defaultCatalogConfig();c.searchFields=[title,authors].filter(Boolean);c.columns[0].lines=[{...defaultCatalogLine(title),style:'title',linkField:url},...(authors?[{...defaultCatalogLine(authors),style:'muted'}]:[])];c.columns[1].lines[0].field=type;c.columns[2].lines[0].field=index;c.columns[2].lines[0].tokenLinks=[{value:'Scopus',field:scopus},{value:'WoS',field:wos}];c.columns[3].lines[0].field=quartile;
 if(!index){c.columns[2].lines=[];for(const [field,fixedText]of[[find(['Scopus','Scopus indexed']), 'Scopus'],[find(['WoS','Web of Science','WoS indexed']),'WoS']])if(field)c.columns[2].lines.push({...defaultCatalogLine(field),format:'badges',fixedText,linkField:fixedText==='Scopus'?scopus:wos});if(!c.columns[2].lines.length)c.columns[2].lines=[{...defaultCatalogLine(),emptyText:'Без індексації'}];}
 c.columns=c.columns.filter((col,i)=>i===0||col.lines.some(l=>l.field));c.filters=[{label:'Тип',field:type,multiple:false},{label:'Індексація',field:index,multiple:true},{label:'Квартиль',field:quartile,multiple:false}].filter(f=>f.field);return c;
}
export function publicationCatalogConfig(headers,titleLinks=true){
 const c=inferCatalogConfig(headers),find=names=>headers.find(h=>names.some(n=>h.toLowerCase()===n.toLowerCase()))||'',faculty=find(['Факультет','faculty']),type=find(['Тип','type']),title=c.columns[0];
 if(!titleLinks)title.lines[0].linkField='';
 if(type)title.lines.push({...defaultCatalogLine(type),style:'muted'});
 c.columns=c.columns.filter(col=>col.label!=='Тип');
 if(faculty)c.columns.splice(1,0,{label:'Факультет',width:0,align:'left',lines:[defaultCatalogLine(faculty)]});
 c.filters=c.filters.filter(f=>f.field!==type);
 if(faculty)c.filters.unshift({label:'Факультет',field:faculty,multiple:false});
 c.pageSize=10;c.pageSizes=[10,20,50,100,0];return c;
}

export function patentCatalogConfig(headers){
 const c=inferCatalogConfig(headers,'table'),title=c.columns.find(col=>col.label==='Назва');
 if(title){title.lines[0].style='title';if(headers.includes('Посилання'))title.lines[0].linkField='Посилання';}
 c.columns=c.columns.filter(col=>col.label!=='Посилання');return c;
}
