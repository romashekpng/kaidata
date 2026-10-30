import { validateSiteStyles } from './style-data.js?v=project-catalog-20261030';
export const DATASETS = ['publications', 'projects', 'patents', 'revenues'];
export const BLOCKS = { publications: 'Публікації', projects: 'Грантові проєкти', patents: 'Патенти', funding: 'Фінансування' };
export const CSV_HEADERS = {
  publications: ['id', 'title', 'authors', 'year', 'faculty', 'department', 'indexes', 'quartile', 'type', 'url'],
  projects: ['id', 'title', 'program', 'startDate', 'endDate', 'role', 'international', 'faculty', 'funding', 'url'],
  patents: ['id', 'title', 'number', 'date', 'authors', 'faculty', 'url'],
  revenues: ['year', 'source', 'amountUAH'],
};
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function fail(message) { throw new Error(message); }
function text(v, field, max = 2000) {
  if (typeof v !== 'string' || !v.trim() || v.length > max) fail(`${field}: потрібен непорожній текст (до ${max} символів).`);
  return v.trim();
}
function optional(v, f) { return v == null || v === '' ? '' : text(v, f); }
function year(v, field) { if (!Number.isInteger(v) || v < 1900 || v > 2200) fail(`${field}: рік має бути цілим числом 1900–2200.`); return v; }
function amount(v, field) { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e15) fail(`${field}: потрібна невід’ємна сума у гривнях.`); return v; }
function date(v, field) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) fail(`${field}: очікується дійсна дата YYYY-MM-DD.`);
  year(Number(v.slice(0, 4)), field); return v;
}
function url(v, field) {
  if (!v) return '';
  try { const u = new URL(v); if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error(); return u.href; }
  catch { fail(`${field}: дозволено лише http/https URL без облікових даних.`); }
}
export function validateBundle(input) {
  if (!isObject(input) || input.schemaVersion !== 1) fail('Очікується JSON-об’єкт зі schemaVersion: 1. Завантажте приклад формату.');
  const i = input.institution;
  if (!isObject(i)) fail('Відсутні налаштування institution.');
  if (!/^#[0-9a-fA-F]{6}$/.test(i.accent)) fail('institution.accent: колір у форматі #RRGGBB.');
  if (!Array.isArray(i.blocks) || i.blocks.some(b => !Object.hasOwn(BLOCKS, b)) || new Set(i.blocks).size !== i.blocks.length) fail('institution.blocks: унікальний список publications, projects, patents, funding.');
  if (typeof input.demo !== 'boolean') fail('demo має бути true (демонстрація) або false (власні дані).');
  const out = { schemaVersion: 1, demo: input.demo, updatedAt: date(input.updatedAt, 'updatedAt'), institution: {
    name: text(i.name, 'institution.name', 180), shortName: text(i.shortName, 'institution.shortName', 24),
    subtitle: optional(i.subtitle, 'institution.subtitle'), accent: i.accent, website: url(i.website, 'institution.website'),
    sourceNote: optional(i.sourceNote, 'institution.sourceNote'), blocks: [...i.blocks],
  }};
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
        if (r.quartile !== null && !['Q1', 'Q2', 'Q3', 'Q4'].includes(r.quartile)) fail(`${f('quartile')}: Q1, Q2, Q3, Q4 або null.`);
        if (r.quartile && !r.indexes.length) fail(`${f('quartile')}: квартиль потребує індексації.`);
        return { ...common, authors: text(r.authors, f('authors')), year: year(r.year, f('year')), faculty: text(r.faculty, f('faculty')), department: text(r.department, f('department')), indexes: [...r.indexes], quartile: r.quartile, type: text(r.type, f('type')) };
      }
      if (key === 'projects') {
        const startDate = date(r.startDate, f('startDate')), endDate = date(r.endDate, f('endDate'));
        if (endDate < startDate) fail(`${f('endDate')}: завершення передує початку.`);
        if (!['Координатор', 'Партнер'].includes(r.role)) fail(`${f('role')}: Координатор або Партнер.`);
        if (typeof r.international !== 'boolean') fail(`${f('international')}: true або false.`);
        if (!Array.isArray(r.funding)) fail(`${f('funding')}: масив {year, amountUAH}.`);
        const fundingYears = new Set();
        const funding = r.funding.map(x => {
          if (!isObject(x)) fail(`${f('funding')}: очікується {year, amountUAH}.`);
          const y = year(x.year, f('funding.year'));
          if (y < Number(startDate.slice(0, 4)) || y > Number(endDate.slice(0, 4)) || fundingYears.has(y)) fail(`${f('funding.year')}: унікальний рік у межах проєкту.`);
          fundingYears.add(y); return { year: y, amountUAH: amount(x.amountUAH, f('funding.amountUAH')) };
        });
        return { ...common, program: text(r.program, f('program')), startDate, endDate, role: r.role, international: r.international, faculty: optional(r.faculty, f('faculty')), funding };
      }
      if (key === 'patents') return { ...common, number: text(r.number, f('number'), 100), date: date(r.date, f('date')), authors: text(r.authors, f('authors')), faculty: text(r.faculty, f('faculty')) };
      return { year: year(r.year, f('year')), source: text(r.source, f('source')), amountUAH: amount(r.amountUAH, f('amountUAH')) };
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
  const grants = projects.reduce((sum, x) => sum + x.funding.filter(f => f.year === year).reduce((s, f) => s + f.amountUAH, 0), 0);
  const international = projects.filter(x => x.international).reduce((s, x) => s + x.funding.filter(f => f.year === year).reduce((a, f) => a + f.amountUAH, 0), 0);
  const revenues = data.revenues.filter(x => x.year === year);
  return { publications, indexed, projects, grants, international, q12: indexed.filter(x => ['Q1', 'Q2'].includes(x.quartile)).length,
    patents: data.patents.filter(x => +x.date.slice(0, 4) === year), revenue: revenues.length ? revenues.reduce((s, x) => s + x.amountUAH, 0) : null };
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
  const missing = CSV_HEADERS[dataset].filter(h => !headers.includes(h));
  if (missing.length) fail(`Відсутні колонки: ${missing.join(', ')}.`);
  const extra = headers.filter(h => !CSV_HEADERS[dataset].includes(h));
  if (extra.length) fail(`Невідомі колонки: ${extra.join(', ')}.`);
  const numeric = (s, field) => { if (!s.trim()) fail(`${field}: порожнє числове поле.`); const cleaned = s.replace(/[\s\u00a0]/g, '').replace(',', '.'); if (!/^\d+(\.\d+)?$/.test(cleaned)) fail(`${field}: некоректне число.`); return Number(cleaned); };
  const converted = records.map((r, n) => {
    const x = { ...r }; const f = field => `${dataset}, рядок ${n + 2}, ${field}`;
    if ('year' in x) x.year = numeric(x.year, f('year'));
    if ('amountUAH' in x) x.amountUAH = numeric(x.amountUAH, f('amountUAH'));
    if (dataset === 'publications') { x.indexes = x.indexes ? x.indexes.split('|').map(s => s.trim()) : []; x.quartile = x.quartile || null; }
    if (dataset === 'projects') {
      if (!['true', 'false'].includes(x.international)) fail(`${f('international')}: true або false.`);
      x.international = x.international === 'true';
      try { x.funding = JSON.parse(x.funding || '[]'); } catch { fail(`${f('funding')}: некоректний JSON-масив.`); }
    }
    return x;
  });
  return validateBundle({ ...current, updatedAt: new Date().toISOString().slice(0, 10), [dataset]: converted });
}
export function toCSV(data, dataset) {
  const encode = v => '"' + String(v ?? '').replaceAll('"', '""') + '"';
  return '\uFEFF' + [CSV_HEADERS[dataset].join(';'), ...data[dataset].map(r => CSV_HEADERS[dataset].map(h => {
    let v = r[h]; if (h === 'indexes') v = v.join('|'); if (h === 'funding') v = JSON.stringify(v);
    // Protect spreadsheets from formula injection in free-text fields.
    if (typeof v === 'string' && /^[=+@\-\t\r]/.test(v)) v = "'" + v;
    return encode(v);
  }).join(';'))].join('\r\n');
}
export function groupCount(rows, key) {
  const counts = new Map(); rows.forEach(x => counts.set(x[key], (counts.get(x[key]) || 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1]);
}
