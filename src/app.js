import { createAnalytics } from './analytics.js?v=compact-project-table-20261031';
import { STYLE_FIELDS, defaultSiteStyles, validateSiteStyles, siteStyleVariables } from './style-data.js?v=compact-project-table-20261031';
import { BLOCKS, DATASETS, CSV_HEADERS, validateBundle, yearsIn, summarize, importCSV, toCSV } from './data.js?v=compact-project-table-20261031';
import { icon } from './icons.js?v=compact-project-table-20261031';
import './vendor/exceljs.min.js';
import { importXLSX, toXLSX } from './spreadsheet.js?v=compact-project-table-20261031';
import { createCMS } from './cms.js?v=compact-project-table-20261031';
import { cmsRoute } from './cms-data.js?v=compact-project-table-20261031';
const $ = s => document.querySelector(s);
const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const fmt = v => new Intl.NumberFormat('uk-UA').format(v);
const money = v => v == null ? '—' : new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(v / 1e6);
const date = d => new Intl.DateTimeFormat('uk-UA', { timeZone: 'UTC' }).format(new Date(d));
const today = () => new Date().toISOString().slice(0, 10);
const STORE = 'kai-science.v1';
const THEME_STORE = 'kai-science.theme.v1';
const THEMES = { standard: 'Стандартна', dark: 'Темна', warm: 'Тепла', blue: 'Синя' };
let theme = 'blue';
try { const saved = localStorage.getItem(THEME_STORE); if (Object.hasOwn(THEMES, saved)) theme = saved; } catch {}
applyTheme(theme, false);
const navIcons = { overview: 'grid', publications: 'book', projects: 'globe', patents: 'award', funding: 'wallet' };
const pageTitles = { overview: 'Огляд', ...BLOCKS };
let cms;
let data, demo, year, route = 'overview', query = '', faculty = '', quartile = '', indexFilter = '', projectStatus = 'all', page = 1;
let importTicket = 0;
let exportTarget = 'bundle';
let pending = null, managerTab = 'import', storageAvailable = true;
let toastTimer;
let styleDraft=null,editingStyleId='';
const analytics=createAnalytics({getData:()=>data,getYear:()=>year,getRoute:()=>route,getPage:r=>cms?.getPage(r),getFilters:()=>({query,faculty,quartile,indexFilter,projectStatus,page})});
const {renderExisting:existingPage,renderAnalytics:analyticsBlock,getBlockTable:analyticsTable,getBlockPeriod:displayedBlockPeriod,renderMetricHTML:renderMetricReference,tableBody,filteredRows}=analytics;

