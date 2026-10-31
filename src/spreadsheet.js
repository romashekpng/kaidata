import { DATASETS, CSV_HEADERS, importTable, validateBundle } from './data.js?v=project-filters-20261031';
export const SHEET_NAMES = { settings: 'Університет', publications: 'Публікації', projects: 'Проєкти', patents: 'Патенти', revenues: 'Надходження' };
const SETTINGS = ['schemaVersion', 'demo', 'updatedAt', 'institution.name', 'institution.shortName', 'institution.subtitle', 'institution.website', 'institution.accent', 'institution.sourceNote', 'institution.blocks'];
const MAX_UNPACKED = 50 * 1024 * 1024;
const fail = message => { throw new Error(message); };
function workbook(engine) {
  if (!engine?.Workbook) fail('Бібліотеку XLSX не завантажено. Перезавантажте сторінку.');
  return new engine.Workbook();
}
// Check declared uncompressed ZIP sizes before the XLSX reader allocates worksheet data.
function checkArchive(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) fail('XLSX: файл пошкоджено або він не є книгою Excel .xlsx.');
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true), total = 0;
  if (count === 65535 || size === 0xffffffff || count > 2048 || offset + size > end || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) fail('XLSX: книга надто велика або має непідтримувану ZIP-структуру.');
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) fail('XLSX: пошкоджена структура архіву.');
    total += view.getUint32(offset + 24, true);
    if (total > MAX_UNPACKED || view.getUint16(offset + 8, true) & 1) fail('XLSX: книга зашифрована або перевищує 50 МБ після розпакування.');
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  if (offset !== view.getUint32(end + 16, true) + size) fail('XLSX: некоректний каталог архіву.');
}
function cellText(cell, location) {
  const value = cell.value;
  if (value == null) return '';
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) fail(`${location}: некоректна дата.`);
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') fail(`${location}: формули, помилки та складні клітинки не підтримуються. Вставте звичайні значення.`);
  return String(value).trim();
}
function readTable(sheet, dataset) {
  if (sheet.rowCount > 25001 || sheet.columnCount > CSV_HEADERS[dataset].length) fail(`${sheet.name}: забагато рядків або колонок.`);
  const headers = [];
  for (let c = 1; c <= sheet.columnCount; c++) headers.push(cellText(sheet.getCell(1, c), `${sheet.name}, заголовок ${c}`));
  if (!headers.length || headers.some(h => !h) || new Set(headers).size !== headers.length) fail(`${sheet.name}: порожні або повторювані заголовки.`);
  const records = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const values = headers.map((h, c) => cellText(sheet.getCell(r, c + 1), `${sheet.name}, рядок ${r}, ${h}`));
    if (values.some(v => v !== '')) records.push(Object.fromEntries(headers.map((h, c) => [h, values[c]])));
  }
  return { headers, records };
}
function findSheet(book, key) {
  const matches = book.worksheets.filter(s => s.name === SHEET_NAMES[key] || s.name === key);
  if (matches.length > 1) fail(`XLSX: два аркуші відповідають таблиці «${SHEET_NAMES[key]}».`);
  return matches[0];
}
function readSettings(sheet) {
  if (![SETTINGS.length+1,SETTINGS.length+2].includes(sheet.rowCount) || sheet.columnCount !== 2 || cellText(sheet.getCell('A1'), sheet.name) !== 'key' || cellText(sheet.getCell('B1'), sheet.name) !== 'value') fail('Аркуш «Університет» має містити колонки key, value та всі рядки налаштувань із прикладу.');
  const entries = new Map();
  for (let n = 2; n <= sheet.rowCount; n++) {
    const key = cellText(sheet.getCell(n, 1), `${sheet.name}, рядок ${n}`);
    if ((!SETTINGS.includes(key)&&key!=='institution.styles') || entries.has(key)) fail(`${sheet.name}: невідомий або повторюваний ключ ${key}.`);
    entries.set(key, cellText(sheet.getCell(n, 2), `${sheet.name}, ${key}`));
  }
  if(SETTINGS.some(key=>!entries.has(key)))fail('XLSX: відсутні обов’язкові налаштування університету.');
  if (!['true', 'false'].includes(entries.get('demo')) || entries.get('schemaVersion') !== '1') fail('XLSX: schemaVersion має бути 1, demo — true або false.');
  const institution = Object.fromEntries(SETTINGS.filter(k => k.startsWith('institution.')).map(k => [k.slice(12), entries.get(k)]));
  institution.blocks = institution.blocks ? institution.blocks.split('|') : [];
  if(entries.has('institution.styles')){try{institution.styles=JSON.parse(entries.get('institution.styles'));}catch{fail('XLSX: некоректний JSON стилів сайта.');}}
  return { schemaVersion: 1, demo: entries.get('demo') === 'true', updatedAt: entries.get('updatedAt'), institution };
}
export async function readXLSXWorkbook(buffer, engine = globalThis.ExcelJS) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength > 5 * 1024 * 1024) fail('XLSX: файл перевищує 5 МБ.');
  checkArchive(bytes);
  const book = workbook(engine);
  try { await book.xlsx.load(bytes); } catch { fail('Не вдалося прочитати XLSX. Перевірте, що файл не пошкоджений і не захищений паролем.'); }
  if (!book.worksheets.length) fail('XLSX не містить аркушів.');
  return book;
}
export async function importXLSX(buffer, target, current, engine = globalThis.ExcelJS) {
  const book = await readXLSXWorkbook(buffer, engine);
  if (target !== 'bundle') {
    if (!DATASETS.includes(target)) fail('Оберіть таблицю для імпорту XLSX.');
    const sheet = findSheet(book, target) || (book.worksheets.length === 1 ? book.worksheets[0] : null);
    if (!sheet) fail(`Не знайдено аркуш «${SHEET_NAMES[target]}». Використайте приклад або книгу з одним аркушем.`);
    return importTable(readTable(sheet, target), target, current);
  }
  const settings = findSheet(book, 'settings');
  if (!settings || book.worksheets.length !== 5) fail('Повна XLSX-книга має містити 5 аркушів: Університет, Публікації, Проєкти, Патенти, Надходження. Для однієї таблиці змініть обсяг імпорту.');
  const metadata = readSettings(settings);
  let next = validateBundle({ ...metadata, ...Object.fromEntries(DATASETS.map(k => [k, []])) });
  for (const key of DATASETS) {
    const sheet = findSheet(book, key);
    if (!sheet) fail(`Відсутній аркуш «${SHEET_NAMES[key]}».`);
    next = importTable(readTable(sheet, key), key, next);
  }
  // A complete workbook retains the original reporting date, as JSON does.
  return validateBundle({ ...next, updatedAt: metadata.updatedAt });
}
function styleSheet(sheet, columns) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  sheet.columns = columns.map(key => ({ width: key === 'title' || key === 'value' ? 65 : ['authors','faculty','department','funding'].includes(key) ? 45 : 20 }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF138B7B' } };
  header.height = 24;
}
export async function toXLSX(data, target = 'bundle', engine = globalThis.ExcelJS) {
  const clean = validateBundle(data), book = workbook(engine);
  book.creator = 'Наукова аналітика';
  if (target !== 'bundle' && !DATASETS.includes(target)) fail('Невідома таблиця XLSX.');
  if (target === 'bundle') {
    const sheet = book.addWorksheet(SHEET_NAMES.settings);
    sheet.addRow(['key', 'value']);
    SETTINGS.forEach(key => {
      let value = key.startsWith('institution.') ? clean.institution[key.slice(12)] : clean[key];
      if (Array.isArray(value)) value = value.join('|');
      sheet.addRow([key, value]);
    });
    if(clean.institution.styles)sheet.addRow(['institution.styles',JSON.stringify(clean.institution.styles)]);
    styleSheet(sheet, ['key', 'value']);
  }
  for (const key of target === 'bundle' ? DATASETS : [target]) {
    const sheet = book.addWorksheet(SHEET_NAMES[key]);
    sheet.addRow(CSV_HEADERS[key]);
    for (const record of clean[key]) sheet.addRow(CSV_HEADERS[key].map(field => {
      const value = record[field];
      if (field === 'indexes') return value.join('|');
      if (field === 'funding') return JSON.stringify(value);
      return value ?? '';
    }));
    styleSheet(sheet, CSV_HEADERS[key]);
    if (key === 'revenues') sheet.getColumn(CSV_HEADERS[key].indexOf('amountUAH') + 1).numFmt = '#,##0.00';
  }
  return book.xlsx.writeBuffer();
}
