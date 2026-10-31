import { parseCSV, validateBundle } from './data.js?v=project-view-icons-20261031';
import { readXLSXWorkbook } from './spreadsheet.js?v=project-view-icons-20261031';
import { validateCMSBlock, validateCMSPage, validateSite, isMetricBlock, metricDataEqual, metricAppearanceFromTable, blockTableData } from './cms-data.js?v=project-view-icons-20261031';
const fail = message => { throw new Error(message); };
export function blockTable(block){return blockTableData(block);}
export function tableToCMSBlock(table, current) {
  const { headers, rows } = table;
  if (!Array.isArray(headers) || !headers.length || headers.some(x => typeof x !== 'string' || !x.trim()) || new Set(headers).size !== headers.length) fail('Потрібні непорожні унікальні заголовки колонок.');
  if (!Array.isArray(rows) || rows.length > 1000) fail('Не більше 1000 рядків у блоці.');
  const out = structuredClone(current);
  if (out.type === 'table' || out.type === 'chart') { out.columns = headers; out.rows = rows; }
  else if(out.type==='analytics'){
    out.dataTable={headers,rows};out.dataMode='manual';
    if(isMetricBlock(out)){
      out.metricEditingVersion=1;
      if(current.dataMode!=='manual'&&metricDataEqual(out.dataTable,current.dataTable)){out.dataMode='live';out.metricAppearance=metricAppearanceFromTable(out.dataTable);}
    }
  }
  else {
    const expected = out.type==='metrics'?['label','value','unit','note']:blockTable(out).headers;
    if ((out.type==='metrics'?headers.some(h=>![...expected,'background','backgroundColor'].includes(h)):expected.length!==headers.length) || expected.some(h => !headers.includes(h))) fail(`Очікуються колонки: ${expected.join(', ')}.`);
    const records = rows.map(row => { if (row.length !== headers.length) fail('Кількість клітинок не відповідає заголовкам.'); return Object.fromEntries(headers.map((h, i) => [h, row[i]])); });
    if (out.type === 'list') out.items = records.map(x => x.item);
    if (out.type === 'metrics') out.items = records;
    if (out.type === 'text' || out.type === 'banner') { if (records.length !== 1) fail('Для тексту або банера потрібен один рядок.'); Object.assign(out, records[0]); }
  }
  return validateCMSBlock(out);
}
export function cmsBlockCSV(block) {
  const table = blockTable(validateCMSBlock(block));
  const cell = value => {
    const s = String(value), numeric=/^[+-]?\d+(?:[.,]\d+)?(?:e[+-]?\d+)?$/i.test(s); return '"' + (/^[=+@\-\t\r]/.test(s)&&!numeric ? "'" + s : s).replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [table.headers, ...table.rows].map(row => row.map(cell).join(';')).join('\r\n');
}
export function importCMSBlockCSV(source, block) {
  const parsed = parseCSV(source, true);
  return tableToCMSBlock({ headers: parsed.headers, rows: parsed.records.map(r => parsed.headers.map(h => r[h])) }, block);
}
export async function cmsBlockXLSX(block, engine = globalThis.ExcelJS) {
  if (!engine?.Workbook) fail('Бібліотека XLSX недоступна.');
  const table = blockTable(validateCMSBlock(block)), book = new engine.Workbook();
  const sheet = book.addWorksheet('Дані блоку');
  sheet.addRow(table.headers); table.rows.forEach(row => sheet.addRow(row));
  sheet.columns = table.headers.map(() => ({ width: 30 }));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF138B7B' } };
  return book.xlsx.writeBuffer();
}
export async function importCMSBlockXLSX(bytes, block, engine = globalThis.ExcelJS) {
  const book = await readXLSXWorkbook(bytes, engine);
  if (book.worksheets.length !== 1) fail('Для даних блоку потрібна книга з одним аркушем.');
  const sheet = book.worksheets[0];
  const colorColumns=isMetricBlock(block)?['background','backgroundColor'].filter(key=>Array.from({length:sheet.columnCount},(_,i)=>sheet.getCell(1,i+1).value).includes(key)).length:0;
  if (sheet.columnCount > 12+colorColumns || sheet.rowCount > 1001) fail('Не більше 12 колонок даних і 1000 рядків.');
  const text = cell => {
    const v = cell.value;
    if (v == null) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'object') fail('Формули й складні клітинки не підтримуються. Вставте звичайні значення.');
    return String(v);
  };
  const headers = Array.from({ length: sheet.columnCount }, (_, c) => text(sheet.getCell(1, c + 1)).trim());
  const rows = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = headers.map((_, c) => text(sheet.getCell(r, c + 1)));
    if (row.some(v => v.trim())) rows.push(row);
  }
  return tableToCMSBlock({ headers, rows }, block);
}
export function readCMSJSON(source, kind, current = null) {
  let value; try { value = JSON.parse(source.replace(/^\uFEFF/, '')); } catch { fail('Не вдалося прочитати JSON.'); }
  if (kind === 'block') {
    if (value?.blockVersion !== 1) fail('Очікується JSON блоку з blockVersion: 1.');
    return validateCMSBlock({ ...value.block, id: current.id });
  }
  if (kind === 'page') {
    if (value?.pageVersion !== 1) fail('Очікується JSON сторінки з pageVersion: 1.');
    return validateCMSPage(value.page);
  }
  if (kind === 'site') {
    if (value?.packageVersion !== 1) fail('Очікується резервна копія сайта з packageVersion: 1.');
    return { packageVersion: 1, site: validateSite(value.site), data: validateBundle(value.data) };
  }
  fail('Невідомий формат імпорту.');
}
