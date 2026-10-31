import { BLOCKS, yearsIn, summarize, groupCount } from './data.js?v=compact-project-table-20261031';
import { icon } from './icons.js?v=compact-project-table-20261031';
import { renderProjectCard } from './block-view.js?v=compact-project-table-20261031';
import { defaultBlockSettings, formatBlockPeriod, inferTablePeriod } from './cms-data.js?v=compact-project-table-20261031';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>new Intl.NumberFormat('uk-UA').format(v);
const money=v=>v==null?'—':new Intl.NumberFormat('uk-UA',{maximumFractionDigits:2}).format(v/1e6);
const date=d=>new Intl.DateTimeFormat('uk-UA',{timeZone:'UTC'}).format(new Date(d));
const today=()=>new Date().toISOString().slice(0,10);
export function createAnalytics(options){
 let data,year,route,query='',faculty='',quartile='',indexFilter='',projectStatus='all',page=1;
 const cms={getPage:route=>options.getPage(route)};
 function sync(){data=options.getData();year=options.getYear();route=options.getRoute();({query='',faculty='',quartile='',indexFilter='',projectStatus='all',page=1}=options.getFilters?.()||{});}
 function exportButton(dataset){return options.readOnly?'':`<button class="button secondary small" data-action="csv-export" data-dataset="${e(dataset)}">${icon('download')}CSV / XLSX</button>`;}
function linkTitle(row) { return row.url ? `<a href="${e(row.url)}" target="_blank" rel="noopener noreferrer">${e(row.title)} ${icon('external')}</a>` : e(row.title); }
function pill(text, color = '') { return `<span class="pill ${color}">${e(text)}</span>`; }
function empty(text = 'За цими умовами даних немає', sub = options.readOnly?'Змініть фільтри або звітний рік.':'Змініть фільтри або імпортуйте новий набір даних.') { return `<div class="empty">${icon('layers')}<h3>${e(text)}</h3><p>${e(sub)}</p></div>`; }
function sectionHead(title, subtitle='', action='') { return `<div class="section-head"><div><h2>${e(title)}</h2>${subtitle ? `<p>${e(subtitle)}</p>` : ''}</div>${action}</div>`; }
function viewLink(key, label = 'Переглянути всі') { return `<a class="text-link" href="#${key}">${e(label)} ${icon('arrow')}</a>`; }
function delta(now, prev, exists) {
  if (!exists || !prev) return '<span class="muted">немає бази порівняння</span>';
  const d = ((now - prev) / prev * 100);
  return `<span class="delta ${d < 0 ? 'negative' : ''}">${d >= 0 ? '↗' : '↘'} ${d > 0 ? '+' : ''}${d.toFixed(1).replace('.', ',')}%</span><span class="muted">до ${year - 1}</span>`;
}
function stat(label, value, unit, ico, detail, color='') { return `<article class="stat-card" data-metric-key="${e(label)}"><div class="stat-top"><span>${label}</span><span class="stat-icon ${color}">${icon(ico)}</span></div><div class="stat-value">${value}<small>${unit}</small></div><div class="stat-detail">${detail}</div></article>`; }
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
  return renderProjectCard({...p,revenue:String(p.funding.find(x=>x.year===year)?.amountUAH??0)},defaultBlockSettings('projects'));
}
function overview() {
  const s = summarize(data,year), enabled = key => data.institution.blocks.includes(key);
  return `${stats()}${enabled('publications') ? `<div class="chart-grid">${publicationChart()}${quartileChart()}</div>` : ''}
  ${enabled('projects') ? `<section class="projects-section">${sectionHead('Дослідження без кордонів',`Проєкти, що виконуються у ${year} році`,viewLink('projects','Усі проєкти'))}<div class="project-grid">${s.projects.length ? s.projects.slice(0,3).map(projectCard).join('') : empty('Немає проєктів у вибраному році')}</div></section>` : ''}
  ${enabled('publications') ? `<div class="overview-bottom">${facultyPanel(s.publications)}<article class="insight-card"><div class="insight-top">${icon('globe')}<span>ВІДКРИТА НАУКА</span></div><h2>Знання мають<br>бути доступними.</h2><p>Публікації, дослідження та винаходи університету — в одному просторі даних.</p><a href="#publications">Дослідити публікації ${icon('arrow')}</a><div class="orbit one"></div><div class="orbit two"></div><div class="orbit three"></div></article></div>` : ''}
  ${enabled('patents') && !enabled('publications') ? facultyPanel(s.patents,'Патенти за факультетами') : ''}
  ${enabled('funding') ? `<div class="notice source-notice">${icon('info')}<span><strong>Надходження на науку у ${year} році:</strong> ${s.revenue == null ? 'дані не завантажено' : `${money(s.revenue)} млн ₴`}. Грантові кошти обліковуються окремо; ці суми не додаються автоматично.</span>${viewLink('funding','Детальніше')}</div>` : ''}
  ${!data.institution.blocks.length ? empty('Блоки аналітики вимкнено',options.readOnly?'Дані ще не опубліковано.':'Увімкніть потрібні розділи в налаштуваннях.') : ''}`;
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
  return `${pub?`<div class="chart-grid">${publicationChart()}${quartileChart()}</div>`:`<div class="patents-summary">${stat('Патентів отримано',fmt(s.patents.length),'','award','<span class="muted">За датою реєстрації у вибраному році</span>')}${facultyPanel(s.patents,'Винахідницька активність')}</div>`}<section class="panel records-panel">${sectionHead(pub?'Каталог публікацій':'Реєстр патентів',pub?'Усі публікації, включно з неіндексованими':'Патенти на винаходи та корисні моделі',`${exportButton(kind)}`)}${toolbar(kind)}<div id="records-body">${tableBody(kind)}</div></section>${pub?facultyPanel(s.publications):''}`;
}
function projectsPage() {
  const s=summarize(data,year), now=today();
  const rows=s.projects.filter(p=>projectStatus==='all'||(projectStatus==='international'?p.international:projectStatus==='coordinator'?p.role==='Координатор':p.startDate<=now&&p.endDate>=now));
  const byProgram = new Map(); s.projects.forEach(p=>byProgram.set(p.program,(byProgram.get(p.program)||0)+(p.funding.find(x=>x.year===year)?.amountUAH||0)));
  const max=Math.max(1,...byProgram.values());
  return `<div class="chart-grid"><article class="panel">${sectionHead('Проєкти за роками','Проєкт враховується в кожному році його виконання')}${barChart('projects')}</article><article class="panel">${sectionHead('Кошти за програмами',`Надходження у ${year} році, млн ₴`)}<div class="program-bars">${byProgram.size?[...byProgram].sort((a,b)=>b[1]-a[1]).map(([name,n])=>`<div class="rank-caption"><span>${e(name)}</span><strong>${money(n)}</strong></div><div class="rank-track"><span style="width:${n/max*100}%"></span></div>`).join(''):empty()}</div></article></div><section>${sectionHead('Портфель проєктів',`${rows.length} проєктів · ${year} рік`,`${exportButton('projects')}`)}<div class="filter-tabs" role="group" aria-label="Фільтр проєктів">${[['all','Усі проєкти'],['international','Міжнародні'],['coordinator','Координатор'],['active','Активні сьогодні']].map(([id,label])=>`<button data-project-status="${id}" class="${projectStatus===id?'selected':''}" aria-pressed="${projectStatus===id}">${label}</button>`).join('')}</div><div class="project-grid">${rows.length?rows.map(projectCard).join(''):empty('Немає проєктів за вибраними умовами',projectStatus==='active'?`Фільтр перевіряє дати станом на ${date(now)} і належність до звітного року.`:'Оберіть інший рік або фільтр.')}</div></section>`;
}
function fundingPage() {
  const years=yearsIn(data), sources=[...new Set(data.revenues.map(r=>r.source))];
  const current=data.revenues.filter(x=>x.year===year), grouped=new Map(); current.forEach(x=>grouped.set(x.source,(grouped.get(x.source)||0)+x.amountUAH));
  const max=Math.max(1,...grouped.values());
  return `${stats()}<div class="chart-grid"><article class="panel">${sectionHead('Надходження за роками','Фактичні надходження, млн ₴')}${barChart('funding')}</article><article class="panel">${sectionHead('Джерела фінансування',`${year} рік · млн ₴`)}<div class="program-bars">${grouped.size?[...grouped].map(([name,n])=>`<div class="rank-caption"><span>${e(name)}</span><strong>${money(n)}</strong></div><div class="rank-track"><span style="width:${n/max*100}%"></span></div>`).join(''):empty('Дані за цей рік не завантажено','Відсутність записів не означає нульове фінансування.')}</div></article></div><section class="panel">${sectionHead('Надходження за джерелами','Усі суми у гривнях. «—» означає відсутність даних.',`${exportButton('revenues')}`)}${sources.length?`<div class="table-scroll"><table class="funding-table"><thead><tr><th>Джерело надходжень</th>${years.map(y=>`<th class="${y===year?'year-highlight':''}">${y}</th>`).join('')}</tr></thead><tbody>${sources.map(source=>`<tr><td>${e(source)}</td>${years.map(y=>{const r=data.revenues.filter(x=>x.year===y&&x.source===source);return `<td class="${y===year?'year-highlight':''}">${r.length?fmt(r.reduce((s,x)=>s+x.amountUAH,0)):'—'}</td>`;}).join('')}</tr>`).join('')}<tr class="total-row"><td>Разом</td>${years.map(y=>`<td class="${y===year?'year-highlight':''}">${summarize(data,y).revenue==null?'—':fmt(summarize(data,y).revenue)}</td>`).join('')}</tr></tbody></table></div>`:empty()}</section><div class="notice">${icon('info')}<span>Грантові надходження показані в розділі «Грантові проєкти» окремо. Підсумки джерел можуть включати гранти — уникайте подвійного обліку.</span></div>`;
}
function existingPage(source) {
  const previous = route;
  try { route = source; return source==='overview'?overview():source==='publications'||source==='patents'?recordsPage(source):source==='projects'?projectsPage():fundingPage(); }
  finally { route = previous; }
}
function analyticsTable(source, allYears = false, reportYear = year) {
  const selected=allYears?null:reportYear, s=summarize(data,reportYear), table=(headers,rows)=>({headers,rows:rows.map(r=>r.map(v=>String(v??'')))});
  if(['stats','fundingStats','patentStats'].includes(source)){
    const cards=source==='fundingStats'?[['Надходження на науку',s.revenue==null?'—':money(s.revenue),'млн ₴',`${reportYear} рік`],['Джерел фінансування',new Set(data.revenues.filter(r=>r.year===reportYear).map(r=>r.source)).size,'','За вибраний рік']]:source==='patentStats'?[['Патентів отримано',s.patents.length,'',`${reportYear} рік`]]:[['Наукових публікацій',s.publications.length,'',`${reportYear} рік`],['Scopus / Web of Science',s.indexed.length,'','Індексовані публікації'],['Публікацій Q1–Q2',s.q12,'','Серед індексованих'],['Грантових проєктів',s.projects.length,'',`Виконуються у ${reportYear} році`],['Надходження грантів',money(s.grants),'млн ₴','За вибраний рік'],['Патентів отримано',s.patents.length,'',`${reportYear} рік`]];
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
  if(source==='projects')return table(['Назва','Програма','Початок','Завершення','Роль','Надходження, грн','Посилання','Міжнародний'],(allYears?data.projects:s.projects).map(p=>[p.title,p.program,p.startDate,p.endDate,p.role,p.funding.filter(f=>selected===null||f.year===selected).reduce((sum,f)=>sum+f.amountUAH,0),p.url,p.international]));
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
  if(source==='patentStats')return `<div class="stats-grid">${stat('Патентів отримано',fmt(s.patents.length),'','award','<span class="muted">За датою реєстрації у вибраному році</span>')}</div>`;
  if(source==='insight')return `<article class="insight-card"><div class="insight-top">${icon('globe')}<span>ВІДКРИТА НАУКА</span></div><h2>Знання мають бути доступними.</h2><p>Публікації, дослідження та винаходи університету — в одному просторі даних.</p><a href="#publications">Дослідити публікації ${icon('arrow')}</a></article>`;
  if(source==='revenueNotice')return `<div class="notice source-notice">${icon('info')}<span><strong>Надходження на науку у ${year} році:</strong> ${s.revenue==null?'дані не завантажено':money(s.revenue)+' млн ₴'}. Грантові кошти обліковуються окремо; ці суми не додаються автоматично.</span></div>`;
  if(['publications','patents'].includes(source))return `<section class="panel records-panel">${toolbar(source)}<div id="records-body">${tableBody(source,settings.showAll)}</div></section>`;
  if(source==='publicationChart')return publicationChart();
  if(source==='quartiles')return quartileChart();
  if(source==='faculties')return facultyPanel(s.publications);
  if(source==='projects')return `<div class="project-grid">${(settings.allYears?data.projects:s.projects).length?(settings.allYears?data.projects:s.projects).map(projectCard).join(''):empty()}</div>`;
  if(source==='funding')return `<article class="panel">${sectionHead('Надходження за роками','Млн грн')}${barChart('funding')}</article>`;
  const publications=source==='publications',rows=publications?s.publications:s.patents;
  return `<div class="panel"><p class="cms-field-help">${rows.length} записів за ${year} рік. Показано перші 100${options.readOnly?'.':'; повні дані доступні через експорт аналітики.'}</p>${rows.length?`<div class="table-scroll"><table><thead><tr><th>${publications?'Публікація':'Патент'}</th><th>Автори</th><th>${publications?'Індексація':'Номер'}</th></tr></thead><tbody>${rows.slice(0,100).map(r=>`<tr><td>${linkTitle(r)}</td><td>${e(r.authors)}</td><td>${e(publications?r.indexes.join(' / '):r.number)}</td></tr>`).join('')}</tbody></table></div>`:empty()}</div>`;
}
function renderMetricReference(source,settings,reportYear=year){
  const previous=year;try{year=reportYear;return analyticsBlock(source,settings);}finally{year=previous;}
}

 return {
  renderExisting:(...args)=>{sync();return existingPage(...args);},
  renderAnalytics:(...args)=>{sync();return analyticsBlock(...args);},
  getBlockTable:(...args)=>{sync();return analyticsTable(...args);},
  getBlockPeriod:(...args)=>{sync();return displayedBlockPeriod(...args);},
  renderMetricHTML:(...args)=>{sync();return renderMetricReference(...args);},
  tableBody:(...args)=>{sync();return tableBody(...args);},
  filteredRows:(...args)=>{sync();return filteredRows(...args);}
 };
}
