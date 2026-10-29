import { BLOCKS, DATASETS, CSV_HEADERS, validateBundle, yearsIn, summarize, importCSV, toCSV, groupCount } from './data.js';
import { icon } from './icons.js?v=text-background-20261030';
import './vendor/exceljs.min.js';
import { importXLSX, toXLSX } from './spreadsheet.js';
import { createCMS } from './cms.js?v=text-background-20261030';
import { cmsRoute, defaultBlockSettings, formatBlockPeriod, inferTablePeriod } from './cms-data.js?v=text-background-20261030';
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
  return `<div class="page-heading"><div><div class="eyebrow"><span></span>${eyebrow}</div><h1>${e(title)}<span class="title-dot">.</span></h1><p>${e(sub)}</p></div><div class="heading-actions"><button class="button secondary" data-action="export">${icon('download')}<span>Експорт даних</span></button><button class="button primary" data-action="import">${icon('upload')}<span>Імпорт даних</span></button></div></div>
  ${!cmsPage || cmsPage.showYear ? `<div class="period-bar"><div class="period-label">${icon('calendar')}<strong>Звітний період</strong><span>Оберіть рік для перегляду</span></div><div class="year-tabs" role="group" aria-label="Звітний рік">${(years.length ? years : [year]).slice(-8).map(y => `<button data-year="${y}" class="${year === y ? 'selected' : ''}" aria-pressed="${year === y}">${y}</button>`).join('')}${years.length > 8 ? `<select aria-label="Усі роки" id="all-years">${years.map(y => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('')}</select>` : ''}</div></div>` : ''}
  ${route==='admin' && data.demo && (!cmsPage || cmsPage.blocks.some(b=>b.visible && ['analytics','existing'].includes(b.type))) ? `<div class="notice demo-notice">${icon('info')}<span><strong>Демонстраційний набір.</strong> Усі показники та записи умовні. Завантажте дані вашого університету для формування звітності.</span><button data-action="import">Додати свої дані ${icon('arrow')}</button></div>` : ''}`;
}
function delta(now, prev, exists) {
  if (!exists || !prev) return '<span class="muted">немає бази порівняння</span>';
  const d = ((now - prev) / prev * 100);
  return `<span class="delta ${d < 0 ? 'negative' : ''}">${d >= 0 ? '↗' : '↘'} ${d > 0 ? '+' : ''}${d.toFixed(1).replace('.', ',')}%</span><span class="muted">до ${year - 1}</span>`;
}
function stat(label, value, unit, ico, detail, color='') { return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${color}">${icon(ico)}</span></div><div class="stat-value">${value}<small>${unit}</small></div><div class="stat-detail">${detail}</div></article>`; }
function stats() {
  const s = summarize(data, year), prev = summarize(data, year - 1), hasPrev = yearsIn(data).includes(year - 1);
  let cards = [];
  if (data.institution.blocks.includes('publications')) cards.push(stat('Наукових публікацій', fmt(s.publications.length), '', 'book', delta(s.publications.length, prev.publications.length, hasPrev)), stat('Scopus / Web of Science', fmt(s.indexed.length), '', 'globe', `${pill('Індексуються', 'green')}<span class="muted">${s.publications.length ? Math.round(s.indexed.length / s.publications.length * 100) : 0}% від усіх</span>`, 'blue'), stat('Публікацій Q1–Q2', fmt(s.q12), '', 'award', `<span class="muted">${s.indexed.length ? Math.round(s.q12 / s.indexed.length * 100) : 0}% індексованих публікацій</span>`, 'violet'));
  if (data.institution.blocks.includes('projects')) cards.push(stat('Грантових проєктів', fmt(s.projects.length), '', 'layers', `<span class="muted">Виконуються у ${year} році</span>`, 'amber'), stat('Надходження грантів', money(s.grants), 'млн ₴', 'wallet', `<span class="muted">${s.grants ? Math.round(s.international / s.grants * 100) : 0}% — міжнародні програми</span>`));
  if (data.institution.blocks.includes('patents')) cards.push(stat('Патентів отримано', fmt(s.patents.length), '', 'file', delta(s.patents.length, prev.patents.length, hasPrev), 'blue'));
  if (route === 'funding') cards = [stat('Надходження на науку', money(s.revenue), s.revenue == null ? '' : 'млн ₴', 'wallet', s.revenue == null ? `<span class="muted">Дані за ${year} рік не завантажено</span>` : delta(s.revenue, prev.revenue, prev.revenue != null)), stat('Джерел фінансування', fmt(new Set(data.revenues.filter(x => x.year === year).map(x => x.source)).size), '', 'layers', '<span class="muted">У поточному наборі даних</span>', 'blue')];
  return cards.length ? `<div class="stats-grid ${cards.length === 2 ? 'two' : ''}">${cards.join('')}</div>` : '';
}
function chartYears(type) {
  const all = type === 'publications' ? [...new Set(data.publications.map(p => p.year))].sort((a,b) => a-b) : yearsIn(data);
  if (all.length <= 8) return all;
  const selected = all.findIndex(y => y >= year);
  const end = Math.max(8, selected < 0 ? all.length : selected + 1);
  return all.slice(end - 8, end);
}
function barChart(type) {
  const years = chartYears(type), items = years.map(y => {
    const s = summarize(data, y);
    return { year:y, a:type === 'publications' ? s.indexed.length : type === 'projects' ? s.projects.length : (s.revenue ?? 0) / 1e6, b:type === 'publications' ? s.publications.length - s.indexed.length : 0, missing:type === 'funding' && s.revenue == null };
  });
  if (!items.length) return empty('Немає даних для графіка');
  const max = Math.max(1, ...items.map(x => x.a + x.b));
  const ceiling = type === 'funding' ? Math.ceil(max) : Math.ceil(max / (max > 50 ? 25 : 5)) * (max > 50 ? 25 : 5);
  return `<div class="bar-chart" role="img" aria-label="${e(type === 'publications' ? 'Публікації' : type === 'projects' ? 'Проєкти' : 'Надходження, млн грн')} за роками"><div class="chart-y">${[1, .75, .5, .25, 0].map(n => `<span>${fmt(+(ceiling*n).toFixed(2))}</span>`).join('')}</div><div class="plot"><div class="grid-lines">${'<span></span>'.repeat(5)}</div><div class="chart-columns">${items.map(x => `<div class="chart-column ${x.year === year ? 'current' : ''}"><div class="bar-value">${x.missing ? '—' : fmt(+(x.a+x.b).toFixed(2))}</div><div class="bar-stack" style="height:${(x.a+x.b)/ceiling*100}%" title="${x.year}: ${x.missing ? 'немає даних' : fmt(+(x.a+x.b).toFixed(2))}${type === 'publications' ? `, індексованих: ${x.a}, інших: ${x.b}` : ''}"><div class="bar-secondary" style="flex:${x.b}"></div><div class="bar-main" style="flex:${x.a}"></div></div><span class="bar-year">${x.year}</span></div>`).join('')}</div></div></div>`;
}
function publicationChart() {
  return `<article class="panel trend-panel">${sectionHead('Публікації за роками', 'Динаміка наукових результатів університету', pill(chartYears('publications').length ? `${chartYears('publications')[0]}—${chartYears('publications').at(-1)}` : 'Немає даних'))}<div class="chart-legend"><span><i class="legend-square"></i>Scopus / Web of Science</span><span><i class="legend-square light"></i>Інші публікації</span></div>${barChart('publications')}<div class="chart-footnote">${icon('info')} Кожна публікація враховується один раз, навіть за індексації в обох базах.</div></article>`;
}
const QCOLORS = ['var(--chart-q1)', 'var(--chart-q2)', 'var(--chart-q3)', 'var(--chart-q4)', 'var(--chart-qnone)'];
function quartileChart() {
  const s = summarize(data, year); const keys = ['Q1','Q2','Q3','Q4',null];
  const counts = keys.map(q => s.indexed.filter(x => x.quartile === q).length);
  let pos = 0; const stops = counts.map((n, i) => { const start = pos; pos += n/(s.indexed.length || 1)*100; return `${QCOLORS[i]} ${start}% ${pos}%`; });
  return `<article class="panel quartile-panel">${sectionHead('Якість публікацій', 'Розподіл Scopus / WoS за квартилями', pill(String(year)))}<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${s.indexed.length ? stops.join(',') : '#eef1f4 0% 100%'})" role="img" aria-label="Розподіл за квартилями: ${keys.map((q,i)=>`${q||'Без квартиля'}: ${counts[i]}`).join(', ')}"><div><strong>${fmt(s.indexed.length)}</strong><span>публікацій</span></div></div></div><div class="quartile-legend">${keys.map((q,i)=>`<div><span><i style="background:${QCOLORS[i]}"></i>${q || 'Без квартиля'}</span><strong>${counts[i]}</strong><small>${s.indexed.length ? Math.round(counts[i]/s.indexed.length*100) : 0}%</small></div>`).join('')}</div></article>`;
}
function facultyPanel(records, title='Внесок факультетів') {
  const groups = groupCount(records,'faculty'), max = Math.max(1,...groups.map(x=>x[1]));
  return `<article class="panel faculty-panel">${sectionHead(title,'За кількістю записів у вибраному році')}${groups.length ? `<div class="rank-bars">${groups.map(([name,n],i)=>`<div class="rank-row"><span class="rank-number">${String(i+1).padStart(2,'0')}</span><div><div class="rank-caption"><span>${e(name)}</span><strong>${fmt(n)}</strong></div><div class="rank-track"><span style="width:${n/max*100}%"></span></div></div></div>`).join('')}</div>` : empty()}</article>`;
}
function projectCard(p) {
  return `<article class="project-card"><div class="project-card-top">${pill(p.program,p.international ? 'green' : 'blue')}${p.international ? `<span title="Міжнародний проєкт">${icon('globe')}</span>` : ''}</div><h3>${linkTitle(p)}</h3><div class="project-meta"><span>${icon('calendar')}${date(p.startDate)} — ${date(p.endDate)}</span><span>${icon('layers')}${e(p.role)}</span></div><div class="project-money"><span>Надходження у ${year}</span><strong>${money(p.funding.find(x=>x.year===year)?.amountUAH ?? 0)}<small> млн ₴</small></strong></div></article>`;
}
function overview() {
  const s = summarize(data,year), enabled = key => data.institution.blocks.includes(key);
  return `${stats()}${enabled('publications') ? `<div class="chart-grid">${publicationChart()}${quartileChart()}</div>` : ''}
  ${enabled('projects') ? `<section class="projects-section">${sectionHead('Дослідження без кордонів',`Проєкти, що виконуються у ${year} році`,viewLink('projects','Усі проєкти'))}<div class="project-grid">${s.projects.length ? s.projects.slice(0,3).map(projectCard).join('') : empty('Немає проєктів у вибраному році')}</div></section>` : ''}
  ${enabled('publications') ? `<div class="overview-bottom">${facultyPanel(s.publications)}<article class="insight-card"><div class="insight-top">${icon('globe')}<span>ВІДКРИТА НАУКА</span></div><h2>Знання мають<br>бути доступними.</h2><p>Публікації, дослідження та винаходи університету — в одному просторі даних.</p><a href="#publications">Дослідити публікації ${icon('arrow')}</a><div class="orbit one"></div><div class="orbit two"></div><div class="orbit three"></div></article></div>` : ''}
  ${enabled('patents') && !enabled('publications') ? facultyPanel(s.patents,'Патенти за факультетами') : ''}
  ${enabled('funding') ? `<div class="notice source-notice">${icon('info')}<span><strong>Надходження на науку у ${year} році:</strong> ${s.revenue == null ? 'дані не завантажено' : `${money(s.revenue)} млн ₴`}. Грантові кошти обліковуються окремо; ці суми не додаються автоматично.</span>${viewLink('funding','Детальніше')}</div>` : ''}
  ${!data.institution.blocks.length ? empty('Блоки аналітики вимкнено','Увімкніть потрібні розділи в налаштуваннях.') : ''}`;
}
function toolbar(kind) {
  const pub = kind === 'publications';
  const faculties = [...new Set(data[kind].filter(x=>pub ? x.year===year : +x.date.slice(0,4)===year).map(x=>x.faculty))].sort();
  return `<div class="table-toolbar"><label class="search-field">${icon('search')}<input id="search" type="search" placeholder="${pub ? 'Назва публікації або автор…' : 'Назва, номер патенту або автор…'}" value="${e(query)}" aria-label="Пошук ${pub ? 'публікацій' : 'патентів'}"></label><select id="faculty-filter" aria-label="Факультет"><option value="">Усі факультети</option>${faculties.map(f=>`<option value="${e(f)}" ${f===faculty?'selected':''}>${e(f)}</option>`).join('')}</select>${pub ? `<select id="index-filter" aria-label="Індексація"><option value="">Уся індексація</option>${['Scopus','WoS','none'].map(v=>`<option value="${v}" ${v===indexFilter?'selected':''}>${v==='none'?'Без індексації':v==='WoS'?'Web of Science':v}</option>`).join('')}</select><select id="quartile-filter" aria-label="Квартиль"><option value="">Усі квартилі</option>${['Q1','Q2','Q3','Q4','none'].map(q=>`<option value="${q}" ${q===quartile?'selected':''}>${q==='none'?'Без квартиля':q}</option>`).join('')}</select>` : ''}</div>`;
}
function filteredRows(kind) {
  return data[kind].filter(x=>(kind==='publications'?x.year===year:+x.date.slice(0,4)===year) && (!faculty||x.faculty===faculty) && (!query||`${x.title} ${x.authors} ${x.number||''}`.toLocaleLowerCase('uk').includes(query.toLocaleLowerCase('uk'))) && (kind!=='publications'||((!quartile || (quartile==='none'?!x.quartile:x.quartile===quartile))&&(!indexFilter||(indexFilter==='none'?!x.indexes.length:x.indexes.includes(indexFilter)))))).sort((a,b)=>kind==='patents'?b.date.localeCompare(a.date):a.title.localeCompare(b.title,'uk'));
}
function tableBody(kind, showAll = cms?.getPage(route)?.blocks.find(b=>b.type==='analytics'&&b.source===kind)?.settings?.showAll || false) {
  const rows = filteredRows(kind), pages = Math.max(1,Math.ceil(rows.length/10)); page = Math.min(page,pages);
  const pub = kind==='publications';
  return `<div class="results-meta"><span>Знайдено <strong>${fmt(rows.length)}</strong> ${pub ? 'публікацій' : 'патентів'}</span>${query||faculty||quartile||indexFilter ? '<button class="text-link" data-action="clear-filters">Скинути фільтри</button>' : `<span>${year} рік</span>`}</div>${rows.length ? `<div class="table-scroll"><table><thead><tr><th>${pub?'Публікація та автори':'Патент та винахідники'}</th>${pub?'<th>Факультет</th><th>Індексація</th><th>Квартиль</th>':'<th>Номер</th><th>Дата реєстрації</th>'}</tr></thead><tbody>${(showAll?rows:rows.slice((page-1)*10,page*10)).map(r=>`<tr><td class="title-cell"><strong>${linkTitle(r)}</strong><span>${e(r.authors)}</span>${pub?`<small>${e(r.type)}</small>`:''}</td>${pub?`<td class="faculty-cell">${e(r.faculty)}</td><td>${r.indexes.length?r.indexes.map(i=>pill(i==='WoS'?'Web of Science':i,'blue')).join(' '):'<span class="muted">Без індексації</span>'}</td><td>${r.quartile?pill(r.quartile,['Q1','Q2'].includes(r.quartile)?'green':'neutral'):'—'}</td>`:`<td><span class="patent-number">${e(r.number)}</span></td><td class="nowrap">${date(r.date)}</td>`}</tr>`).join('')}</tbody></table></div>${showAll?'':`<div class="pagination"><span>${(page-1)*10+1}–${Math.min(page*10,rows.length)} із ${fmt(rows.length)}</span><div><button class="button secondary small" data-action="prev-page" ${page<=1?'disabled':''}>Назад</button><span>${page} / ${pages}</span><button class="button secondary small" data-action="next-page" ${page>=pages?'disabled':''}>Далі</button></div></div>`}`:empty()}`;
}
function recordsPage(kind) {
  const pub=kind==='publications', s=summarize(data,year);
  return `${pub?`<div class="chart-grid">${publicationChart()}${quartileChart()}</div>`:`<div class="patents-summary">${stat('Отримано патентів',fmt(s.patents.length),'','award','<span class="muted">За датою реєстрації у вибраному році</span>')}${facultyPanel(s.patents,'Винахідницька активність')}</div>`}<section class="panel records-panel">${sectionHead(pub?'Каталог публікацій':'Реєстр патентів',pub?'Усі публікації, включно з неіндексованими':'Патенти на винаходи та корисні моделі',`<button class="button secondary small" data-action="csv-export" data-dataset="${kind}">${icon('download')}CSV / XLSX</button>`)}${toolbar(kind)}<div id="records-body">${tableBody(kind)}</div></section>${pub?facultyPanel(s.publications):''}`;
}
function projectsPage() {
  const s=summarize(data,year), now=today();
  const rows=s.projects.filter(p=>projectStatus==='all'||(projectStatus==='international'?p.international:projectStatus==='coordinator'?p.role==='Координатор':p.startDate<=now&&p.endDate>=now));
  const byProgram = new Map(); s.projects.forEach(p=>byProgram.set(p.program,(byProgram.get(p.program)||0)+(p.funding.find(x=>x.year===year)?.amountUAH||0)));
  const max=Math.max(1,...byProgram.values());
  return `<div class="chart-grid"><article class="panel">${sectionHead('Проєкти за роками','Проєкт враховується в кожному році його виконання')}${barChart('projects')}</article><article class="panel">${sectionHead('Кошти за програмами',`Надходження у ${year} році, млн ₴`)}<div class="program-bars">${byProgram.size?[...byProgram].sort((a,b)=>b[1]-a[1]).map(([name,n])=>`<div class="rank-caption"><span>${e(name)}</span><strong>${money(n)}</strong></div><div class="rank-track"><span style="width:${n/max*100}%"></span></div>`).join(''):empty()}</div></article></div><section>${sectionHead('Портфель проєктів',`${rows.length} проєктів · ${year} рік`,`<button class="button secondary small" data-action="csv-export" data-dataset="projects">${icon('download')}CSV / XLSX</button>`)}<div class="filter-tabs" role="group" aria-label="Фільтр проєктів">${[['all','Усі проєкти'],['international','Міжнародні'],['coordinator','Координатор'],['active','Активні сьогодні']].map(([id,label])=>`<button data-project-status="${id}" class="${projectStatus===id?'selected':''}" aria-pressed="${projectStatus===id}">${label}</button>`).join('')}</div><div class="project-grid">${rows.length?rows.map(projectCard).join(''):empty('Немає проєктів за вибраними умовами',projectStatus==='active'?`Фільтр перевіряє дати станом на ${date(now)} і належність до звітного року.`:'Оберіть інший рік або фільтр.')}</div></section>`;
}
function fundingPage() {
  const years=yearsIn(data), sources=[...new Set(data.revenues.map(r=>r.source))];
  const current=data.revenues.filter(x=>x.year===year), grouped=new Map(); current.forEach(x=>grouped.set(x.source,(grouped.get(x.source)||0)+x.amountUAH));
  const max=Math.max(1,...grouped.values());
  return `${stats()}<div class="chart-grid"><article class="panel">${sectionHead('Надходження за роками','Фактичні надходження, млн ₴')}${barChart('funding')}</article><article class="panel">${sectionHead('Джерела фінансування',`${year} рік · млн ₴`)}<div class="program-bars">${grouped.size?[...grouped].map(([name,n])=>`<div class="rank-caption"><span>${e(name)}</span><strong>${money(n)}</strong></div><div class="rank-track"><span style="width:${n/max*100}%"></span></div>`).join(''):empty('Дані за цей рік не завантажено','Відсутність записів не означає нульове фінансування.')}</div></article></div><section class="panel">${sectionHead('Надходження за джерелами','Усі суми у гривнях. «—» означає відсутність даних.',`<button class="button secondary small" data-action="csv-export" data-dataset="revenues">${icon('download')}CSV / XLSX</button>`)}${sources.length?`<div class="table-scroll"><table class="funding-table"><thead><tr><th>Джерело надходжень</th>${years.map(y=>`<th class="${y===year?'year-highlight':''}">${y}</th>`).join('')}</tr></thead><tbody>${sources.map(source=>`<tr><td>${e(source)}</td>${years.map(y=>{const r=data.revenues.filter(x=>x.year===y&&x.source===source);return `<td class="${y===year?'year-highlight':''}">${r.length?fmt(r.reduce((s,x)=>s+x.amountUAH,0)):'—'}</td>`;}).join('')}</tr>`).join('')}<tr class="total-row"><td>Разом</td>${years.map(y=>`<td class="${y===year?'year-highlight':''}">${summarize(data,y).revenue==null?'—':fmt(summarize(data,y).revenue)}</td>`).join('')}</tr></tbody></table></div>`:empty()}</section><div class="notice">${icon('info')}<span>Грантові надходження показані в розділі «Грантові проєкти» окремо. Підсумки джерел можуть включати гранти — уникайте подвійного обліку.</span></div>`;
}
function existingPage(source) {
  const previous = route;
  try { route = source; return source==='overview'?overview():source==='publications'||source==='patents'?recordsPage(source):source==='projects'?projectsPage():fundingPage(); }
  finally { route = previous; }
}
function analyticsTable(source, allYears = false) {
  const selected=allYears?null:year, s=summarize(data,year), table=(headers,rows)=>({headers,rows:rows.map(r=>r.map(v=>String(v??'')))});
  if(['stats','fundingStats','patentStats'].includes(source)){
    const cards=source==='fundingStats'?[['Надходження на науку',s.revenue==null?'—':money(s.revenue),'млн ₴',`${year} рік`],['Джерел фінансування',new Set(data.revenues.filter(r=>r.year===year).map(r=>r.source)).size,'','За вибраний рік']]:source==='patentStats'?[['Патентів отримано',s.patents.length,'',`${year} рік`]]:[['Наукових публікацій',s.publications.length,'',`${year} рік`],['Scopus / Web of Science',s.indexed.length,'','Індексовані публікації'],['Публікацій Q1–Q2',s.q12,'','Серед індексованих'],['Грантових проєктів',s.projects.length,'',`Виконуються у ${year} році`],['Надходження грантів',money(s.grants),'млн ₴','За вибраний рік'],['Патентів отримано',s.patents.length,'',`${year} рік`]];
    return table(['label','value','unit','note'],cards);
  }
  if(source==='publicationChart')return table(['Рік','Scopus / Web of Science','Інші публікації'],[...new Set(data.publications.map(p=>p.year))].sort().filter(y=>selected===null||y===selected).map(y=>{const x=summarize(data,y);return[y,x.indexed.length,x.publications.length-x.indexed.length];}));
  if(source==='quartiles'){const rows=(allYears?data.publications:s.publications).filter(p=>p.indexes.length);return table(['Квартиль','Публікацій'],['Q1','Q2','Q3','Q4',null].map(q=>[q||'Без квартиля',rows.filter(p=>p.quartile===q).length]));}
  if(source==='projectChart')return table(['Рік','Проєктів'],yearsIn(data).filter(y=>selected===null||y===selected).map(y=>[y,summarize(data,y).projects.length]));
  if(source==='funding')return table(['Рік','Надходження, млн ₴'],yearsIn(data).filter(y=>selected===null||y===selected).map(y=>[y,summarize(data,y).revenue==null?'':summarize(data,y).revenue/1e6]));
  if(['faculties','patentFaculties'].includes(source)){const rows=source==='faculties'?(allYears?data.publications:s.publications):(allYears?data.patents:s.patents);return table(['Факультет','Кількість'],groupCount(rows,'faculty'));}
  if(['programs','fundingSources'].includes(source)){
    const groups=new Map();
    if(source==='programs'){for(const p of allYears?data.projects:s.projects)for(const f of p.funding)if(selected===null||f.year===selected)groups.set(p.program,(groups.get(p.program)||0)+f.amountUAH/1e6);}
    else {for(const r of data.revenues)if(selected===null||r.year===selected)groups.set(r.source,(groups.get(r.source)||0)+r.amountUAH/1e6);}
    return table([source==='programs'?'Програма':'Джерело','Надходження, млн ₴'],[...groups]);
  }
  if(source==='fundingTable'){const ys=yearsIn(data).filter(y=>selected===null||y===selected).slice(-11),sources=[...new Set(data.revenues.map(r=>r.source))];return table(['Джерело',...ys.map(String)],sources.map(source=>[source,...ys.map(y=>{const rows=data.revenues.filter(r=>r.source===source&&r.year===y);return rows.length?rows.reduce((sum,r)=>sum+r.amountUAH,0):'';})]));}
  if(source==='publications')return table(['Назва','Автори','Рік','Факультет','Індексація','Квартиль','Тип','Посилання'],(allYears?data.publications:s.publications).map(p=>[p.title,p.authors,p.year,p.faculty,p.indexes.join(' / '),p.quartile,p.type,p.url]));
  if(source==='patents')return table(['Назва','Номер','Дата','Автори','Факультет','Посилання'],(allYears?data.patents:s.patents).map(p=>[p.title,p.number,p.date,p.authors,p.faculty,p.url]));
  if(source==='projects')return table(['Назва','Програма','Початок','Завершення','Роль','Надходження, грн','Посилання'],(allYears?data.projects:s.projects).map(p=>[p.title,p.program,p.startDate,p.endDate,p.role,p.funding.filter(f=>selected===null||f.year===selected).reduce((sum,f)=>sum+f.amountUAH,0),p.url]));
  return table(['Текст'],[[source==='insight'?'Знання мають бути доступними.':data.institution.sourceNote]]);
}
function displayedBlockPeriod(block, table = null) {
  const settings={...defaultBlockSettings(block.source),...block.settings};
  if(block.type==='analytics'&&block.dataMode!=='manual'){
    const source=block.source;
    if(source==='insight')return '';
    if(!settings.allYears||['stats','fundingStats','patentStats','publications','patents','revenueNotice'].includes(source))return String(year);
    const inferred=inferTablePeriod(table);if(inferred)return inferred;
    if(['publicationChart','quartiles','faculties'].includes(source))return formatBlockPeriod(data.publications.map(r=>r.year));
    if(source==='patentFaculties')return formatBlockPeriod(data.patents.map(r=>+r.date.slice(0,4)));
    if(source==='programs')return formatBlockPeriod(data.projects.flatMap(r=>r.funding.map(f=>f.year)));
    if(['funding','fundingSources','fundingTable'].includes(source))return inferTablePeriod(analyticsTable(source,true))||formatBlockPeriod(data.revenues.map(r=>r.year));
    if(['projects','projectChart'].includes(source))return formatBlockPeriod(data.projects.flatMap(r=>[+r.startDate.slice(0,4),+r.endDate.slice(0,4)]));
    return '';
  }
  const original=block.type==='chart'?{headers:block.columns,rows:block.rows}:block.dataTable;
  if((block.type==='chart'||block.type==='analytics')&&!settings.allYears&&original?.rows.length&&original.rows.every(r=>/^\d{4}$/.test(r[0])))return String(year);
  const periodTable=table||original,inferred=inferTablePeriod(periodTable);
  const temporal=periodTable?.headers.some(h=>/^(рік|year|дата|date)$/i.test(h.trim())||/^\d{4}$/.test(h))||periodTable?.rows.length&&periodTable.rows.every(r=>/^\d{4}$/.test(r[0]));
  return settings.period||(temporal?inferred:block.dataPeriod||inferred)||'';
}
function analyticsBlock(source, settings = {}) {
  const s=summarize(data,year);
  if(source==='stats')return stats();
  if(source==='fundingStats'){const previous=route;try{route='funding';return stats();}finally{route=previous;}}
  if(source==='patentStats')return `<div class="stats-grid">${stat('Отримано патентів',fmt(s.patents.length),'','award','<span class="muted">За датою реєстрації у вибраному році</span>')}</div>`;
  if(source==='insight')return `<article class="insight-card"><div class="insight-top">${icon('globe')}<span>ВІДКРИТА НАУКА</span></div><h2>Знання мають бути доступними.</h2><p>Публікації, дослідження та винаходи університету — в одному просторі даних.</p><a href="#publications">Дослідити публікації ${icon('arrow')}</a></article>`;
  if(source==='revenueNotice')return `<div class="notice source-notice">${icon('info')}<span><strong>Надходження на науку у ${year} році:</strong> ${s.revenue==null?'дані не завантажено':money(s.revenue)+' млн ₴'}. Грантові кошти обліковуються окремо; ці суми не додаються автоматично.</span></div>`;
  if(['publications','patents'].includes(source))return `<section class="panel records-panel">${toolbar(source)}<div id="records-body">${tableBody(source,settings.showAll)}</div></section>`;
  if(source==='publicationChart')return publicationChart();
  if(source==='quartiles')return quartileChart();
  if(source==='faculties')return facultyPanel(s.publications);
  if(source==='projects')return `<div class="project-grid">${(settings.allYears?data.projects:s.projects).length?(settings.allYears?data.projects:s.projects).map(projectCard).join(''):empty()}</div>`;
  if(source==='funding')return `<article class="panel">${sectionHead('Надходження за роками','Млн грн')}${barChart('funding')}</article>`;
  const publications=source==='publications',rows=publications?s.publications:s.patents;
  return `<div class="panel"><p class="cms-field-help">${rows.length} записів за ${year} рік. Показано перші 100; повні дані доступні через експорт аналітики.</p>${rows.length?`<div class="table-scroll"><table><thead><tr><th>${publications?'Публікація':'Патент'}</th><th>Автори</th><th>${publications?'Індексація':'Номер'}</th></tr></thead><tbody>${rows.slice(0,100).map(r=>`<tr><td>${linkTitle(r)}</td><td>${e(r.authors)}</td><td>${e(publications?r.indexes.join(' / '):r.number)}</td></tr>`).join('')}</tbody></table></div>`:empty()}</div>`;
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
  if(managerTab==='settings') return `<form id="settings-form">${themeSettings()}<div class="form-grid settings-details"><label>Скорочена назва<input name="shortName" value="${e(i.shortName)}" required maxlength="24"></label><label>Колір акценту<input type="color" name="accent" value="${e(i.accent)}"></label><label class="span-2">Повна назва закладу<input name="name" value="${e(i.name)}" required maxlength="180"></label><label class="span-2">Підзаголовок<input name="subtitle" value="${e(i.subtitle)}"></label><label class="span-2">Сайт університету<input name="website" type="url" value="${e(i.website)}" placeholder="https://…"></label><label class="span-2">Джерела й примітки<textarea name="sourceNote" rows="3">${e(i.sourceNote)}</textarea></label></div><fieldset><legend>Блоки аналітики</legend><p class="muted">Вимкнені блоки приховуються; їхні дані залишаються в наборі.</p><div class="checkbox-grid">${Object.entries(BLOCKS).map(([id,label])=>`<label class="checkbox-label"><input type="checkbox" name="blocks" value="${id}" ${i.blocks.includes(id)?'checked':''}>${e(label)}</label>`).join('')}</div></fieldset><div id="form-error" class="form-error" role="alert"></div><div class="dialog-actions"><span>Зберігається в цьому браузері</span><button class="button primary" type="submit">${icon('check')}Зберегти налаштування</button></div></form>`;
  if(managerTab==='format') return `<div class="format-doc"><div class="notice">${icon('info')}<span>Імпорт і налаштування зберігаються локально у вашому браузері. Для публікації спільних даних замініть файл <code>data/demo.json</code> на сервері й установіть <code>demo: false</code>. Відвідувачі без локального імпорту отримають цей набір.</span></div><h3>Один університет — один JSON</h3><p>Файл містить <code>schemaVersion: 1</code>, <code>demo</code>, <code>updatedAt</code>, налаштування <code>institution</code> та чотири масиви даних. Блоки можна вмикати й вимикати в налаштуваннях.</p><div class="format-example"><pre>${e(JSON.stringify({schemaVersion:1,demo:false,updatedAt:today(),institution:{shortName:'КАІ',name:'Назва університету',subtitle:'Наукова аналітика',accent:'#138b7b',website:'https://kai.edu.ua',sourceNote:'Власні перевірені дані',blocks:['publications','projects','patents','funding']},publications:[],projects:[],patents:[],revenues:[]},null,2))}</pre></div><h3>CSV та XLSX для окремих блоків</h3><p>UTF-8, заголовки обов’язкові. Роздільник: крапка з комою, кома або табуляція. Файл замінює весь обраний набір за всі роки. XLSX підтримує одну таблицю або повну книгу з 5 аркушами: Університет, Публікації, Проєкти, Патенти, Надходження. Для повного перенесення налаштувань використайте XLSX або JSON. Для CSV оберіть одну таблицю. Формули Excel не імпортуються — вставляйте значення.</p>${DATASETS.map(k=>`<div class="format-dataset"><strong>${e(({revenues:'Надходження',...BLOCKS})[k])}</strong><code>${CSV_HEADERS[k].join(', ')}</code><button class="text-link" data-action="template" data-dataset="${k}">${icon('download')}Приклад CSV</button><button class="text-link" data-action="xlsx-template" data-dataset="${k}">${icon('download')}Приклад XLSX</button></div>`).join('')}<h3>Правила розрахунку</h3><ul><li>Публікації відбираються за роком видання; індексація Scopus / WoS рахується без дублювання.</li><li>Q1–Q2 — кількість індексованих публікацій із цими квартилями. Квартиль має відповідати року публікації.</li><li>Проєкт враховується в кожному році виконання. Кошти — фактичні надходження університету у гривнях за роком, не загальний бюджет проєкту. Міжнародна частка рахується від коштів.</li><li>Патенти рахуються за датою реєстрації. Один запис — один патент із одним основним факультетом.</li><li>Кожна публікація має один основний факультет і кафедру. Це не дубльований облік співавторів із різних факультетів.</li><li>Відсутні надходження позначені «—», явний нуль — «0». Гранти й надходження не підсумовуються між собою.</li><li>Порівняння — із попереднім календарним роком; за нульової бази відсоток не визначається. Поточний рік може бути неповним.</li></ul><h3>Особливі поля CSV</h3><p><code>indexes</code>: <code>Scopus|WoS</code> або порожнє поле. <code>quartile</code>: Q1–Q4 або порожнє. Дати: <code>YYYY-MM-DD</code>. <code>international</code>: <code>true</code> чи <code>false</code>. <code>funding</code>: JSON-масив, наприклад <code>[{"year":2026,"amountUAH":120000}]</code>. Експортований приклад правильно екранує лапки. Поле <code>id</code> унікальне в межах набору. Суми невід’ємні, у гривнях.</p><h3>Джерело поточного набору</h3><p>${e(i.sourceNote||'Не вказано')}</p><p>Оновлено: ${date(data.updatedAt)}. ${data.demo?'Набір демонстраційний.':'Набір позначено як власні дані.'} Усі суми подаються у гривневому еквіваленті, конвертація валют виконується до імпорту.</p></div>`;
  return `<div class="current-data"><div class="section-head"><div><h3>Поточний набір даних</h3><p>${e(i.shortName)} · оновлено ${date(data.updatedAt)}</p></div>${pill(data.demo?'Демонстрація':'Власні дані',data.demo?'amber':'green')}</div><div class="dataset-counts">${datasetCounts(data)}</div></div><div class="import-description"><h3>Оновіть свою аналітику</h3><p>Оберіть CSV, XLSX або JSON. XLSX підтримує повну книгу з налаштуваннями або окрему таблицю. Спочатку перевіримо формат, потім покажемо зміни для застосування.</p></div><div class="transfer-selectors"><label class="import-type">Формат<select id="import-format"><option value="json">JSON</option><option value="csv">CSV</option><option value="xlsx">XLSX · Excel</option></select></label><label class="import-type">Обсяг імпорту<select id="import-type" disabled><option value="bundle">Повний набір і налаштування</option>${DATASETS.map(k=>`<option value="${k}">${e(({revenues:'Надходження',...BLOCKS})[k])}</option>`).join('')}</select></label></div><label class="dropzone" id="dropzone"><input id="file-input" type="file" accept=".json"><span class="upload-symbol">${icon('upload')}</span><strong>Оберіть файл або перетягніть сюди</strong><span>JSON, CSV або XLSX · до 5 МБ</span><span class="button secondary small">Обрати файл</span></label><div id="import-result" aria-live="polite"></div><div class="import-help"><span>${icon('info')}Потрібен приклад структури?</span><button class="text-link" data-action="example">Завантажити JSON ${icon('download')}</button><button class="text-link" data-action="format">Опис формату ${icon('arrow')}</button></div><div class="local-storage-note">${icon('info')}<span>Дані обробляються у браузері та не надсилаються на сервер. CSV замінює одну таблицю; XLSX — одну таблицю або весь набір; JSON — увесь набір і налаштування. Експортуйте резервну копію перед заміною.</span></div><div class="dialog-actions"><button class="text-link" data-action="export">${icon('download')}Експорт поточного набору</button><button class="text-link danger" data-action="reset">Відновити початковий набір</button></div>`;
}
function openManager(tab='import') {
  closeMenu();
  importTicket++;pending=null;managerTab=tab;
  const titles={import:'Керування даними',settings:'Налаштування університету',format:'Формат даних і методологія',export:'Експорт даних'};
  $('#manager').innerHTML=`<div class="dialog-heading"><div><div class="eyebrow">ВАША ПЛАТФОРМА АНАЛІТИКИ</div><h2 id="dialog-title">${titles[tab]}</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Закрити">${icon('close')}</button></div><div class="dialog-tabs">${[['import','Імпорт'],['export','Експорт'],['settings','Університет'],['format','Формат і правила']].map(([t,label])=>`<button data-tab="${t}" class="${tab===t?'selected':''}">${label}</button>`).join('')}</div><div class="dialog-body">${managerContent()}</div>`;
  if(!$('#manager').open) $('#manager').showModal();
  $('#manager').scrollTop=0;
  if(tab==='export')updateExportControls();
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
  if(action==='close-dialog')$('#manager').close();
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
  if(el.id==='theme-select'||el.name==='displayTheme')applyTheme(el.value);
  if(el.id==='all-years'){year=+el.value;resetFilters();render();}
  if(el.id==='faculty-filter'||el.id==='quartile-filter'||el.id==='index-filter'){if(el.id==='faculty-filter')faculty=el.value;if(el.id==='quartile-filter')quartile=el.value;if(el.id==='index-filter')indexFilter=el.value;page=1;$('#records-body').innerHTML=tableBody(route);}
  if(el.id==='file-input')readImport(el.files[0]);
  if(el.id==='import-type'||el.id==='import-format')updateImportControls();
  if(el.id==='export-format'||el.id==='export-type')updateExportControls();
});
document.addEventListener('input',ev=>{if(ev.target.id==='search'){query=ev.target.value;page=1;$('#records-body').innerHTML=tableBody(route);}});
document.addEventListener('submit',ev=>{
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
  cms=createCMS({
    getData:()=>data,dataStorageKey:()=>STORE,getYear:()=>year,selectPreviewYear:value=>{if(yearsIn(data).includes(value)){year=value;resetFilters();}},isAdmin:()=>route==='admin',rerender:render,notify:toast,download,
    renderHeader:header,renderExisting:existingPage,renderAnalytics:analyticsBlock,getBlockTable:analyticsTable,getBlockPeriod:displayedBlockPeriod,
    replaceData:(next,write=true)=>{if(write)persist(next);else data=next;const years=yearsIn(next);if(!years.includes(year))year=years.at(-1)||new Date().getFullYear();resetFilters();},
    openDataManager:(mode,source)=>{
      const key=({stats:'bundle',publicationChart:'publications',quartiles:'publications',faculties:'publications',publications:'publications',projects:'projects',patents:'patents',funding:'revenues',overview:'bundle'})[source]||'bundle';
      if(mode==='export'){exportTarget=key;openManager('export');}
      else{openManager('import');if(key!=='bundle'){$('#import-format').value='csv';updateImportControls();$('#import-type').value=key;}}
    }
  });
  const pagesResponse=await fetch('./data/pages.json');if(!pagesResponse.ok)throw new Error('Не вдалося завантажити сторінки сайта.');cms.init(await pagesResponse.json());
  const years=yearsIn(data);year=years.includes(new Date().getFullYear())?new Date().getFullYear():years.at(-1)||new Date().getFullYear();setRoute();
}catch(err){$('#content').innerHTML=`<div class="empty"><h1>Не вдалося завантажити дані</h1><p>${e(err.message)}</p><p>Перевірте файл data/demo.json та його відповідність формату.</p></div>`;}