function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5000); }
function applyTheme(value, save = true) {
  if (!Object.hasOwn(THEMES, value)) return;
  theme = value;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = ({standard:'#101f2c',dark:'#0c1521',warm:'#302922',blue:'#25395d'})[theme];
  document.querySelectorAll('#theme-select').forEach(el => { el.value = theme; });
  document.querySelectorAll('input[name="displayTheme"]').forEach(el => { el.checked = el.value === theme; });
  if (save) {
    try { localStorage.setItem(THEME_STORE, theme); }
    catch { toast('Тему застосовано до закриття сторінки: сховище браузера недоступне.'); }
  }
}
function themeSettings() {
  const descriptions = {standard:'Світлий фон і прохолодні кольори',dark:'Темний фон і світлий контрастний текст',warm:'Кремовий фон і м’які теплі кольори',blue:'Темно-синє меню, сині акценти та зелено-червоні індикатори'};
  return `<fieldset><legend>Тема оформлення</legend><p class="muted">Застосовується одразу та зберігається для цього браузера.</p><div class="theme-options">${Object.entries(THEMES).map(([id,label])=>`<label class="theme-option"><input type="radio" name="displayTheme" value="${id}" ${theme===id?'checked':''}><span class="theme-swatch ${id}" aria-hidden="true"></span><strong>${label}</strong><small>${descriptions[id]}</small></label>`).join('')}</div></fieldset>`;
}
function applySiteStyles(settings) {
  const root=document.documentElement;
  for(const key of Object.keys(STYLE_FIELDS))root.style.removeProperty('--site-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()));
  root.toggleAttribute('data-site-style',!!settings);
  if(settings)for(const [key,value]of Object.entries(siteStyleVariables(settings)))root.style.setProperty(key,value);
}
function previewStyleDraft(){
  try{
    const validated=validateSiteStyles(styleDraft);
    applySiteStyles({...validated,defaultPreset:editingStyleId});
    const error=$('#style-error');if(error)error.textContent='';
    return validated;
  }catch(err){const error=$('#style-error');if(error)error.textContent=err.message;return null;}
}
function stylesContent(){
  const preset=styleDraft.presets.find(p=>p.id===editingStyleId);
  const options=selected=>styleDraft.presets.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${e(p.name)}</option>`).join('');
  const fields=keys=>keys.map(key=>{const f=STYLE_FIELDS[key];return `<label>${f.label}${f.unit?' · '+f.unit:''}<input type="number" data-style-value="${key}" value="${preset.values[key]}" min="${f.min}" max="${f.max}" step="${f.step}" required><small>${f.min}–${f.max}${f.unit?' '+f.unit:''}</small></label>`;}).join('');
  return `<form id="site-styles-form"><p class="style-help">Налаштуйте розміри тексту та компактність. Перегляд змінюється одразу; закриття без збереження скасовує зміни. На телефоні великі заголовки адаптуються до ширини екрана.</p><div class="form-grid settings-details"><label>Пресет для редагування<select id="style-preset">${options(editingStyleId)}</select></label><label>Пресет за замовчуванням<select id="style-default">${options(styleDraft.defaultPreset)}</select></label><label class="span-2">Назва пресета<input id="style-preset-name" value="${e(preset.name)}" required maxlength="80"></label></div><div class="style-preset-actions"><button type="button" class="button secondary small" data-action="style-new" ${styleDraft.presets.length>=20?'disabled':''}>+ Новий пресет із поточного</button><button type="button" class="button secondary small" data-action="style-reset">Початкові значення</button><button type="button" class="button secondary small danger" data-action="style-delete" ${styleDraft.presets.length===1?'disabled':''}>Видалити пресет</button></div><fieldset><legend>Розміри шрифтів</legend><div class="form-grid style-fields">${fields(['bodySize','headingSize','sectionSize','valueSize','menuSize','controlsSize','tableSize','chartSize','smallSize'])}</div></fieldset><fieldset><legend>Інтервали та вигляд блоків</legend><div class="form-grid style-fields">${fields(['lineHeight','paragraphGap','blockGap','blockPadding','rowPadding','radius'])}</div></fieldset><div class="style-preview" aria-label="Зразок оформлення"><span class="style-preview-caption">Зразок поточного пресета</span><h2>Наукова діяльність</h2><p>Знання, дослідження та результати університету.</p><p>Другий абзац допомагає оцінити міжрядковий інтервал і відступи.</p><div class="style-preview-value">128</div><table><thead><tr><th>Показник</th><th>Значення</th></tr></thead><tbody><tr><td>Публікації</td><td>128</td></tr><tr><td>Проєкти</td><td>12</td></tr></tbody></table></div><div id="style-error" class="form-error" role="alert"></div><p class="style-help">Для відвідувачів застосовується пресет за замовчуванням. Збереження діє в цьому браузері. Для перенесення використайте резервну копію сайта; для публікації — «Сайт для публікації» в адмінці.</p><div class="dialog-actions"><button type="button" class="button secondary" data-action="close-dialog">Скасувати</button><button type="submit" class="button primary">Зберегти стилі</button></div></form>`;
}
function refreshStyleEditor(){
  $('#manager .dialog-body').innerHTML=stylesContent();previewStyleDraft();
}
function styleAction(action){
  if(!styleDraft)return;
  if(!previewStyleDraft())return;
  const current=styleDraft.presets.find(p=>p.id===editingStyleId);
  if(action==='style-new'&&styleDraft.presets.length<20){
    const preset={id:'style-'+crypto.randomUUID(),name:`Мій пресет ${styleDraft.presets.length+1}`,values:{...current.values}};
    styleDraft.presets.push(preset);editingStyleId=preset.id;
  }
  if(action==='style-reset')current.values={...(defaultSiteStyles().presets.find(p=>p.id===current.id)||defaultSiteStyles().presets[0]).values};
  if(action==='style-delete'&&styleDraft.presets.length>1){
    styleDraft.presets=styleDraft.presets.filter(p=>p.id!==editingStyleId);
    if(styleDraft.defaultPreset===editingStyleId)styleDraft.defaultPreset=styleDraft.presets[0].id;
    editingStyleId=styleDraft.presets[0].id;
  }
  refreshStyleEditor();
}
function persist(next) {
  try { localStorage.setItem(STORE, JSON.stringify(next)); storageAvailable = true; }
  catch { storageAvailable = false; toast('Зміни діють до закриття сторінки. Сховище браузера недоступне — експортуйте JSON.'); }
  data = next;
}
function linkTitle(row) { return row.url ? `<a href="${e(row.url)}" target="_blank" rel="noopener noreferrer">${e(row.title)} ${icon('external')}</a>` : e(row.title); }
function pill(text, color = '') { return `<span class="pill ${color}">${e(text)}</span>`; }
function empty(text = 'За цими умовами даних немає', sub = 'Змініть фільтри або імпортуйте новий набір даних.') { return `<div class="empty">${icon('layers')}<h3>${e(text)}</h3><p>${e(sub)}</p></div>`; }
function sectionHead(title, subtitle='', action='') { return `<div class="section-head"><div><h2>${e(title)}</h2>${subtitle ? `<p>${e(subtitle)}</p>` : ''}</div>${action}</div>`; }
function viewLink(key, label = 'Переглянути всі') { return `<a class="text-link" href="#${key}">${e(label)} ${icon('arrow')}</a>`; }
function renderShell() {
  applySiteStyles(data.institution.styles);
  applyTheme(theme, false);
  const i = data.institution;
  document.documentElement.style.setProperty('--accent', i.accent);
  document.title = `${i.shortName} · Наукова діяльність`;
  $('#sidebar').innerHTML = `<button class="icon-button sidebar-close" data-action="close-menu" aria-label="Закрити меню">${icon('close')}</button><a class="brand" href="#overview" aria-label="На головну"><span class="brand-mark">${icon('layers')}</span><span>${e(i.shortName)}<small>SCIENCE & INSIGHTS</small></span></a>
  <div class="sidebar-label">АНАЛІТИКА УНІВЕРСИТЕТУ</div><nav aria-label="Основна навігація">${cms.pages().map(p => `<a class="nav-item ${route === cmsRoute(p) ? 'active' : ''}" href="#${cmsRoute(p)}" ${route === cmsRoute(p) ? 'aria-current="page"' : ''}>${icon(navIcons[p.id] || 'file')}<span>${e(p.title)}</span>${route === cmsRoute(p) ? '<span class="active-dot"></span>' : ''}</a>`).join('')}</nav>
  <div class="sidebar-bottom"><a class="nav-item ${route==='admin'?'active':''}" href="#admin">${icon('settings')}<span>Адмінка</span></a><div class="sidebar-note"><span class="live-dot"></span>Відкриті дані. Нові можливості.<p>Знання, що формують<br>майбутнє університету.</p></div><button class="nav-item" data-action="import">${icon('upload')} Керування даними</button><button class="nav-item" data-action="settings">${icon('settings')} Налаштування</button><div class="sidebar-institution">${i.website ? `<a href="${e(i.website)}" target="_blank" rel="noopener noreferrer">${e(i.name)} ${icon('external')}</a>` : e(i.name)}<span>${e(i.subtitle || 'Платформа наукової аналітики')}</span></div></div>`;
  $('#topbar').innerHTML = `<div class="breadcrumbs"><button class="icon-button mobile-menu" data-action="menu" aria-label="Відкрити меню" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button><span>Аналітика</span>${icon('chevron')}<strong>${e(route==='admin'?'Адмінка':cms.getPage(route)?.title || pageTitles[route] || 'Сторінки')}</strong></div><div class="topbar-right"><label class="theme-switch"><span>Тема</span><select id="theme-select" aria-label="Тема оформлення">${Object.entries(THEMES).map(([id,label])=>`<option value="${id}" ${theme===id?'selected':''}>${label}</option>`).join('')}</select></label><span class="dataset-state ${data.demo ? 'demo' : ''}"><span></span>${data.demo ? 'Демонстраційні дані' : 'Імпортовані дані'}</span><span class="topbar-divider"></span><span class="institution-avatar">${e(i.shortName.slice(0, 3))}</span></div>`;
  $('#footer').innerHTML = `<span>© ${new Date().getFullYear()} ${e(i.shortName)} · Наукова аналітика</span><span>Оновлено ${date(data.updatedAt)}<span class="footer-dot">·</span><button data-action="format">Про дані та методологію ${icon('info')}</button></span>`;
}
function header(cmsPage = null) {
  cmsPage ||= cms?.getPage(route);
  const titles = { overview: ['НАУКОВА ДІЯЛЬНІСТЬ', 'Наука у цифрах', 'Від досліджень до впливу. Результати, що рухають нас уперед.'], publications: ['РЕЗУЛЬТАТИ ДОСЛІДЖЕНЬ', 'Наукові публікації', 'Динаміка публікацій, індексація та внесок наукових підрозділів.'], projects: ['ДОСЛІДЖЕННЯ ТА ПАРТНЕРСТВА', 'Грантові проєкти', 'Міжнародна співпраця та інвестиції в нові знання.'], patents: ['ІНТЕЛЕКТУАЛЬНА ВЛАСНІСТЬ', 'Патенти та винаходи', 'Ідеї, що стають технологіями. Результати винахідницької діяльності.'], funding: ['РЕСУРСИ ДЛЯ РОЗВИТКУ', 'Фінансування науки', 'Надходження на наукову діяльність за джерелами та роками.'] };
  const [eyebrow, title, sub] = cmsPage ? ['НАУКОВА ДІЯЛЬНІСТЬ',cmsPage.heading,cmsPage.description] : titles[route];
  const years = yearsIn(data);
  return `<div class="page-heading"><div><div class="eyebrow"><span></span>${eyebrow}</div><h1>${e(title)}</h1><p>${e(sub)}</p></div><div class="heading-actions"><button class="button secondary" data-action="export">${icon('download')}<span>Експорт даних</span></button><button class="button primary" data-action="import">${icon('upload')}<span>Імпорт даних</span></button></div></div>
  ${!cmsPage || cmsPage.showYear ? `<div class="period-bar"><div class="period-label">${icon('calendar')}<strong>Звітний період</strong><span>Оберіть рік для перегляду</span></div><div class="year-tabs" role="group" aria-label="Звітний рік">${(years.length ? years : [year]).slice(-8).map(y => `<button data-year="${y}" class="${year === y ? 'selected' : ''}" aria-pressed="${year === y}">${y}</button>`).join('')}${years.length > 8 ? `<select aria-label="Усі роки" id="all-years">${years.map(y => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('')}</select>` : ''}</div></div>` : ''}
  ${route==='admin' && data.demo && (!cmsPage || cmsPage.blocks.some(b=>b.visible && ['analytics','existing'].includes(b.type))) ? `<div class="notice demo-notice">${icon('info')}<span><strong>Демонстраційний набір.</strong> Усі показники та записи умовні. Завантажте дані вашого університету для формування звітності.</span><button data-action="import">Додати свої дані ${icon('arrow')}</button></div>` : ''}`;
}
function render() {
  if(route!=='admin'&&!cms.pages().some(p=>cmsRoute(p)===route))route=cms.pages()[0]?cmsRoute(cms.pages()[0]):'empty';
  renderShell();
  const pageInfo=cms.getPage(route);
  $('#content').innerHTML=route==='admin'?cms.renderAdmin():pageInfo?header(pageInfo)+cms.renderBlocks(pageInfo):empty('Немає видимих сторінок','Відкрийте адмінку для налаштування вмісту.');
}
function download(name, content, type='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function resetFilters() { query='';faculty='';quartile='';indexFilter='';page=1; }
function setRoute() { const next=location.hash.slice(1)||'overview';route=next==='admin'||cms?.getPage(next)?next:'overview';resetFilters();projectStatus='all';render();$('#sidebar').classList.remove('open'); }
function datasetCounts(d) { return DATASETS.map(k=>`<div><strong>${fmt(d[k].length)}</strong><span>${e(({publications:'публікацій',projects:'проєктів',patents:'патентів',revenues:'надходжень'})[k])}</span></div>`).join(''); }
const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function exportContent() {
  return `<form id="export-form"><div class="import-description"><h3>Завантажте дані у зручному форматі</h3><p>CSV — окрема таблиця. XLSX — таблиця або повна книга Excel. JSON — повний набір для резервної копії та публікації.</p></div><label class="import-type">Формат<select id="export-format" name="format"><option value="xlsx">XLSX · Excel</option><option value="csv">CSV · UTF-8</option><option value="json">JSON</option></select></label><label class="import-type">Обсяг експорту<select id="export-type" name="target"><option value="bundle">Повний набір і налаштування</option>${DATASETS.map(k=>`<option value="${k}" ${exportTarget===k?'selected':''}>${e(({revenues:'Надходження',...BLOCKS})[k])}</option>`).join('')}</select></label><label id="filtered-export-label" class="checkbox-label"><input type="checkbox" name="filtered" checked>Лише ${year} рік і поточні фільтри, усі сторінки</label><p class="transfer-scope" id="export-scope"></p><div id="export-error" class="form-error" role="alert"></div><div class="dialog-actions"><span>Файл формується у браузері</span><button class="button primary" type="submit">${icon('download')}Завантажити файл</button></div></form>`;
}
function updateImportControls() {
  importTicket++;pending=null;$('#import-result').innerHTML='';$('#file-input').value='';
  const format=$('#import-format').value, target=$('#import-type');
  target.disabled=format==='json';target.options[0].disabled=format==='csv';
  if(format==='json')target.value='bundle';
  if(format==='csv'&&target.value==='bundle')target.value='publications';
  $('#file-input').accept='.'+format;
}
function updateExportControls() {
  const format=$('#export-format').value, target=$('#export-type');
  target.disabled=format==='json';target.options[0].disabled=format==='csv';
  if(format==='json')target.value='bundle';
  if(format==='csv'&&target.value==='bundle')target.value=DATASETS.includes(route)?route:'publications';
  const canFilter=target.value===route&&['publications','patents','projects'].includes(route);
  $('#filtered-export-label').hidden=!canFilter;
  $('#filtered-export-label input').disabled=!canFilter;
  $('#export-error').textContent='';
  $('#export-scope').textContent=target.value==='bundle'?'Усі роки, чотири таблиці й налаштування університету. Повна XLSX-книга містить 5 аркушів.':'За замовчуванням експортується вся таблиця за всі роки. Якщо ввімкнено обмеження — лише поточний звітний рік і фільтри.';
}
async function performExport(form) {
  const button=form.querySelector('button[type="submit"]');button.disabled=true;
  try {
    const fields=new FormData(form), format=fields.get('format'), target=fields.get('target')||'bundle';
    let output=data;
    if(fields.has('filtered')) {
      let rows;
      if(target==='projects') rows=summarize(data,year).projects.filter(p=>projectStatus==='all'||(projectStatus==='international'?p.international:projectStatus==='coordinator'?p.role==='Координатор':p.startDate<=today()&&p.endDate>=today()));
      else rows=filteredRows(target);
      output={...data,[target]:rows};
    }
    const name=`${data.institution.shortName}-${target==='bundle'?'science':target}${fields.has('filtered')?'-'+year:''}.${format}`;
    if(format==='xlsx') download(name,await toXLSX(output,target),XLSX_MIME);
    else if(format==='csv') download(name,toCSV(output,target),'text/csv;charset=utf-8');
    else download(name,JSON.stringify(output,null,2));
    toast('Файл підготовлено для завантаження.');
  }catch(err){if(form.isConnected)form.querySelector('#export-error').textContent=err.message;}
  finally{button.disabled=false;}
}
function managerContent() {
  const i=data.institution;
  if(managerTab==='export') return exportContent();
  if(managerTab==='styles') return stylesContent();
  if(managerTab==='settings') return `<form id="settings-form">${themeSettings()}<div class="form-grid settings-details"><label>Скорочена назва<input name="shortName" value="${e(i.shortName)}" required maxlength="24"></label><label>Колір акценту<input type="color" name="accent" value="${e(i.accent)}"></label><label class="span-2">Повна назва закладу<input name="name" value="${e(i.name)}" required maxlength="180"></label><label class="span-2">Підзаголовок<input name="subtitle" value="${e(i.subtitle)}"></label><label class="span-2">Сайт університету<input name="website" type="url" value="${e(i.website)}" placeholder="https://…"></label><label class="span-2">Джерела й примітки<textarea name="sourceNote" rows="3">${e(i.sourceNote)}</textarea></label></div><fieldset><legend>Блоки аналітики</legend><p class="muted">Вимкнені блоки приховуються; їхні дані залишаються в наборі.</p><div class="checkbox-grid">${Object.entries(BLOCKS).map(([id,label])=>`<label class="checkbox-label"><input type="checkbox" name="blocks" value="${id}" ${i.blocks.includes(id)?'checked':''}>${e(label)}</label>`).join('')}</div></fieldset><div id="form-error" class="form-error" role="alert"></div><div class="dialog-actions"><span>Зберігається в цьому браузері</span><button class="button primary" type="submit">${icon('check')}Зберегти налаштування</button></div></form>`;
  if(managerTab==='format') return `<div class="format-doc"><div class="notice">${icon('info')}<span>Імпорт і налаштування зберігаються локально у вашому браузері. Для публікації спільних даних замініть файл <code>data/demo.json</code> на сервері й установіть <code>demo: false</code>. Відвідувачі без локального імпорту отримають цей набір.</span></div><h3>Один університет — один JSON</h3><p>Файл містить <code>schemaVersion: 1</code>, <code>demo</code>, <code>updatedAt</code>, налаштування <code>institution</code> та чотири масиви даних. Блоки можна вмикати й вимикати в налаштуваннях.</p><div class="format-example"><pre>${e(JSON.stringify({schemaVersion:1,demo:false,updatedAt:today(),institution:{shortName:'КАІ',name:'Назва університету',subtitle:'Наукова аналітика',accent:'#138b7b',website:'https://kai.edu.ua',sourceNote:'Власні перевірені дані',blocks:['publications','projects','patents','funding']},publications:[],projects:[],patents:[],revenues:[]},null,2))}</pre></div><h3>CSV та XLSX для окремих блоків</h3><p>UTF-8, заголовки обов’язкові. Роздільник: крапка з комою, кома або табуляція. Файл замінює весь обраний набір за всі роки. XLSX підтримує одну таблицю або повну книгу з 5 аркушами: Університет, Публікації, Проєкти, Патенти, Надходження. Для повного перенесення налаштувань використайте XLSX або JSON. Для CSV оберіть одну таблицю. Формули Excel не імпортуються — вставляйте значення.</p>${DATASETS.map(k=>`<div class="format-dataset"><strong>${e(({revenues:'Надходження',...BLOCKS})[k])}</strong><code>${CSV_HEADERS[k].join(', ')}</code><button class="text-link" data-action="template" data-dataset="${k}">${icon('download')}Приклад CSV</button><button class="text-link" data-action="xlsx-template" data-dataset="${k}">${icon('download')}Приклад XLSX</button></div>`).join('')}<h3>Правила розрахунку</h3><ul><li>Публікації відбираються за роком видання; індексація Scopus / WoS рахується без дублювання.</li><li>Q1–Q2 — кількість індексованих публікацій із цими квартилями. Квартиль має відповідати року публікації.</li><li>Проєкт враховується в кожному році виконання. Кошти — фактичні надходження університету у гривнях за роком, не загальний бюджет проєкту. Міжнародна частка рахується від коштів.</li><li>Патенти рахуються за датою реєстрації. Один запис — один патент із одним основним факультетом.</li><li>Кожна публікація має один основний факультет і кафедру. Це не дубльований облік співавторів із різних факультетів.</li><li>Відсутні надходження позначені «—», явний нуль — «0». Гранти й надходження не підсумовуються між собою.</li><li>Порівняння — із попереднім календарним роком; за нульової бази відсоток не визначається. Поточний рік може бути неповним.</li></ul><h3>Особливі поля CSV</h3><p><code>indexes</code>: <code>Scopus|WoS</code> або порожнє поле. <code>quartile</code>: Q1–Q4 або порожнє. Дати: <code>YYYY-MM-DD</code>. <code>international</code>: <code>true</code> чи <code>false</code>. <code>funding</code>: JSON-масив, наприклад <code>[{"year":2026,"amountUAH":120000}]</code>. Експортований приклад правильно екранує лапки. Поле <code>id</code> унікальне в межах набору. Суми невід’ємні, у гривнях.</p><h3>Джерело поточного набору</h3><p>${e(i.sourceNote||'Не вказано')}</p><p>Оновлено: ${date(data.updatedAt)}. ${data.demo?'Набір демонстраційний.':'Набір позначено як власні дані.'} Усі суми подаються у гривневому еквіваленті, конвертація валют виконується до імпорту.</p></div>`;
  return `<div class="current-data"><div class="section-head"><div><h3>Поточний набір даних</h3><p>${e(i.shortName)} · оновлено ${date(data.updatedAt)}</p></div>${pill(data.demo?'Демонстрація':'Власні дані',data.demo?'amber':'green')}</div><div class="dataset-counts">${datasetCounts(data)}</div></div><div class="import-description"><h3>Оновіть свою аналітику</h3><p>Оберіть CSV, XLSX або JSON. XLSX підтримує повну книгу з налаштуваннями або окрему таблицю. Спочатку перевіримо формат, потім покажемо зміни для застосування.</p></div><div class="transfer-selectors"><label class="import-type">Формат<select id="import-format"><option value="json">JSON</option><option value="csv">CSV</option><option value="xlsx">XLSX · Excel</option></select></label><label class="import-type">Обсяг імпорту<select id="import-type" disabled><option value="bundle">Повний набір і налаштування</option>${DATASETS.map(k=>`<option value="${k}">${e(({revenues:'Надходження',...BLOCKS})[k])}</option>`).join('')}</select></label></div><label class="dropzone" id="dropzone"><input id="file-input" type="file" accept=".json"><span class="upload-symbol">${icon('upload')}</span><strong>Оберіть файл або перетягніть сюди</strong><span>JSON, CSV або XLSX · до 5 МБ</span><span class="button secondary small">Обрати файл</span></label><div id="import-result" aria-live="polite"></div><div class="import-help"><span>${icon('info')}Потрібен приклад структури?</span><button class="text-link" data-action="example">Завантажити JSON ${icon('download')}</button><button class="text-link" data-action="format">Опис формату ${icon('arrow')}</button></div><div class="local-storage-note">${icon('info')}<span>Дані обробляються у браузері та не надсилаються на сервер. CSV замінює одну таблицю; XLSX — одну таблицю або весь набір; JSON — увесь набір і налаштування. Експортуйте резервну копію перед заміною.</span></div><div class="dialog-actions"><button class="text-link" data-action="export">${icon('download')}Експорт поточного набору</button><button class="text-link danger" data-action="reset">Відновити початковий набір</button></div>`;
}
function openManager(tab='import') {
  closeMenu();
  if(managerTab==='styles')applySiteStyles(data.institution.styles);
  if(tab==='styles'){styleDraft=structuredClone(data.institution.styles||defaultSiteStyles());editingStyleId=styleDraft.defaultPreset;}else styleDraft=null;
  importTicket++;pending=null;managerTab=tab;
  const titles={styles:'Стилі сайта',import:'Керування даними',settings:'Налаштування університету',format:'Формат даних і методологія',export:'Експорт даних'};
  $('#manager').innerHTML=`<div class="dialog-heading"><div><div class="eyebrow">ВАША ПЛАТФОРМА АНАЛІТИКИ</div><h2 id="dialog-title">${titles[tab]}</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Закрити">${icon('close')}</button></div><div class="dialog-tabs">${[['import','Імпорт'],['export','Експорт'],['settings','Університет'],['styles','Стилі'],['format','Формат і правила']].map(([t,label])=>`<button data-tab="${t}" class="${tab===t?'selected':''}">${label}</button>`).join('')}</div><div class="dialog-body">${managerContent()}</div>`;
  if(!$('#manager').open) $('#manager').showModal();
  $('#manager').scrollTop=0;
  if(tab==='export')updateExportControls();
  if(tab==='styles')previewStyleDraft();
}
async function readImport(file) {
  if(!file)return;
  const ticket = ++importTicket;
  pending=null; const result=$('#import-result'); result.innerHTML='';
  try {
    if(file.size>5*1024*1024)throw new Error('Файл перевищує 5 МБ. Розділіть дані на окремі CSV-набори.');
    const type=$('#import-type').value, format=$('#import-format').value;
    if(!file.name.toLowerCase().endsWith('.'+format)) throw new Error(`Оберіть файл .${format} або змініть формат імпорту.`);
    result.innerHTML='<p class="muted">Перевіряємо файл…</p>';
    let next;
    if(format==='xlsx') next=await importXLSX(await file.arrayBuffer(),type,data);
    else {
      const source=await file.text();
      if(format==='json'){let raw;try{raw=JSON.parse(source.replace(/^\uFEFF/,''));}catch{throw new Error('JSON не вдалося прочитати. Перевірте коми, лапки та структуру файлу.');}next=validateBundle(raw);}
      else next=importCSV(source,type,data);
    }
    if(ticket!==importTicket||!$('#manager').open||managerTab!=='import'||!result.isConnected||$('#import-type').value!==type||$('#import-format').value!==format)return;
    pending=next;
    result.innerHTML=`<div class="import-preview"><h3>${icon('check')}Формат перевірено</h3><p><strong>${e(file.name)}</strong> · ${e(next.institution.shortName)} · ${yearsIn(next).length} звітних років</p><div class="dataset-counts">${datasetCounts(next)}</div><p>${type==='bundle'?'Буде замінено весь набір даних і налаштування університету.':`Буде замінено всі записи таблиці «${e(({revenues:'Надходження',...BLOCKS})[type])}» за всі роки. Інші таблиці та позначка демонстрації збережуться.`}</p>${next.demo?'<p class="muted">Набір залишається демонстраційним. Для власних даних імпортуйте повний JSON або XLSX із demo: false, замінивши всі умовні записи.</p>':''}<button class="button primary" data-action="apply-import">${icon('check')}Застосувати імпорт</button></div>`;
  }catch(err){if(ticket!==importTicket||!result.isConnected)return;result.innerHTML=`<div class="form-error error-box" role="alert"><strong>Імпорт не застосовано</strong><p>${e(err.message)}</p></div>`;}
}
function afterDataChange() { const years=yearsIn(data);if(!years.includes(year))year=years.at(-1)||new Date().getFullYear();resetFilters();render(); }
async function handleAction(action,target) {
  if(action==='import'||action==='settings'||action==='format')openManager(action);
  if(action==='close-dialog'){$('#manager').close();applySiteStyles(data.institution.styles);}
  if(action.startsWith('style-'))styleAction(action);
  if(action==='menu'){const open=$('#sidebar').classList.toggle('open');$('[data-action="menu"]').setAttribute('aria-expanded',String(open));}
  if(action==='close-menu')closeMenu();
  if(action==='export'){exportTarget='bundle';openManager('export');}
  if(action==='backup-export')download(`${data.institution.shortName}-science.json`,JSON.stringify(data,null,2));
  if(action==='example')download('example-science.json',JSON.stringify(demo,null,2));
  if(action==='template'){const key=target.dataset.dataset;download(`${key}-example.csv`,toCSV({...demo,[key]:demo[key].slice(0,2)},key),'text/csv;charset=utf-8');}
  if(action==='csv-export'){exportTarget=target.dataset.dataset;openManager('export');}
  if(action==='xlsx-template'){try{const key=target.dataset.dataset;const example={...demo,[key]:demo[key].slice(0,2)};download(`${key}-example.xlsx`,await toXLSX(example,key),XLSX_MIME);}catch(err){toast(err.message);}}
  if(action==='apply-import'&&pending){persist(pending);pending=null;afterDataChange();$('#manager').close();toast(storageAvailable?'Дані імпортовано та збережено в цьому браузері.':'Дані імпортовано. Експортуйте JSON для збереження.');}
  if(action==='reset'){$('.dialog-body').innerHTML=`<div class="reset-confirm">${icon('info')}<h3>Відновити початковий набір?</h3><p>Локальні дані й налаштування будуть замінені набором із сервера. Спочатку збережіть резервну копію.</p><div class="dialog-actions"><button class="button secondary" data-action="backup-export">Експортувати копію</button><button class="button secondary" data-action="import">Скасувати</button><button class="button primary" data-action="confirm-reset">Відновити</button></div></div>`;pending=null;}
  if(action==='confirm-reset'){persist(structuredClone(demo));afterDataChange();$('#manager').close();toast('Початковий набір відновлено.');}
  if(action==='clear-filters'){resetFilters();render();}
  if(action==='prev-page'||action==='next-page'){page+=action==='prev-page'?-1:1;$('#records-body').innerHTML=tableBody(route);}
}
function closeMenu() { $('#sidebar').classList.remove('open');$('[data-action="menu"]')?.setAttribute('aria-expanded','false'); }
document.addEventListener('keydown',ev=>{if(ev.key==='Escape')closeMenu();});
document.addEventListener('click',ev=>{
  if(ev.target.closest('#sidebar a'))closeMenu();
  if(!ev.target.closest('#sidebar')&&!ev.target.closest('[data-action="menu"]'))closeMenu();
  const action=ev.target.closest('[data-action]');if(action){handleAction(action.dataset.action,action);return;}
  const y=ev.target.closest('[data-year]');if(y){year=+y.dataset.year;resetFilters();render();return;}
  const tab=ev.target.closest('[data-tab]');if(tab){openManager(tab.dataset.tab);return;}
  const status=ev.target.closest('[data-project-status]');if(status){projectStatus=status.dataset.projectStatus;render();}
});
document.addEventListener('change',ev=>{
  const el=ev.target;
  if(el.id==='style-preset'&&styleDraft){editingStyleId=el.value;refreshStyleEditor();}
  if(el.id==='style-default'&&styleDraft){styleDraft.defaultPreset=el.value;editingStyleId=el.value;refreshStyleEditor();}
  if(el.id==='theme-select'||el.name==='displayTheme')applyTheme(el.value);
  if(el.id==='all-years'){year=+el.value;resetFilters();render();}
  if(el.id==='faculty-filter'||el.id==='quartile-filter'||el.id==='index-filter'){if(el.id==='faculty-filter')faculty=el.value;if(el.id==='quartile-filter')quartile=el.value;if(el.id==='index-filter')indexFilter=el.value;page=1;$('#records-body').innerHTML=tableBody(route);}
  if(el.id==='file-input')readImport(el.files[0]);
  if(el.id==='import-type'||el.id==='import-format')updateImportControls();
  if(el.id==='export-format'||el.id==='export-type')updateExportControls();
});
document.addEventListener('input',ev=>{if(ev.target.id==='search'){query=ev.target.value;page=1;$('#records-body').innerHTML=tableBody(route);}});
document.addEventListener('input',ev=>{
  const el=ev.target;if(!styleDraft||!el.closest('#site-styles-form'))return;
  const preset=styleDraft.presets.find(p=>p.id===editingStyleId);
  if(el.dataset.styleValue)preset.values[el.dataset.styleValue]=el.value===''?NaN:Number(el.value);
  if(el.id==='style-preset-name'){
    preset.name=el.value;
    for(const select of [$('#style-preset'),$('#style-default')])for(const option of select.options)if(option.value===preset.id)option.textContent=preset.name;
  }
  previewStyleDraft();
});
$('#manager').addEventListener('close',()=>{applySiteStyles(data.institution.styles);styleDraft=null;});
$('#manager').addEventListener('cancel',()=>applySiteStyles(data.institution.styles));
document.addEventListener('submit',ev=>{
  if(ev.target.id==='site-styles-form'){
    ev.preventDefault();
    try{const styles=validateSiteStyles(styleDraft);persist(validateBundle({...data,institution:{...data.institution,styles}}));styleDraft=null;render();$('#manager').close();toast(storageAvailable?'Стилі та пресет за замовчуванням збережено.':'Стилі застосовано. Експортуйте JSON для збереження.');}
    catch(err){$('#style-error').textContent=err.message;}
    return;
  }
  if(ev.target.id==='export-form'){ev.preventDefault();performExport(ev.target);return;}
  if(ev.target.id!=='settings-form')return;ev.preventDefault();
  try{const form=new FormData(ev.target);const next=validateBundle({...data,institution:{...data.institution,...Object.fromEntries(['shortName','name','subtitle','accent','website','sourceNote'].map(k=>[k,form.get(k)])),blocks:form.getAll('blocks')}});persist(next);render();$('#manager').close();toast(storageAvailable?'Налаштування збережено.':'Налаштування застосовано. Експортуйте JSON для збереження.');}
  catch(err){$('#form-error').textContent=err.message;}
});
document.addEventListener('dragover',ev=>{if(ev.target.closest('#dropzone')){ev.preventDefault();$('#dropzone').classList.add('dragging');}});
document.addEventListener('dragleave',ev=>{if(ev.target.closest('#dropzone'))$('#dropzone').classList.remove('dragging');});
document.addEventListener('drop',ev=>{if(ev.target.closest('#dropzone')){ev.preventDefault();$('#dropzone').classList.remove('dragging');readImport(ev.dataTransfer.files[0]);}});
window.addEventListener('hashchange',setRoute);
try {
  const response=await fetch('./data/demo.json');if(!response.ok)throw new Error('Не вдалося завантажити початковий набір даних.');demo=validateBundle(await response.json());
  let stored;try{stored=localStorage.getItem(STORE);}catch{storageAvailable=false;}
  if(stored){try{data=validateBundle(JSON.parse(stored));}catch{data=structuredClone(demo);toast('Локальний набір пошкоджено або застарів. Завантажено початкові дані; збережений запис не видалено.');}}else data=structuredClone(demo);
  const years=yearsIn(data);year=years.includes(new Date().getFullYear())?new Date().getFullYear():years.at(-1)||new Date().getFullYear();
  cms=createCMS({
    getData:()=>data,dataStorageKey:()=>STORE,getYear:()=>year,selectPreviewYear:value=>{if(yearsIn(data).includes(value)){year=value;resetFilters();}},isAdmin:()=>route==='admin',rerender:render,notify:toast,download,
    renderHeader:header,renderExisting:existingPage,renderAnalytics:analyticsBlock,renderMetricHTML:renderMetricReference,getBlockTable:analyticsTable,getBlockPeriod:displayedBlockPeriod,
    replaceData:(next,write=true)=>{if(write)persist(next);else data=next;const years=yearsIn(next);if(!years.includes(year))year=years.at(-1)||new Date().getFullYear();resetFilters();},
    openDataManager:(mode,source)=>{
      const key=({stats:'bundle',publicationChart:'publications',quartiles:'publications',faculties:'publications',publications:'publications',projects:'projects',patents:'patents',funding:'revenues',overview:'bundle'})[source]||'bundle';
      if(mode==='export'){exportTarget=key;openManager('export');}
      else{openManager('import');if(key!=='bundle'){$('#import-format').value='csv';updateImportControls();$('#import-type').value=key;}}
    }
  });
  const pagesResponse=await fetch('./data/pages.json');if(!pagesResponse.ok)throw new Error('Не вдалося завантажити сторінки сайта.');cms.init(await pagesResponse.json());
  setRoute();
}catch(err){$('#content').innerHTML=`<div class="empty"><h1>Не вдалося завантажити дані</h1><p>${e(err.message)}</p><p>Перевірте файл data/demo.json та його відповідність формату.</p></div>`;}
