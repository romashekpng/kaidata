import { scaleMoney } from './money.js?v=local-save-20261103';
import { validateSiteStyles } from './style-data.js?v=local-save-20261103';
export const DATASETS = ['publications', 'projects', 'patents', 'revenues'];
export const BLOCKS = { publications: 'Публікації', projects: 'Грантові проєкти', patents: 'Патенти', funding: 'Фінансування' };
export const SIDEBAR_DEFAULTS = Object.freeze({
 sidebarStatus:'Відкриті дані. Нові можливості.',
 sidebarTagline:'Знання, що формують\nмайбутнє університету.',
 showSidebarStatus:false,showSidebarTagline:false,showSidebarName:true,showSidebarSubtitle:false
});
export const CSV_HEADERS = {
  publications: ['id', 'title', 'authors', 'year', 'faculty', 'department', 'indexes', 'quartile', 'type', 'url'],
  projects: ['id', 'title', 'program', 'startDate', 'endDate', 'role', 'international', 'faculty', 'funding', 'url', 'progressByYear'],
  patents: ['id', 'title', 'number', 'date', 'authors', 'faculty', 'url'],
  revenues: ['year', 'source', 'amountThousandUAH'],
};
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function fail(message) { throw new Error(message); }
function text(v, field, max = 2000) {
  if (typeof v !== 'string' || !v.trim() || v.length > max) fail(`${field}: потрібен непорожній текст (до ${max} символів).`);
  return v.trim();
}
function optional(v, f) { return v == null || v === '' ? '' : text(v, f); }
function year(v, field) { if (!Number.isInteger(v) || v < 1900 || v > 2200) fail(`${field}: рік має бути цілим числом 1900–2200.`); return v; }
function amount(v, field) { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e12) fail(`${field}: потрібна невід’ємна сума у тис. грн.`); return v; }
function financialAmount(record,field){
 const modern=Object.hasOwn(record,'amountThousandUAH'),legacy=Object.hasOwn(record,'amountUAH');
 if(modern&&legacy)fail(`${field}: вкажіть лише amountThousandUAH (тис. грн) або старе amountUAH (грн).`);
 if(modern)return amount(record.amountThousandUAH,field);
 const value=record.amountUAH;
 if(!legacy||typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e15)fail(`${field}: потрібна невід’ємна сума.`);
 return amount(scaleMoney(value,-3),field);
}
function date(v, field) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) fail(`${field}: очікується дійсна дата YYYY-MM-DD.`);
  year(Number(v.slice(0, 4)), field); return v;
}
function url(v, field) {
  if (!v) return '';
  try { const u = new URL(v); if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error(); return u.href; }
  catch { fail(`${field}: дозволено лише http/https URL без облікових даних.`); }
}
const reportingYearFormatter=new Intl.DateTimeFormat('en',{timeZone:'Europe/Kyiv',year:'numeric'});
export function currentReportingYear(asOf=new Date()) { return +reportingYearFormatter.format(new Date(asOf)); }
export function reportingYears(data,asOf=new Date()) {
 const current=currentReportingYear(asOf),past=yearsIn(data).filter(y=>y<=current),first=past.length?Math.min(...past):current;
 return Array.from({length:current-first+1},(_,i)=>first+i);
}
export function reportDate(reportYear,asOf=new Date()) {
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Kyiv'}).format(new Date(asOf));
 return +reportYear<currentReportingYear(asOf)?`${reportYear}-12-31`:today;
}
export function projectReceipts(project,reportYear=null,asOf=new Date()) {
 const entries=project.funding.filter(f=>f.year<=currentReportingYear(asOf)&&(reportYear==null||f.year===reportYear));
 return entries.length?entries.reduce((sum,f)=>sum+f.amountThousandUAH,0):null;
}
export function normalizeProjectProgress(value,field='Виконання') {
 if(value==null||(typeof value==='string'&&!value.trim()))return null;
 const n=typeof value==='string'?Number(value.trim()):value;
 if(!Number.isFinite(n)||n<0||n>100||n%5!==0)fail(`${field}: від 0 до 100 із кроком 5%.`);
 return n;
}
export function updateProjectReports(project,rows,asOf=new Date()) {
 const last=currentReportingYear(asOf),start=+project.startDate.slice(0,4),end=+project.endDate.slice(0,4),seen=new Set(),funding=project.funding.filter(f=>f.year>last),progress=(project.progressByYear||[]).filter(r=>r.year>last);
 for(const row of rows){
  if(!Number.isInteger(row.year)||row.year<start||row.year>Math.min(end,last)||seen.has(row.year))fail('Рік звіту має бути унікальним, у межах проєкту та не пізнішим за поточний рік.');seen.add(row.year);
  const raw=String(row.amount??'').trim();
  if(raw){const text=raw.replace(/[\s\u00a0]/g,'').replace(',','.');if(!/^\d+(?:\.\d+)?$/.test(text))fail(`${row.year}: вкажіть невід’ємну суму у тис. грн.`);funding.push({year:row.year,amountThousandUAH:amount(Number(text),`${row.year}, надходження`)});}
  const percent=normalizeProjectProgress(String(row.percent??'').trim(),`${row.year}, виконання`);if(percent!==null)progress.push({year:row.year,percent});
 }
 // Preserve years not shown in a partial editor, and any future source records.
 funding.push(...project.funding.filter(f=>f.year<=last&&!seen.has(f.year)));progress.push(...(project.progressByYear||[]).filter(r=>r.year<=last&&!seen.has(r.year)));
 const next={...project,funding:funding.sort((a,b)=>a.year-b.year)};if(progress.length)next.progressByYear=progress.sort((a,b)=>a.year-b.year);else delete next.progressByYear;return next;
}
export function normalizeQuartile(value,field='Квартиль') {
 if(value==null)return null;
 if(typeof value!=='string')fail(`${field}: Q1, Q2, Q3, Q4, «Без квартиля» або порожня комірка.`);
 const text=value.trim();
 if(!text||/^без\s+квартиля$/iu.test(text)||text==='—'||text==='-')return null;
 const quartile=text.toUpperCase();
 if(!['Q1','Q2','Q3','Q4'].includes(quartile))fail(`${field}: Q1, Q2, Q3, Q4, «Без квартиля» або порожня комірка.`);
 return quartile;
}
export function validateBundle(input) {
  if (!isObject(input) || ![1,2].includes(input.schemaVersion)) fail('Очікується JSON-об’єкт зі schemaVersion: 1 або 2. Завантажте приклад формату.');
  const i = input.institution;
  if (!isObject(i)) fail('Відсутні налаштування institution.');
  if (!/^#[0-9a-fA-F]{6}$/.test(i.accent)) fail('institution.accent: колір у форматі #RRGGBB.');
  if (!Array.isArray(i.blocks) || i.blocks.some(b => !Object.hasOwn(BLOCKS, b)) || new Set(i.blocks).size !== i.blocks.length) fail('institution.blocks: унікальний список publications, projects, patents, funding.');
  if (typeof input.demo !== 'boolean') fail('demo має бути true (демонстрація) або false (власні дані).');
  const out = { schemaVersion: 2, demo: input.demo, updatedAt: date(input.updatedAt, 'updatedAt'), institution: {
    name: text(i.name, 'institution.name', 180), shortName: text(i.shortName, 'institution.shortName', 24),
    subtitle: optional(i.subtitle, 'institution.subtitle'), accent: i.accent, website: url(i.website, 'institution.website'),
    sourceNote: optional(i.sourceNote, 'institution.sourceNote'), blocks: [...i.blocks],
  }};
  for(const [key,fallback]of Object.entries(SIDEBAR_DEFAULTS)){
    const value=i[key]===undefined?fallback:i[key];
    if(typeof fallback==='boolean'){if(typeof value!=='boolean')fail(`institution.${key}: true або false.`);out.institution[key]=value;}
    else {const max=key==='sidebarStatus'?240:1000;if(typeof value!=='string'||value.length>max)fail(`institution.${key}: текст до ${max} символів або порожнє поле.`);out.institution[key]=value.trim();}
  }
  if(i.styles!==undefined)out.institution.styles=validateSiteStyles(i.styles);
  for (const key of DATASETS) {
    if (!Array.isArray(input[key]) || input[key].length > 25000) fail(`${key}: потрібен масив, не більше 25 000 записів.`);
    const ids = new Set();
    out[key] = input[key].map((r, n) => {
      const f = name => `${key}, рядок ${n + 1}, ${name}`;
      if (!isObject(r)) fail(`${key}, рядок ${n + 1}: очікується об’єкт.`);
      let common = {};
      if (key !== 'revenues') {
        const id = text(r.id, f('id'), 100);
        if (ids.has(id)) fail(`${f('id')}: повторюється «${id}».`); ids.add(id);
        common = { id, title: text(r.title, f('title')), url: url(r.url, f('url')) };
      }
      if (key === 'publications') {
        if (!Array.isArray(r.indexes) || r.indexes.some(x => !['Scopus', 'WoS'].includes(x)) || new Set(r.indexes).size !== r.indexes.length) fail(`${f('indexes')}: масив із Scopus та/або WoS, або [].`);
        const quartile=normalizeQuartile(r.quartile,f('quartile'));
        if (quartile && !r.indexes.length) fail(`${f('quartile')}: квартиль потребує індексації.`);
        return { ...common, authors: text(r.authors, f('authors')), year: year(r.year, f('year')), faculty: text(r.faculty, f('faculty')), department: text(r.department, f('department')), indexes: [...r.indexes], quartile, type: text(r.type, f('type')) };
      }
      if (key === 'projects') {
        const startDate = date(r.startDate, f('startDate')), endDate = date(r.endDate, f('endDate'));
        if (endDate < startDate) fail(`${f('endDate')}: завершення передує початку.`);
        if (!['Координатор', 'Партнер'].includes(r.role)) fail(`${f('role')}: Координатор або Партнер.`);
        if (typeof r.international !== 'boolean') fail(`${f('international')}: true або false.`);
        if (!Array.isArray(r.funding)) fail(`${f('funding')}: масив {year, amountThousandUAH}.`);
        const fundingYears = new Set();
        const funding = r.funding.map(x => {
          if (!isObject(x)) fail(`${f('funding')}: очікується {year, amountThousandUAH}.`);
          const y = year(x.year, f('funding.year'));
          if (y < Number(startDate.slice(0, 4)) || y > Number(endDate.slice(0, 4)) || fundingYears.has(y)) fail(`${f('funding.year')}: унікальний рік у межах проєкту.`);
          fundingYears.add(y); return { year: y, amountThousandUAH: financialAmount(x, f('funding.amountThousandUAH')) };
        });
        const progressByYear=[];
        if(r.progressByYear!==undefined){
          if(!Array.isArray(r.progressByYear))fail(`${f('progressByYear')}: масив {year, percent}.`);const seen=new Set();
          for(const entry of r.progressByYear){if(!isObject(entry))fail(`${f('progressByYear')}: очікується {year, percent}.`);const y=year(entry.year,f('progressByYear.year'));if(y<+startDate.slice(0,4)||y>+endDate.slice(0,4)||seen.has(y))fail(`${f('progressByYear.year')}: унікальний рік у межах проєкту.`);seen.add(y);const percent=normalizeProjectProgress(entry.percent,f('progressByYear.percent'));if(percent===null)fail(`${f('progressByYear.percent')}: потрібне число.`);progressByYear.push({year:y,percent});}
        }
        return { ...common, program: text(r.program, f('program')), startDate, endDate, role: r.role, international: r.international, faculty: optional(r.faculty, f('faculty')), funding,...(progressByYear.length?{progressByYear}:{} ) };
      }
      if (key === 'patents') return { ...common, number: text(r.number, f('number'), 100), date: date(r.date, f('date')), authors: text(r.authors, f('authors')), faculty: text(r.faculty, f('faculty')) };
      return { year: year(r.year, f('year')), source: text(r.source, f('source')), amountThousandUAH: financialAmount(r, f('amountThousandUAH')) };
    });
  }
  return out;
}
export function yearsIn(data) {
  const years = new Set();
  data.publications.forEach(x => years.add(x.year));
  data.patents.forEach(x => years.add(Number(x.date.slice(0, 4))));
  data.revenues.forEach(x => years.add(x.year));
  data.projects.forEach(x => { for (let y = +x.startDate.slice(0, 4); y <= +x.endDate.slice(0, 4); y++) years.add(y); });
  return [...years].sort((a, b) => a - b);
}
export function summarize(data, year) {
  const publications = data.publications.filter(x => x.year === year);
  const indexed = publications.filter(x => x.indexes.length);
  const projects = data.projects.filter(x => +x.startDate.slice(0, 4) <= year && +x.endDate.slice(0, 4) >= year);
  const grants = projects.reduce((sum, x) => sum + x.funding.filter(f => f.year === year).reduce((s, f) => s + f.amountThousandUAH, 0), 0);
  const international = projects.filter(x => x.international).reduce((s, x) => s + x.funding.filter(f => f.year === year).reduce((a, f) => a + f.amountThousandUAH, 0), 0);
  const revenues = data.revenues.filter(x => x.year === year);
  return { publications, indexed, projects, grants, international, hasGrantData:projects.some(p=>p.funding.some(f=>f.year===year)), q12: indexed.filter(x => ['Q1', 'Q2'].includes(x.quartile)).length,
    patents: data.patents.filter(x => +x.date.slice(0, 4) === year), revenue: revenues.length ? revenues.reduce((s, x) => s + x.amountThousandUAH, 0) : null };
}
// RFC 4180 quoted cells, UTF-8 BOM, comma/semicolon/tab separators.
export function parseCSV(source, allowEmpty = false) {
  source = source.replace(/^\uFEFF/, '');
  let first = '', q = false;
  for (let i = 0; i < source.length; i++) { const c = source[i]; if (c === '"') q = !q; if (!q && (c === '\n' || c === '\r')) break; first += c; }
  const count = d => { let quotes = false, n = 0; for (const c of first) { if (c === '"') quotes = !quotes; else if (!quotes && c === d) n++; } return n; };
  const delimiter = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
  const rows = []; let row = [], cell = '', inQuotes = false, closed = false;
  function pushCell() { row.push(cell); cell = ''; closed = false; }
  function pushRow() { pushCell(); if (row.some(c => c.trim())) rows.push(row); row = []; }
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (inQuotes) { if (c === '"') { if (source[i + 1] === '"') { cell += '"'; i++; } else { inQuotes = false; closed = true; } } else cell += c; }
    else if (c === '"') { if (cell || closed) fail('CSV: некоректні лапки в полі.'); inQuotes = true; }
    else if (c === delimiter) pushCell();
    else if (c === '\n' || c === '\r') { if (c === '\r' && source[i + 1] === '\n') i++; pushRow(); }
    else { if (closed) fail('CSV: зайві символи після закриття лапок.'); cell += c; }
  }
  if (inQuotes) fail('CSV: незакриті лапки.');
  if (cell || row.length || closed) pushRow();
  if (rows.length < (allowEmpty ? 1 : 2)) fail('CSV має містити заголовки й щонайменше один запис. Для порожнього набору використайте JSON.');
  const headers = rows.shift().map(x => x.trim());
  if (new Set(headers).size !== headers.length || headers.some(x => !x)) fail('CSV: порожні або повторювані заголовки.');
  return { headers, records: rows.map((r, n) => { if (r.length !== headers.length) fail(`CSV, рядок ${n + 2}: ${r.length} полів замість ${headers.length}.`); return Object.fromEntries(headers.map((h, i) => [h, r[i].trim()])); }) };
}
export function importCSV(source, dataset, current) {
  return importTable(parseCSV(source), dataset, current);
}
export function importTable({ headers, records }, dataset, current) {
  if (!DATASETS.includes(dataset)) fail('Оберіть тип таблиці.');
  if (records.length > 25000) fail('Таблиця містить понад 25 000 записів.');
  const missing = CSV_HEADERS[dataset].filter(h => !headers.includes(h)&&!(dataset==='projects'&&h==='progressByYear')&&!(dataset==='revenues'&&h==='amountThousandUAH'&&headers.includes('amountUAH')));
  if (missing.length) fail(`Відсутні колонки: ${missing.join(', ')}.`);
  const extra = headers.filter(h => !CSV_HEADERS[dataset].includes(h)&&!(dataset==='revenues'&&h==='amountUAH'));
  if (extra.length) fail(`Невідомі колонки: ${extra.join(', ')}.`);
  const numeric = (s, field) => { if (!s.trim()) fail(`${field}: порожнє числове поле.`); const cleaned = s.replace(/[\s\u00a0]/g, '').replace(',', '.'); if (!/^\d+(\.\d+)?$/.test(cleaned)) fail(`${field}: некоректне число.`); return Number(cleaned); };
  const converted = records.map((r, n) => {
    const x = { ...r }; const f = field => `${dataset}, рядок ${n + 2}, ${field}`;
    if ('year' in x) x.year = numeric(x.year, f('year'));
    if ('amountThousandUAH' in x) x.amountThousandUAH = numeric(x.amountThousandUAH, f('amountThousandUAH'));
    if ('amountUAH' in x) x.amountUAH = numeric(x.amountUAH, f('amountUAH'));
    if (dataset === 'publications') { x.indexes = x.indexes ? x.indexes.split('|').map(s => s.trim()) : []; x.quartile = x.quartile || null; }
    if (dataset === 'projects') {
      if (!['true', 'false'].includes(x.international)) fail(`${f('international')}: true або false.`);
      x.international = x.international === 'true';
      try { x.funding = JSON.parse(x.funding || '[]');if(x.progressByYear)x.progressByYear=JSON.parse(x.progressByYear);else delete x.progressByYear; } catch { fail(`${f('funding')}: некоректний JSON-масив.`); }
    }
    return x;
  });
  return validateBundle({ ...current, updatedAt: new Date().toISOString().slice(0, 10), [dataset]: converted });
}
export function toCSV(data, dataset) {
  data=validateBundle(data);
  const encode = v => '"' + String(v ?? '').replaceAll('"', '""') + '"';
  return '\uFEFF' + [CSV_HEADERS[dataset].join(';'), ...data[dataset].map(r => CSV_HEADERS[dataset].map(h => {
    let v = r[h]; if (h === 'indexes') v = v.join('|'); if (h === 'funding'||h==='progressByYear') v = JSON.stringify(v||[]);
    // Protect spreadsheets from formula injection in free-text fields.
    if (typeof v === 'string' && /^[=+@\-\t\r]/.test(v)) v = "'" + v;
    return encode(v);
  }).join(';'))].join('\r\n');
}
export function groupCount(rows, key) {
  const counts = new Map(); rows.forEach(x => counts.set(x[key], (counts.get(x[key]) || 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1]);
}
