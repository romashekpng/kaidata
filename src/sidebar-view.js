import { SIDEBAR_DEFAULTS } from './data.js?v=publication-columns-20261107';
import { icon } from './icons.js?v=publication-columns-20261107';
const sidebarEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function sidebarMenuHeading(institution){
 const i={...SIDEBAR_DEFAULTS,...institution};
 return i.sidebarMenuTitle?`<div class="sidebar-label">${sidebarEscape(i.sidebarMenuTitle).replaceAll('\n','<br>')}</div>`:'';
}
export function sidebarBrand(institution){
 const i={...SIDEBAR_DEFAULTS,...institution},e=sidebarEscape;
 const caption=i.sidebarBrandText?`<small class="brand-caption">${e(i.sidebarBrandText).replaceAll('\n','<br>')}</small>`:'';
 return `<a class="brand ${i.sidebarLogo?'brand-image':'brand-fallback'}" href="#overview" aria-label="На головну">${i.sidebarLogo?`<img class="brand-logo" src="${e(i.sidebarLogo)}" alt="${e(i.shortName)}">`:`<span class="brand-mark">${icon('layers')}</span><span class="brand-word">${e(i.shortName)}</span>`}${caption}</a>`;
}
export function sidebarTextSections(institution){
 const i={...SIDEBAR_DEFAULTS,...institution},e=sidebarEscape,multiline=text=>e(text).replaceAll('\n','<br>');
 const status=i.showSidebarStatus&&i.sidebarStatus?`<span class="sidebar-status"><span class="live-dot"></span>${multiline(i.sidebarStatus)}</span>`:'';
 const tagline=i.showSidebarTagline&&i.sidebarTagline?`<p class="sidebar-tagline">${multiline(i.sidebarTagline)}</p>`:'';
 let website='';try{const url=new URL(i.website);if(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password)website=url.href;}catch{}
 const name=i.showSidebarName&&i.name?(website?`<a href="${e(website)}" target="_blank" rel="noopener noreferrer">${e(i.name)} ${icon('external')}</a>`:e(i.name)):'';
 const subtitle=i.showSidebarSubtitle&&i.subtitle?`<span>${multiline(i.subtitle)}</span>`:'';
 return {note:status||tagline?`<div class="sidebar-note">${status}${tagline}</div>`:'',details:name||subtitle?`<div class="sidebar-institution${!name?' sidebar-subtitle-only':''}">${name}${subtitle}</div>`:''};
}
