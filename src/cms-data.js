export const CORE_PAGES = { overview: 'Огляд', publications: 'Публікації', projects: 'Грантові проєкти', patents: 'Патенти', funding: 'Фінансування' };
export const BLOCK_TYPES = { text: 'Текст', table: 'Таблиця', list: 'Список', banner: 'Банер', metrics: 'Картки показників', analytics: 'Аналітичний блок', existing: 'Наявна сторінка аналітики' };
export const ANALYTICS = { stats: 'Картки основних показників', publicationChart: 'Публікації за роками', quartiles: 'Розподіл за квартилями', faculties: 'Внесок факультетів', projects: 'Грантові проєкти', publications: 'Таблиця публікацій', patents: 'Таблиця патентів', funding: 'Надходження на науку' };
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
  if (input.type === 'metrics') {
    if (!Array.isArray(input.items) || input.items.length > 12) fail('Показники: не більше 12 карток.');
    out.items = input.items.map(x => {
      if (!obj(x)) fail('Некоректна картка показника.');
      return { label: str(x.label, 'Назва показника', 160, true), value: str(x.value, 'Значення', 100, true), unit: str(x.unit, 'Одиниця', 40), note: str(x.note, 'Примітка', 500) };
    });
  }
  if (input.type === 'analytics') { if (!Object.hasOwn(ANALYTICS, input.source)) fail('Невідоме джерело аналітики.'); out.source = input.source; }
  if (input.type === 'existing') { if (!Object.hasOwn(CORE_PAGES, input.source)) fail('Невідома вбудована сторінка.'); out.source = input.source; }
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
  if (type === 'metrics') block.items = [{ label: 'Показник', value: '0', unit: '', note: '' }];
  if (type === 'analytics') block.source = 'stats';
  if (type === 'existing') block.source = 'overview';
  return block;
}
export function cmsRoute(page) { return page.kind === 'builtin' ? page.id : `page/${page.slug}`; }
