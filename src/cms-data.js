export const CORE_PAGES = { overview: 'Огляд', publications: 'Публікації', projects: 'Грантові проєкти', patents: 'Патенти', funding: 'Фінансування' };
export const BLOCK_TYPES = { text: 'Текст', table: 'Таблиця', list: 'Список', banner: 'Банер', metrics: 'Картки показників', chart: 'Графік / діаграма', analytics: 'Аналітичний блок', existing: 'Наявна сторінка аналітики' };
export const ANALYTICS = { stats: 'Картки основних показників', publicationChart: 'Публікації за роками', quartiles: 'Якість публікацій', faculties: 'Внесок факультетів', projects: 'Грантові проєкти', publications: 'Каталог публікацій', patents: 'Реєстр патентів', funding: 'Надходження на науку', projectChart: 'Проєкти за роками', programs: 'Кошти за програмами', fundingSources: 'Джерела фінансування', fundingTable: 'Надходження за джерелами', fundingStats: 'Показники фінансування', patentStats: 'Показники патентів', patentFaculties: 'Патенти за факультетами', insight: 'Відкрита наука', revenueNotice: 'Примітка про фінансування' };
export const CHART_SOURCES = ['publicationChart', 'quartiles', 'funding', 'projectChart', 'programs', 'fundingSources', 'faculties', 'patentFaculties'];
export const CHART_TYPES = { stacked: 'Стекові стовпчики', bar: 'Груповані стовпчики', horizontal: 'Горизонтальна стовпчаста діаграма', progress: 'Лінійчата діаграма прогресу', line: 'Лінійний графік', donut: 'Кільцева діаграма', pie: 'Кругова діаграма' };
export const TEXT_BACKGROUNDS = { menu:'Колір меню', accent:'Основний акцент', blue:'Блакитний відтінок', green:'Зелений відтінок', amber:'Теплий відтінок', violet:'Фіолетовий відтінок', default:'Стандартний фон', custom:'Власний колір' };
export const BLOCK_PALETTES = {
 blue: { name: 'Синя та сталева', colors: ['#3479c6','#309b70','#7d54a5','#d86f2c','#a9b5c3'] },
 ocean: { name: 'Океан', colors: ['#203c91','#0089c9','#31b9ed','#93a4ba','#cad5e2'] },
 emerald: { name: 'Смарагдова', colors: ['#005f4b','#009c73','#10b98d','#31cfa1','#a2efd4'] },
 warm: { name: 'Бордо та бурштин', colors: ['#881337','#e11d48','#fb4563','#ff9233','#ffd5a7'] },
 purple: { name: 'Королівський ультрамарин', colors: ['#312e81','#4f46e5','#7c3aed','#a855f7','#e9d5ff'] },
 spectrum: { name: 'Контрастний спектр', colors: ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6'] },
 graphite: { name: 'Графіт і золото', colors: ['#0f172a','#334155','#d97706','#f59e0b','#fde68a'] },
 sea: { name: 'Морська хвиля', colors: ['#155e75','#0891b2','#06b6d4','#14b8a6','#99f6e4'] },
 pastel: { name: 'Пастельна', colors: ['#6988b8','#66a5a1','#b38bc2','#d3a363','#aaaec1'] }
};
export function defaultBlockSettings(source = '') {
 return { background:'default', backgroundColor:'#25395d', width:100, columns:source==='fundingStats'?2:source==='patentStats'?1:3, showAll:false, showChartData:false, palette:source==='faculties'?'custom':'blue', customColors:source==='faculties'?['#4fa99d']:['#3479c6','#309b70','#7d54a5','#d86f2c','#a9b5c3'], legend:source==='faculties'?'none':'top', chartType:source==='quartiles'?'donut':source==='faculties'?'progress':'stacked', totalLabels:true, tooltipTotal:true, segmentValues:false, segmentPercentages:false, numbering:true, wrapLabels:false, period:'', allYears:['publicationChart','funding','projectChart','fundingTable'].includes(source), height:320 };
}
export function normalizeBlockPeriod(value) {
 if(typeof value!=='string')throw new Error('Період: вкажіть рік або діапазон, наприклад 2026 чи 2021-2026.');
 const text=value.trim();if(!text)return '';
 const match=text.match(/^(\d{4})(?:\s*[-–—]\s*(\d{4}))?$/);
 if(!match||+match[1]<1000||(match[2]&&+match[2]<+match[1]))throw new Error('Період: вкажіть рік або діапазон, наприклад 2026 чи 2021-2026.');
 return match[2]&&match[2]!==match[1]?`${match[1]}-${match[2]}`:match[1];
}
export function formatBlockPeriod(years) {
 const valid=years.map(Number).filter(y=>Number.isInteger(y)&&y>=1000&&y<=9999);
 if(!valid.length)return '';
 const first=Math.min(...valid),last=Math.max(...valid);return first===last?String(first):`${first}-${last}`;
}
export function inferTablePeriod(table) {
 if(!table?.headers||!table.rows?.length)return '';
 const years=[],present=value=>value!==''&&value!=='—'&&value!=='-';
 for(const [i,header]of table.headers.entries()){
  if(/^\d{4}$/.test(header)&&table.rows.some(r=>present(r[i])))years.push(+header);
  if(/^(рік|year|дата|початок|завершення|date|start|end)$/i.test(header.trim()))for(const row of table.rows){const match=String(row[i]).match(/^(\d{4})(?:[-/.]|$)/);if(match&&row.some((v,j)=>j!==i&&present(v)))years.push(+match[1]);}
  if(/^(note|примітка)$/i.test(header.trim()))for(const row of table.rows)for(const match of String(row[i]).matchAll(/\b((?:19|20|21)\d{2})\b/g))years.push(+match[1]);
 }
 if(!years.length&&table.rows.every(r=>/^\d{4}$/.test(r[0])))for(const row of table.rows)if(row.slice(1).some(present))years.push(+row[0]);
 return formatBlockPeriod(years);
}
export function validateBlockSettings(input = {}, source = '') {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Некоректні налаштування блоку.');
 const out = { ...defaultBlockSettings(source), ...input };
 if(!Object.hasOwn(TEXT_BACKGROUNDS,out.background)||typeof out.backgroundColor!=='string'||!/^#[0-9a-f]{6}$/i.test(out.backgroundColor))throw new Error('Фон блоку: виберіть колір теми або колір у форматі #RRGGBB.');
 for (const [key,min,max] of [['width',1,100],['columns',1,6],['height',180,800]]) if (!Number.isFinite(out[key]) || out[key]<min || out[key]>max || (key!=='width'&&!Number.isInteger(out[key]))) throw new Error(`Некоректне значення ${key}: від ${min} до ${max}.`);
 for(const key of ['showAll','showChartData','totalLabels','tooltipTotal','segmentValues','segmentPercentages','allYears','numbering','wrapLabels']) if(typeof out[key]!=='boolean')throw new Error(`Налаштування ${key}: потрібне true або false.`);
 out.period=normalizeBlockPeriod(out.period);
 if(!['top','bottom','right','none'].includes(out.legend)||!Object.hasOwn(CHART_TYPES,out.chartType)||(!Object.hasOwn(BLOCK_PALETTES,out.palette)&&out.palette!=='custom'))throw new Error('Невідома легенда, палітра або тип графіка.');
 if(!Array.isArray(out.customColors)||!out.customColors.length||out.customColors.length>12||out.customColors.some(c=>typeof c!=='string'||!/^#[0-9a-f]{6}$/i.test(c)))throw new Error('Вкажіть від 1 до 12 кольорів у форматі #RRGGBB.');
 return Object.fromEntries(Object.keys(defaultBlockSettings(source)).map(key=>[key,out[key]]));
}
export function validateBlockTable(input, numeric = false) {
 if(!input || !Array.isArray(input.headers) || !input.headers.length || input.headers.length>12 || input.headers.some(h=>typeof h!=='string'||!h.trim()||h.length>160) || new Set(input.headers.map(h=>h.trim())).size!==input.headers.length)throw new Error('Таблиця: від 1 до 12 непорожніх унікальних колонок.');
 if(!Array.isArray(input.rows)||input.rows.length>1000)throw new Error('Таблиця: не більше 1000 рядків.');
 const headers=input.headers.map(h=>h.trim()),rows=input.rows.map((r,i)=>{if(!Array.isArray(r)||r.length!==headers.length||r.some(c=>typeof c!=='string'||c.length>4000))throw new Error(`Некоректний рядок ${i+1}.`);return r.map(c=>c.trim());});
 if(numeric){if(headers.length<2)throw new Error('Для графіка потрібні підписи та хоча б одна числова серія.');for(const [i,row]of rows.entries())if(!row[0]||row.slice(1).some(c=>c!==''&&!Number.isFinite(Number(c.replace(',','.')))))throw new Error(`Рядок ${i+1}: після першої колонки потрібні числа або порожні значення.`);}
 return {headers,rows};
}
export function moveTableItem(table, axis, from, to) {
 const out=structuredClone(table),items=axis==='column'?out.headers:out.rows;
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=items.length||to>=items.length)return out;
 const move=a=>a.splice(to,0,a.splice(from,1)[0]);move(items);
 if(axis==='column')out.rows.forEach(move);
 return out;
}
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const fail = message => { throw new Error(message); };
function str(v, label, max = 2000, required = false) {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim())) fail(`${label}: ${required ? 'непорожній ' : ''}текст до ${max} символів.`);
  return v.trim();
}
function bool(v, label) { if (typeof v !== 'boolean') fail(`${label}: потрібне true або false.`); return v; }
function id(v, label) { if (typeof v !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(v)) fail(`${label}: некоректний ідентифікатор.`); return v; }
export function safeCMSLink(value) {
  const s = str(value, 'Посилання', 2000);
  if (!s || /^#[a-zA-Z0-9/_-]+$/.test(s)) return s;
  try { const u = new URL(s); if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error(); return u.href; }
  catch { fail('Посилання: використайте http/https або внутрішню адресу #page/slug.'); }
}
export function newCMSId(prefix = 'block') { return `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)}`; }
export function validateCMSBlock(input) {
  if (!obj(input) || !Object.hasOwn(BLOCK_TYPES, input.type)) fail('Невідомий тип блоку.');
  const out = { id: id(input.id, 'ID блоку'), type: input.type, title: str(input.title, 'Заголовок блоку', 240), visible: bool(input.visible, 'Видимість блоку') };
  if (input.type === 'text') out.text = str(input.text, 'Текст', 50000);
  if (input.type === 'banner') {
    if (!['green', 'blue', 'amber', 'dark'].includes(input.tone)) fail('Некоректний колір банера.');
    Object.assign(out, { text: str(input.text, 'Текст банера', 10000), tone: input.tone, linkLabel: str(input.linkLabel, 'Текст кнопки', 100), linkUrl: safeCMSLink(input.linkUrl) });
    if (out.linkUrl && !out.linkLabel) fail('Для кнопки банера потрібен текст.');
  }
  if (input.type === 'list') {
    if (!Array.isArray(input.items) || input.items.length > 1000) fail('Список: не більше 1000 пунктів.');
    out.items = input.items.map(x => str(x, 'Пункт списку', 2000)).filter(Boolean); out.ordered = bool(input.ordered, 'Нумерація списку');
  }
  if (input.type === 'table') {
    if (!Array.isArray(input.columns) || !input.columns.length || input.columns.length > 12) fail('Таблиця: від 1 до 12 колонок.');
    out.columns = input.columns.map(x => str(x, 'Назва колонки', 160, true));
    if (new Set(out.columns).size !== out.columns.length) fail('Назви колонок мають бути унікальними.');
    if (!Array.isArray(input.rows) || input.rows.length > 1000) fail('Таблиця: не більше 1000 рядків.');
    out.rows = input.rows.map((row, n) => { if (!Array.isArray(row) || row.length !== out.columns.length) fail(`Рядок ${n + 1}: кількість клітинок не відповідає колонкам.`); return row.map(x => str(x, `Клітинка рядка ${n + 1}`, 4000)); });
    out.caption = str(input.caption, 'Примітка таблиці', 2000);
  }
  if (input.type === 'chart') { const table=validateBlockTable({headers:input.columns,rows:input.rows},true); Object.assign(out,{columns:table.headers,rows:table.rows}); }
  if (input.type === 'metrics') {
    if (!Array.isArray(input.items) || input.items.length > 12) fail('Показники: не більше 12 карток.');
    out.items = input.items.map(x => {
      if (!obj(x)) fail('Некоректна картка показника.');
      return { label: str(x.label, 'Назва показника', 160, true), value: str(x.value, 'Значення', 100, true), unit: str(x.unit, 'Одиниця', 40), note: str(x.note, 'Примітка', 500) };
    });
  }
  if (input.type === 'analytics') { if (!Object.hasOwn(ANALYTICS, input.source)) fail('Невідоме джерело аналітики.'); out.source = input.source; }
  if (input.type === 'existing') { if (!Object.hasOwn(CORE_PAGES, input.source)) fail('Невідома вбудована сторінка.'); out.source = input.source; }
  if(input.subtitle!==undefined)out.subtitle=str(input.subtitle,'Підзаголовок',2000);
  if(input.dataPeriod!==undefined)out.dataPeriod=normalizeBlockPeriod(input.dataPeriod);
  if(input.settings!==undefined)out.settings=validateBlockSettings(input.settings,input.source);
  if(input.type==='analytics'&&input.source==='faculties'){
    const negativeLegacy=Array.isArray(input.dataTable?.rows)&&input.dataTable.rows.some(row=>Array.isArray(row)&&row.slice(1).some(c=>Number(String(c).replace(',','.'))<0));
    if(input.settings?.chartType==='stacked'&&!Object.hasOwn(input.settings,'numbering')&&!negativeLegacy){
      out.settings.chartType='progress';out.settings.legend='none';
      if(input.settings.palette==='blue'){out.settings.palette='custom';out.settings.customColors=['#4fa99d'];}
    }
    if(input.subtitle===undefined)out.subtitle='За кількістю записів у вибраному році';
  }
  if(input.type==='analytics'){
    if(input.dataMode!==undefined&&!['live','manual'].includes(input.dataMode))fail('Невідоме джерело даних блоку.');
    if(input.dataMode!==undefined)out.dataMode=input.dataMode;
    if(input.dataTable!==undefined)out.dataTable=validateBlockTable(input.dataTable,CHART_SOURCES.includes(input.source));
    if(input.dataMode==='manual'&&!out.dataTable)fail('Для ручного режиму потрібні дані блоку.');
  }
  if((input.type==='chart'||(input.type==='analytics'&&CHART_SOURCES.includes(input.source)))&&['pie','donut','progress'].includes((out.settings||defaultBlockSettings(input.source)).chartType)){
    const rows=input.type==='chart'?out.rows:out.dataTable?.rows;
    if(rows?.some(r=>r.slice(1).some(c=>Number(c.replace(',','.'))<0)))fail('Кругова діаграма та смуги прогресу не підтримують від’ємні значення.');
  }
  return out;
}
export function validateCMSPage(input) {
  if (!obj(input) || !['builtin', 'custom'].includes(input.kind)) fail('Некоректна сторінка.');
  const out = { id: id(input.id, 'ID сторінки'), kind: input.kind, title: str(input.title, 'Назва сторінки', 120, true), heading: str(input.heading, 'Заголовок сторінки', 200, true), description: str(input.description, 'Опис сторінки', 2000), slug: str(input.slug, 'Адреса сторінки', 64, true), visible: bool(input.visible, 'Видимість сторінки'), showYear: bool(input.showYear, 'Фільтр року') };
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(out.slug)) fail('Адреса: малі латинські літери, цифри й дефіс, до 64 символів.');
  if (out.kind === 'builtin' && (!Object.hasOwn(CORE_PAGES, out.id) || out.slug !== out.id)) fail('Не можна змінювати системну адресу вбудованої сторінки.');
  if (out.kind === 'custom' && Object.hasOwn(CORE_PAGES, out.id)) fail('ID сторінки зарезервований.');
  if (!Array.isArray(input.blocks) || input.blocks.length > 50) fail('Сторінка: не більше 50 блоків.');
  out.blocks = input.blocks.map(validateCMSBlock);
  const existing = out.blocks.filter(x => x.type === 'existing');
  if (existing.length > 1 || existing.some(x => out.kind !== 'builtin' || x.source !== out.id)) fail('Повна вбудована аналітика дозволена лише один раз на її початковій сторінці. Для інших сторінок додайте окремі аналітичні блоки.');
  if (new Set(out.blocks.map(x => x.id)).size !== out.blocks.length) fail('ID блоків сторінки не мають повторюватися.');
  return out;
}
export function validateSite(input) {
  if (!obj(input) || input.siteVersion !== 1 || !Array.isArray(input.pages) || input.pages.length > 50) fail('Очікується siteVersion: 1 та масив pages (до 50 сторінок).');
  const pages = input.pages.map(validateCMSPage);
  if (new Set(pages.map(x => x.id)).size !== pages.length || new Set(pages.filter(x => x.kind === 'custom').map(x => x.slug)).size !== pages.filter(x => x.kind === 'custom').length) fail('Повторюються ID або адреси сторінок.');
  const allBlockIds=pages.flatMap(p=>p.blocks.map(b=>b.id));
  if(new Set(allBlockIds).size!==allBlockIds.length)fail('ID блоків мають бути унікальними в усьому сайті.');
  for (const key of Object.keys(CORE_PAGES)) if (!pages.some(p => p.kind === 'builtin' && p.id === key)) fail(`Відсутня вбудована сторінка ${key}.`);
  if (!pages.some(p => p.visible)) fail('Залиште хоча б одну видиму сторінку.');
  const updatedAt = str(input.updatedAt, 'Дата оновлення', 40, true);
  if (!Number.isFinite(Date.parse(updatedAt))) fail('Некоректна дата оновлення сайта.');
  const result = { siteVersion: 1, updatedAt, pages };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 5 * 1024 * 1024) fail('Вміст сторінок перевищує 5 МБ.');
  return result;
}
export function defaultCMSBlock(type) {
  const block = { id: newCMSId(), type, title: BLOCK_TYPES[type], visible: true };
  if (type === 'text') block.text = 'Додайте текст вашого університету.';
  if (type === 'banner') Object.assign(block, { text: 'Важливе повідомлення або запрошення до співпраці.', tone: 'green', linkLabel: '', linkUrl: '' });
  if (type === 'list') Object.assign(block, { items: ['Перший пункт', 'Другий пункт'], ordered: false });
  if (type === 'table') Object.assign(block, { columns: ['Назва', 'Значення'], rows: [['Приклад', '0']], caption: '' });
  if (type === 'chart') Object.assign(block, { columns:['Рік','Серія 1','Серія 2'], rows:[['2024','80','40'],['2025','100','55'],['2026','120','65']], settings:{...defaultBlockSettings(),allYears:true} });
  if (type === 'metrics') block.items = [{ label: 'Показник', value: '0', unit: '', note: '' }];
  if (type === 'analytics') block.source = 'stats';
  if (type === 'existing') block.source = 'overview';
  return block;
}
export function cmsRoute(page) { return page.kind === 'builtin' ? page.id : `page/${page.slug}`; }
export function expandSiteBlocks(input) {
 const site=structuredClone(validateSite(input)),used=new Set(site.pages.flatMap(p=>p.blocks.map(b=>b.id)));
 const layouts={overview:[['stats',100],['publicationChart',66],['quartiles',34],['projects',100],['faculties',50],['insight',50],['revenueNotice',100]],publications:[['publicationChart',66],['quartiles',34],['publications',100],['faculties',100]],projects:[['projectChart',50],['programs',50],['projects',100]],patents:[['patentStats',33],['patentFaculties',67],['patents',100]],funding:[['fundingStats',100],['funding',50],['fundingSources',50],['fundingTable',100],['revenueNotice',100]]};
 for(const page of site.pages)page.blocks=page.blocks.flatMap(block=>{
  if(block.type!=='existing'||page.blocks.length-1+layouts[block.source].length>50)return [block];
  return layouts[block.source].map(([source,width])=>{
   let id=`${block.id.slice(0,45)}-${source}`,n=1;while(used.has(id))id=`${block.id.slice(0,42)}-${source}-${n++}`;used.add(id);
   return {id,type:'analytics',title:ANALYTICS[source],visible:block.visible,source,dataMode:'live',settings:{...defaultBlockSettings(source),width,legend:source==='quartiles'?'bottom':defaultBlockSettings(source).legend}};
  });
 });
 return validateSite(site);
}
