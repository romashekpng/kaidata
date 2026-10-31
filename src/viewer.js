import { createAnalytics } from './analytics.js?v=project-filters-20261031';
import { createSiteView } from './site-view.js?v=project-filters-20261031';
import { validateBundle, yearsIn } from './data.js?v=project-filters-20261031';
import { expandSiteBlocks, cmsRoute } from './cms-data.js?v=project-filters-20261031';
import { STYLE_FIELDS, siteStyleVariables } from './style-data.js?v=project-filters-20261031';
import { icon } from './icons.js?v=project-filters-20261031';
const $=selector=>document.querySelector(selector);
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Intl.DateTimeFormat('uk-UA',{timeZone:'UTC'}).format(new Date(value));
const THEMES={standard:'Стандартна',dark:'Темна',warm:'Тепла',blue:'Синя'},THEME_STORE='kai-science.theme.v1';
const navIcons={overview:'grid',publications:'book',projects:'globe',patents:'award',funding:'wallet'};
let data,site,cms,view,year,route='overview',query='',faculty='',quartile='',indexFilter='',projectStatus='all',page=1,theme='blue';
try{const saved=localStorage.getItem(THEME_STORE);if(Object.hasOwn(THEMES,saved))theme=saved;}catch{}
const analytics=createAnalytics({readOnly:true,getData:()=>data,getYear:()=>year,getRoute:()=>route,getPage:r=>cms?.getPage(r),getFilters:()=>({query,faculty,quartile,indexFilter,projectStatus,page})});
function applyTheme(value){
 if(!Object.hasOwn(THEMES,value))return;theme=value;document.documentElement.dataset.theme=value;
 document.querySelector('meta[name="theme-color"]').content=({standard:'#101f2c',dark:'#0c1521',warm:'#302922',blue:'#25395d'})[value];
 try{localStorage.setItem(THEME_STORE,value);}catch{}
}
function renderShell(){
 applyTheme(theme);document.documentElement.style.setProperty('--accent',data.institution.accent);
 for(const key of Object.keys(STYLE_FIELDS))document.documentElement.style.removeProperty('--site-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()));
 document.documentElement.toggleAttribute('data-site-style',!!data.institution.styles);
 if(data.institution.styles)for(const [key,value]of Object.entries(siteStyleVariables(data.institution.styles)))document.documentElement.style.setProperty(key,value);
 const i=data.institution;document.title=`${i.shortName} · Наукова діяльність`;
 $('#sidebar').innerHTML=`<button class="icon-button sidebar-close" data-action="close-menu" aria-label="Закрити меню">${icon('close')}</button><a class="brand" href="#overview" aria-label="На головну"><span class="brand-mark">${icon('layers')}</span><span>${e(i.shortName)}<small>SCIENCE & INSIGHTS</small></span></a><div class="sidebar-label">АНАЛІТИКА УНІВЕРСИТЕТУ</div><nav aria-label="Основна навігація">${cms.pages().map(p=>`<a class="nav-item ${cmsRoute(p)===route?'active':''}" href="#${cmsRoute(p)}" ${cmsRoute(p)===route?'aria-current="page"':''}>${icon(navIcons[p.id]||'file')}<span>${e(p.title)}</span>${cmsRoute(p)===route?'<span class="active-dot"></span>':''}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-note"><span class="live-dot"></span>Відкриті дані. Нові можливості.<p>Знання, що формують<br>майбутнє університету.</p></div><div class="sidebar-institution">${i.website?`<a href="${e(i.website)}" target="_blank" rel="noopener noreferrer">${e(i.name)} ${icon('external')}</a>`:e(i.name)}<span>${e(i.subtitle||'Платформа наукової аналітики')}</span></div></div>`;
 $('#topbar').innerHTML=`<div class="breadcrumbs"><button class="icon-button mobile-menu" data-action="menu" aria-label="Відкрити меню" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button><span>Аналітика</span>${icon('chevron')}<strong>${e(cms.getPage(route)?.title||'Сторінки')}</strong></div><div class="topbar-right"><label class="theme-switch"><span>Тема</span><select id="theme-select" aria-label="Тема оформлення">${Object.entries(THEMES).map(([id,label])=>`<option value="${id}" ${theme===id?'selected':''}>${label}</option>`).join('')}</select></label><span class="dataset-state ${data.demo?'demo':''}"><span></span>${data.demo?'Демонстраційні дані':'Опубліковані дані'}</span><span class="topbar-divider"></span><span class="institution-avatar">${e(i.shortName.slice(0,3))}</span></div>`;
 $('#footer').innerHTML=`<span>© ${new Date().getFullYear()} ${e(i.shortName)} · Наукова аналітика</span><span>Оновлено ${date(data.updatedAt)}</span>`;
}
function header(p){
 const years=yearsIn(data);
 return `<div class="page-heading"><div><div class="eyebrow"><span></span>НАУКОВА ДІЯЛЬНІСТЬ</div><h1>${e(p.heading)}</h1><p>${e(p.description)}</p></div></div>${p.showYear?`<div class="period-bar"><div class="period-label">${icon('calendar')}<strong>Звітний період</strong><span>Оберіть рік для перегляду</span></div><div class="year-tabs" role="group" aria-label="Звітний рік">${(years.length?years:[year]).slice(-8).map(y=>`<button data-year="${y}" class="${year===y?'selected':''}" aria-pressed="${year===y}">${y}</button>`).join('')}${years.length>8?`<select aria-label="Усі роки" id="all-years">${years.map(y=>`<option ${year===y?'selected':''}>${y}</option>`).join('')}</select>`:''}</div></div>`:''}`;
}
function render(){
 renderShell();const p=cms.getPage(route);$('#content').innerHTML=p?header(p)+view.renderBlocks(p):'<div class="empty"><h1>Сторінки ще не опубліковано</h1></div>';
}
function resetFilters(){query='';faculty='';quartile='';indexFilter='';projectStatus='all';page=1;}
function closeMenu(){$('#sidebar').classList.remove('open');$('[data-action="menu"]')?.setAttribute('aria-expanded','false');}
function setRoute(){
 const requested=location.hash.slice(1)||'overview',p=cms.pages().find(p=>cmsRoute(p)===requested);route=p?requested:cms.pages()[0]?cmsRoute(cms.pages()[0]):'empty';
 if(route!==requested)history.replaceState(null,'','#'+route);resetFilters();render();closeMenu();
}
document.addEventListener('click',event=>{
 if(event.target.closest('#sidebar a')||(!event.target.closest('#sidebar')&&!event.target.closest('[data-action="menu"]')))closeMenu();
 const action=event.target.closest('[data-cms-action]');if(action&&view?.handleAction(action.dataset.cmsAction,action)){event.preventDefault();return;}
 const yearButton=event.target.closest('[data-year]');if(yearButton){year=+yearButton.dataset.year;resetFilters();render();return;}
 const control=event.target.closest('[data-action]');
 if(control?.dataset.action==='menu'){const open=$('#sidebar').classList.toggle('open');control.setAttribute('aria-expanded',String(open));}
 if(control?.dataset.action==='close-menu')closeMenu();
 if(control?.dataset.action==='clear-filters'){resetFilters();render();}
 if(['prev-page','next-page'].includes(control?.dataset.action)){page+=control.dataset.action==='prev-page'?-1:1;$('#records-body').innerHTML=analytics.tableBody(route);}
 const status=event.target.closest('[data-project-status]');if(status){projectStatus=status.dataset.projectStatus;render();}
});
document.addEventListener('change',event=>{
 const el=event.target;if(el.id==='theme-select')applyTheme(el.value);
 if(el.id==='all-years'){year=+el.value;resetFilters();render();}
 if(['faculty-filter','quartile-filter','index-filter'].includes(el.id)){
  if(el.id==='faculty-filter')faculty=el.value;if(el.id==='quartile-filter')quartile=el.value;if(el.id==='index-filter')indexFilter=el.value;page=1;
  if($('#records-body'))$('#records-body').innerHTML=analytics.tableBody(route);
 }
});
document.addEventListener('input',event=>{if(event.target.id==='search'){query=event.target.value;page=1;if($('#records-body'))$('#records-body').innerHTML=analytics.tableBody(route);}});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
window.addEventListener('hashchange',()=>{if(cms)setRoute();});
try{
 // Published content comes from files, independently of any prior editing sessions in this browser.
 const responses=await Promise.all([fetch('./data/demo.json',{cache:'no-store'}),fetch('./data/pages.json',{cache:'no-store'})]);
 if(responses.some(response=>!response.ok))throw new Error('Не вдалося завантажити опубліковані дані.');
 data=validateBundle(await responses[0].json());site=expandSiteBlocks(await responses[1].json());
 const years=yearsIn(data);year=years.includes(new Date().getFullYear())?new Date().getFullYear():years.at(-1)||new Date().getFullYear();
 cms={pages:()=>site.pages.filter(p=>p.visible&&(p.kind==='custom'||p.id==='overview'||data.institution.blocks.includes(p.id))),getPage:r=>site.pages.find(p=>cmsRoute(p)===r)};
 view=createSiteView({...analytics,getData:()=>data,getYear:()=>year,getBlock:id=>site.pages.flatMap(p=>p.blocks).find(b=>b.id===id),refresh:render});site=view.repairMetricSnapshots(site);view.bindInputs(document);setRoute();
}catch(error){$('#content').innerHTML=`<div class="empty"><h1>Не вдалося завантажити сайт</h1><p>Спробуйте оновити сторінку пізніше.</p></div>`;}
