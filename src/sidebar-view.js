import { SIDEBAR_DEFAULTS } from './data.js?v=page-eyebrow-20261106';
import { icon } from './icons.js?v=page-eyebrow-20261106';
const sidebarEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function sidebarTextSections(institution){
 const i={...SIDEBAR_DEFAULTS,...institution},e=sidebarEscape,multiline=text=>e(text).replaceAll('\n','<br>');
 const status=i.showSidebarStatus&&i.sidebarStatus?`<span class="sidebar-status"><span class="live-dot"></span>${multiline(i.sidebarStatus)}</span>`:'';
 const tagline=i.showSidebarTagline&&i.sidebarTagline?`<p class="sidebar-tagline">${multiline(i.sidebarTagline)}</p>`:'';
 let website='';try{const url=new URL(i.website);if(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password)website=url.href;}catch{}
 const name=i.showSidebarName&&i.name?(website?`<a href="${e(website)}" target="_blank" rel="noopener noreferrer">${e(i.name)} ${icon('external')}</a>`:e(i.name)):'';
 const subtitle=i.showSidebarSubtitle&&i.subtitle?`<span>${multiline(i.subtitle)}</span>`:'';
 return {note:status||tagline?`<div class="sidebar-note">${status}${tagline}</div>`:'',details:name||subtitle?`<div class="sidebar-institution${!name?' sidebar-subtitle-only':''}">${name}${subtitle}</div>`:''};
}
