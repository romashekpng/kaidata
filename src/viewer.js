import { sidebarTextSections, sidebarBrand, sidebarMenuHeading } from './sidebar-view.js?v=text-note-links-20261108';
import { createAnalytics } from './analytics.js?v=text-note-links-20261108';
import { createSiteView, observePeriodHeader } from './site-view.js?v=text-note-links-20261108';
import { validateBundle, reportingYears, currentReportingYear } from './data.js?v=text-note-links-20261108';
import { expandSiteBlocks, cmsRoute } from './cms-data.js?v=text-note-links-20261108';
import { STYLE_FIELDS, defaultSiteStyles, siteStyleVariables } from './style-data.js?v=text-note-links-20261108';
import { icon } from './icons.js?v=text-note-links-20261108';
const $=selector=>document.querySelector(selector);
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Intl.DateTimeFormat('uk-UA',{timeZone:'UTC'}).format(new Date(value));
const THEMES={standard:'Стандартна',dark:'Темна',warm:'Тепла',blue:'Синя'};
const navIcons={overview:'grid',publications:'book',projects:'globe',patents:'award',funding:'wallet'};
let data,site,cms,view,year,route='overview',query='',faculty='',quartile='',indexFilter='',projectStatus='all',page=1,theme='blue';
if(Object.hasOwn(THEMES,document.documentElement.dataset.theme))theme=document.documentElement.dataset.theme;
const analytics=createAnalytics({readOnly:true,getData:()=>data,getYear:()=>year,getRoute:()=>route,getPage:r=>cms?.getPage(r),getFilters:()=>({query,faculty,quartile,indexFilter,projectStatus,page})});
function applyTheme(value){
 if(!Object.hasOwn(THEMES,value))return;theme=value;document.documentElement.dataset.theme=value;
 document.querySelector('meta[name="theme-color"]').content=({standard:'#101f2c',dark:'#0c1521',warm:'#302922',blue:'#25395d'})[value];
}
function renderShell(){
 applyTheme(theme);document.documentElement.style.setProperty('--accent',data.institution.accent);
 for(const key of [...Object.keys(STYLE_FIELDS).map(key=>'--site-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())),'--site-focus-width','--site-focus-color'])document.documentElement.style.removeProperty(key);
 const styles=data.institution.styles||defaultSiteStyles();
 document.documentElement.toggleAttribute('data-site-style',true);
 for(const [key,value]of Object.entries(siteStyleVariables(styles)))document.documentElement.style.setProperty(key,value);
 const i=data.institution;document.title=`${i.shortName} · Наукова діяльність`;
 const sidebar=sidebarTextSections(i);
 $('#sidebar').classList.toggle('sidebar-no-scroll',!i.showSidebarScroll);
 $('#sidebar').classList.toggle('sidebar-auto-hide-scroll',i.showSidebarScroll&&i.autoHideSidebarScroll);
 $('#sidebar').innerHTML=`<button class="icon-button sidebar-close" data-action="close-menu" aria-label="Закрити меню">${icon('close')}</button>${sidebarBrand(i)}${sidebarMenuHeading(i)}<nav aria-label="Основна навігація">${cms.pages().map(p=>`<a class="nav-item ${cmsRoute(p)===route?'active':''}" href="#${cmsRoute(p)}" ${cmsRoute(p)===route?'aria-current="page"':''}>${icon(navIcons[p.id]||'file')}<span>${e(p.title)}</span>${cmsRoute(p)===route?'<span class="active-dot"></span>':''}</a>`).join('')}</nav><div class="sidebar-bottom">${sidebar.note}${sidebar.details}</div>`;
 $('#topbar').classList.add('topbar-view');
 $('#topbar').innerHTML=`<div class="breadcrumbs"><button class="icon-button mobile-menu" data-action="menu" aria-label="Відкрити меню" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button><span>Аналітика</span>${icon('chevron')}<strong>${e(cms.getPage(route)?.title||'Сторінки')}</strong></div><div class="topbar-right"><span class="institution-avatar">${e(i.shortName.slice(0,3))}</span></div>`;
 $('#footer').innerHTML=`<span>© ${currentReportingYear()} ${e(i.shortName)} · Наукова аналітика</span><span>Оновлено ${date(data.updatedAt)}</span>`;
}
function header(p){
 const years=[...new Set([...reportingYears(data),year,...view.pageCatalogYears(p)])].sort((a,b)=>a-b);
 return `<div class="page-heading"><div>${p.eyebrow?`<div class="eyebrow"><span></span>${e(p.eyebrow)}</div>`:''}<h1>${e(p.heading)}</h1><p>${e(p.description)}</p></div></div>${p.showYear?`<div class="period-bar${p.stickyYear?' period-bar-sticky':''}"><div class="period-label">${icon('calendar')}<strong>Звітний період</strong><span>Оберіть рік для перегляду</span></div><div class="year-tabs" role="group" aria-label="Звітний рік">${(years.length?years:[year]).slice(-8).map(y=>`<button data-year="${y}" class="${year===y?'selected':''}" aria-pressed="${year===y}">${y}</button>`).join('')}<select class="year-select${years.length>8?' year-select-extra':''}" aria-label="Звітний рік" id="all-years">${years.map(y=>`<option ${year===y?'selected':''}>${y}</option>`).join('')}</select></div></div>`:''}`;
}
let observedReportingYear=currentReportingYear();
function refreshReportingCalendar(){if(!data||!cms)return;const current=currentReportingYear();if(current===observedReportingYear)return;if(year===observedReportingYear)year=current;observedReportingYear=current;render();}
window.addEventListener('focus',refreshReportingCalendar);setInterval(refreshReportingCalendar,60000);
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
 if(control?.dataset.action==='menu'){$('#sidebar').style.setProperty('--sidebar-open-top',`${window.scrollY}px`);const open=$('#sidebar').classList.toggle('open');control.setAttribute('aria-expanded',String(open));}
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
 const years=reportingYears(data);year=years.includes(currentReportingYear())?currentReportingYear():years.at(-1)||currentReportingYear();
 cms={pages:()=>site.pages.filter(p=>p.visible&&(p.kind==='custom'||p.id==='overview'||data.institution.blocks.includes(p.id))),getPage:r=>site.pages.find(p=>cmsRoute(p)===r)};
 view=createSiteView({...analytics,getData:()=>data,getYear:()=>year,getBlock:id=>site.pages.flatMap(p=>p.blocks).find(b=>b.id===id),refresh:render});site=view.repairMetricSnapshots(site);view.bindInputs(document);setRoute();observePeriodHeader();
}catch(error){$('#content').innerHTML=`<div class="empty"><h1>Не вдалося завантажити сайт</h1><p>Спробуйте оновити сторінку пізніше.</p></div>`;}
