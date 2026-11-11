import {resolveChartData,resolveCatalog,renderCatalog,catalogYears} from './catalog-view.js?v=catalog-align-20261111';
import {defaultCatalogBinding} from './catalog-schema.js?v=catalog-align-20261111';
import { reportingYears, reportDate, currentReportingYear } from './data.js?v=catalog-align-20261111';
import { createChartRenderer } from './chart-runtime.js?v=catalog-align-20261111';
import { chartSettingsForLibrary, defaultBlockSettings, defaultBlockSubtitle, defaultMetricAppearance, CHART_SOURCES, isMetricBlock, validateCMSBlock, applyMetricAppearance, restoreMetricSnapshot, customBackgroundStyle, metricDataEqual, metricAppearanceFromTable, blockTableData } from './cms-data.js?v=catalog-align-20261111';
import { renderDataNote, renderTextBlock, renderFeatureCard, renderChartTable, renderMetricTable, renderProjectTable, renderPublicationCatalog, renderBlockTable } from './block-view.js?v=catalog-align-20261111';
import { icon } from './icons.js?v=catalog-align-20261111';
import { resolveDataNote, noteTableSource } from './data-note.js?v=catalog-align-20261111';
const escapeView=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function observePeriodHeader(){
 const topbar=document.getElementById('topbar');if(!topbar)return;
 const update=()=>{
  const offset=['sticky','fixed'].includes(getComputedStyle(topbar).position)?Math.ceil(topbar.getBoundingClientRect().height):0,value=`${offset}px`,root=document.documentElement;
  if(root.style.getPropertyValue('--period-sticky-top')!==value)root.style.setProperty('--period-sticky-top',value);
 };
 const observer=new ResizeObserver(update);observer.observe(topbar);window.addEventListener('resize',update);update();
 return ()=>{observer.disconnect();window.removeEventListener('resize',update);};
}
export function createSiteView(options){
 const charts=createChartRenderer(()=>options.afterUpdate?.());
 const e=escapeView,hiddenSeries=new Map(),projectFilters=new Map(),publicationFilters=new Map(),catalogFilters=new Map();
 const currentBlock=id=>options.getBlock(id);
  function resolvedSettings(block) { return chartSettingsForLibrary(block.settings,block.settings?.chartLibrary||'echarts',block.source); }
  function projectAsOf(block){return reportDate(block.dataMode==='manual'&&/^\d{4}$/.test(block.dataPeriod||'')?+block.dataPeriod:resolvedSettings(block).allYears?currentReportingYear():options.getYear());}
  function editableTable(block) {
    if(block.type==='catalog')return catalogTable(block,true).table;
    if(block.type==='analytics'){
      if(block.dataMode==='manual')return structuredClone(block.dataTable);
      const table=options.getBlockTable(block.source,resolvedSettings(block).allYears);
      return isMetricBlock(block)?applyMetricAppearance(table,block.metricAppearance??defaultMetricAppearance(block.source)):table;
    }
    return blockTableData(block);
  }
  const catalogTable=(block,all=false)=>{
    const publications=block.type==='analytics'&&['publications','patents'].includes(block.source),source=publications?{...block,type:'catalog',binding:{...defaultCatalogBinding(),kind:'upload',periodMode:'all'},dataTable:editableTable(block)}:block;
    const result=resolveCatalog(source,{year:options.getYear(),getBlock:currentBlock,getTable:options.getBlockTable},all);
    return publications?{...result,period:options.getBlockPeriod(block)}:result;
  };
  const chartData=(block,all=false)=>resolveChartData(block,{year:options.getYear(),years:reportingYears(options.getData()),getBlock:currentBlock,getTable:options.getBlockTable},all);
  const noteResult=block=>resolveDataNote(block,{year:options.getYear(),getBlock:currentBlock,getTable:options.getBlockTable});
  function noteTable(block){return noteTableSource(block,{getBlock:currentBlock,getTable:options.getBlockTable}).table(options.getYear(),true);}
  function repairMetricSnapshots(site){
    return {...site,pages:site.pages.map(page=>({...page,blocks:page.blocks.map(block=>{
      if(block.type!=='analytics'||!isMetricBlock(block)||block.dataMode!=='manual'||block.metricEditingVersion===1)return block;
      const reportYear=/^\d{4}$/.test(block.dataPeriod||'')?+block.dataPeriod:options.getYear();
      return restoreMetricSnapshot(block,options.getBlockTable(block.source,false,reportYear));
    })}))};
  }
  function applyCardColor(card,entry){
    for(const cls of [...card.classList])if(cls==='cms-card-background'||cls.startsWith('cms-text-bg-'))card.classList.remove(cls);
    card.style.removeProperty('--text-block-bg');card.style.removeProperty('--text-block-ink');
    if(entry&&entry.background!=='default'){
      card.classList.add('cms-card-background',`cms-text-bg-${entry.background}`);
      if(entry.background==='custom')card.style.cssText+=';'+customBackgroundStyle(entry.backgroundColor);
    }
  }
  function renderAnalyticMetrics(block,settings){
    const manual=block.dataMode==='manual',table=editableTable(block),reportYear=manual&&/^\d{4}$/.test(block.dataPeriod||'')?+block.dataPeriod:options.getYear();
    const reference=document.createElement('div');reference.innerHTML=options.renderMetricHTML(block.source,settings,reportYear);
    const richCards=new Map([...reference.querySelectorAll('.stat-card')].map(card=>[card.dataset.metricKey,card]));
    if(!manual){
      const appearance=new Map((block.metricAppearance??defaultMetricAppearance(block.source)).map((entry,i)=>[entry.key,{...entry,index:i}]));
      [...richCards.values()].map((card,i)=>({card,index:appearance.get(card.dataset.metricKey)?.index??appearance.size+i})).sort((a,b)=>a.index-b.index).forEach(({card})=>{applyCardColor(card,appearance.get(card.dataset.metricKey));card.parentElement.append(card);});
      return `<div class="cms-analytics-content ${settings.showAll?'show-all':''}">${reference.innerHTML}</div>`;
    }
    const wrapper=document.createElement('div');wrapper.innerHTML=renderMetricTable(table,settings);
    const base=options.getBlockTable(block.source,false,reportYear),label=table.headers.indexOf('label'),baseLabel=base.headers.indexOf('label'),appearance=metricAppearanceFromTable(table);
    [...wrapper.querySelectorAll('.stat-card')].forEach((card,i)=>{
      const key=table.rows[i][label],rich=richCards.get(key),baseRow=base.rows.find(row=>row[baseLabel]===key);
      if(!rich)return;
      if(baseRow&&metricDataEqual({headers:table.headers,rows:[table.rows[i]]},{headers:base.headers,rows:[baseRow]})){
        const clone=rich.cloneNode(true);applyCardColor(clone,appearance.find(entry=>entry.key===key));card.replaceWith(clone);
      }else if(rich.querySelector('.stat-icon'))card.querySelector('.stat-top').append(rich.querySelector('.stat-icon').cloneNode(true));
    });
    return wrapper.innerHTML;
  }
  function renderBlocks(page, inPreview = false) {
    let mixedRow=false;
    const family={publicationChart:'publications',quartiles:'publications',faculties:'publications',publications:'publications',insight:'publications',projects:'projects',projectChart:'projects',programs:'projects',patents:'patents',patentStats:'patents',patentFaculties:'patents',funding:'funding',fundingStats:'funding',fundingSources:'funding',fundingTable:'funding',revenueNotice:'funding'};
    const enabled=options.getData().institution.blocks;
    const content=page.blocks.filter(b=>b.visible&&!(b.type==='analytics'&&family[b.source]&&!enabled.includes(family[b.source]))).map(b=>{
      const s=resolvedSettings(b),isChart=b.type==='chart'||(b.type==='analytics'&&CHART_SOURCES.includes(b.source));
      const subtitleText=b.subtitle??(b.type==='analytics'?defaultBlockSubtitle(b.source):'');
      const title=b.title?`<h2>${e(b.title)}</h2>`:'',subtitle=subtitleText?`<p class="cms-widget-subtitle">${e(subtitleText)}</p>`:'';
      let body='',displayedTable=null,note=null;
      if(isChart){try{validateCMSBlock(b);let table;if(b.type==='chart'&&b.binding){note=chartData(b);if(note.error)throw new Error(note.error);table=note.table;}else table=editableTable(b);if(!b.binding&&!s.allYears&&table.rows.length&&table.rows.every(r=>/^\d{4}$/.test(r[0])))table={...table,rows:table.rows.filter(r=>+r[0]===options.getYear())};displayedTable=table;const hidden=[...(hiddenSeries.get(b.id)||[])];body=renderChartTable({...b,settings:s},table,hidden);if(table.rows.length){const payload=e(JSON.stringify({title:b.title,settings:s,table,hidden}));body=body.replace('<div class="cms-chart-graphic">',`<div class="cms-chart-graphic" data-library-chart="${payload}">`);}}catch(err){body=`<p class="form-error">${e(err.message)}</p>`;}}
      else if(b.type==='analytics'){
        if(isMetricBlock(b))body=renderAnalyticMetrics(b,s);
        else if(b.source==='projects')body=renderProjectTable(editableTable(b),s,projectFilters.get(b.id),b.id,projectAsOf(b));
        else if(b.source==='patents'&&b.catalog)body=renderCatalog(b,catalogTable(b),catalogFilters.get(b.id));
        else if(b.source==='publications')body=b.catalog?renderCatalog(b,catalogTable(b),catalogFilters.get(b.id)):renderPublicationCatalog(editableTable(b),s,publicationFilters.get(b.id),b.id,options.getBlockPeriod(b));
        else if(b.dataMode==='manual'&&['insight','revenueNotice'].includes(b.source))body=`<div class="${b.source==='insight'?'insight-card':'notice'}"><p>${editableTable(b).rows.map(r=>e(r.join(' · '))).join('<br>')}</p></div>`;
        else if(b.dataMode==='manual'||b.source==='fundingTable')body=renderBlockTable(editableTable(b),s.showAll);
        else body=`<div class="cms-analytics-content ${s.showAll?'show-all':''}">${options.renderAnalytics(b.source,s)}</div>`;
      }
      else if(b.type==='existing')body=options.renderExisting(b.source);
      else if(b.type==='banner')body=`<div class="cms-banner ${b.tone}"><p>${e(b.text).replaceAll('\n','<br>')}</p>${b.linkUrl?`<a class="button primary" href="${e(b.linkUrl)}" ${b.linkUrl.startsWith('http')?'target="_blank" rel="noopener noreferrer"':''}>${e(b.linkLabel)} ${icon('arrow')}</a>`:''}</div>`;
      else if(b.type==='feature')body=renderFeatureCard(b);
      else if(b.type==='catalog'){note=catalogTable(b);body=renderCatalog(b,note,catalogFilters.get(b.id));}
      else if(b.type==='dataNote'){note=noteResult(b);body=renderDataNote(b,note);}
      else if(b.type==='text')body=renderTextBlock(b);
      else if(b.type==='list')body=`<div class="cms-data-scroll ${s.showAll?'show-all':''}"><${b.ordered?'ol':'ul'} class="cms-list">${b.items.map(item=>`<li>${e(item)}</li>`).join('')}</${b.ordered?'ol':'ul'}></div>`;
      else if(b.type==='table')body=`${b.caption?`<p class="cms-field-help">${e(b.caption)}</p>`:''}${renderBlockTable(editableTable(b),s.showAll)}`;
      else if(b.type==='metrics')body=renderMetricTable(editableTable(b),s);
      const backgroundStyle=b.type==='text'&&s.background==='custom'?';'+customBackgroundStyle(s.backgroundColor):'';
      const period=(['catalog','dataNote'].includes(b.type)||b.type==='chart'&&b.binding)?note?.period||'':b.type==='feature'?'':options.getBlockPeriod(b,displayedTable||(b.dataMode==='manual'?b.dataTable:['table','metrics'].includes(b.type)?editableTable(b):null));
      const heading=title||period?`<div class="cms-widget-heading">${title}${period?`<span class="cms-widget-period" aria-label="Період даних">${e(period)}</span>`:''}</div>`:'';
      const mixed=s.widthMode!=='percent',rowPrefix=mixed&&!mixedRow?'<div class="cms-mixed-width-row">':!mixed&&mixedRow?'</div>':'';mixedRow=mixed;
      const textBackground=`cms-text-background cms-text-bg-${s.background}`,framed=b.type==='text'&&s.showTextFrame,content=`${heading}${subtitle}${body}`;
      return `${rowPrefix}<section class="cms-widget ${b.type==='text'?(framed?'cms-text-framed':textBackground):''} ${isChart?'cms-chart-widget':''} ${b.type==='feature'&&b.appearance?.autoHeight?'cms-feature-auto-height':''} ${isMetricBlock(b)&&s.autoColumns?'cms-metric-auto-columns':''} ${s.showAll?'show-all':''}" data-widget-id="${b.id}" data-width-mode="${s.widthMode}" style="--widget-basis:calc(${s.width}% - var(--site-block-gap,24px) * ${(100-s.width)/100});--widget-fixed-width:${s.widthPixels}px;--metric-columns:${s.columns};--mobile-metric-columns:${Math.min(2,s.columns)}${backgroundStyle}">${inPreview&&options.widgetTools?options.widgetTools(b):''}<div class="cms-widget-content">${framed?`<div class="cms-text-frame-content ${textBackground}">${content}</div>`:content}</div></section>`;
    }).join('')+(mixedRow?'</div>':'');
    return `<div class="cms-block-grid">${content||'<div class="empty"><h3>На цій сторінці поки немає видимих блоків.</h3></div>'}</div>`;
  }
  function updatePublicationFilter(catalog,field,value){
    if(!catalog)return;
    const id=catalog.dataset.publicationBlock,block=currentBlock(id);if(!block||block.source!=='publications')return;
    const state=field==='reset'?{}:{...publicationFilters.get(id),[field]:value,...(field==='page'?{}:{page:1})};
    publicationFilters.set(id,state);
    const wrapper=catalog.ownerDocument.createElement('div');wrapper.innerHTML=renderPublicationCatalog(editableTable(block),resolvedSettings(block),state,id,options.getBlockPeriod(block));
    catalog.querySelector('.publication-results').replaceWith(wrapper.querySelector('.publication-results'));
    for(const key of ['faculty','index','quartile'])catalog.querySelector(`[data-publication-${key}]`).value=wrapper.querySelector(`[data-publication-${key}]`).value;
    if(field==='reset'){const search=catalog.querySelector('[data-publication-query]');search.value='';search.focus({preventScroll:true});}
    options.afterUpdate?.();
  }
  function updateProjectFilter(catalog,field,value){
    if(!catalog)return;
    const id=catalog.dataset.projectBlock,block=currentBlock(id);if(!block||block.source!=='projects')return;
    const state=field==='reset'?{view:projectFilters.get(id)?.view}:{...projectFilters.get(id),[field]:value};
    projectFilters.set(id,state);
    const wrapper=catalog.ownerDocument.createElement('div');wrapper.innerHTML=renderProjectTable(editableTable(block),resolvedSettings(block),state,id,projectAsOf(block));
    catalog.querySelector('.project-results').replaceWith(wrapper.querySelector('.project-results'));
    catalog.querySelector('.project-count').innerHTML=wrapper.querySelector('.project-count').innerHTML;
    catalog.querySelectorAll('[data-project-view]').forEach(button=>{
      const next=wrapper.querySelector(`[data-project-view="${button.dataset.projectView}"]`);button.className=next.className;button.setAttribute('aria-pressed',next.getAttribute('aria-pressed'));
    });
    const buttons=wrapper.querySelectorAll('.project-programs button');
    catalog.querySelectorAll('.project-programs button').forEach((button,i)=>{button.className=buttons[i].className;button.setAttribute('aria-pressed',buttons[i].getAttribute('aria-pressed'));});
    catalog.querySelector('[data-project-role]').value=wrapper.querySelector('[data-project-role]').value;
    catalog.querySelector('[data-project-program-select]').value=wrapper.querySelector('[data-project-program-select]').value;
    const reset=catalog.querySelector('[data-cms-action="project-reset"]'),wasFocused=reset===catalog.ownerDocument.activeElement;
    reset.hidden=wrapper.querySelector('[data-cms-action="project-reset"]').hidden;
    if(wasFocused&&reset.hidden)catalog.querySelector('[data-project-query]').focus({preventScroll:true});
    if(field==='reset')catalog.querySelector('[data-project-query]').value='';
    options.afterUpdate?.();
  }

 function pageCatalogYears(page){const context={year:options.getYear(),getBlock:currentBlock,getTable:options.getBlockTable};return [...new Set(page.blocks.filter(b=>b.visible&&b.type==='catalog'&&b.binding.periodMode==='year').flatMap(b=>catalogYears(b,context)))].filter(y=>y>=1900&&y<=currentReportingYear()).sort((a,b)=>a-b);}
 function updateCatalog(catalog,key,value){
  if(!catalog)return;const id=catalog.dataset.catalogId,block=currentBlock(id);if(!block||!(block.type==='catalog'||block.type==='analytics'&&['publications','patents'].includes(block.source)&&block.catalog))return;
  const previous=catalogFilters.get(id)||{},state=key==='reset'?{pageSize:previous.pageSize}:{...previous,page:1};
  if(key==='pageSize'&&block.catalog.pageSizes.includes(value))state.pageSize=value;if(key==='query')state.query=value;if(key==='page')state.page=value;if(key.startsWith('filter:'))state.filters={...previous.filters,[key.slice(7)]:value};catalogFilters.set(id,state);
  const wrapper=catalog.ownerDocument.createElement('div');wrapper.innerHTML=renderCatalog(block,catalogTable(block),state);const next=wrapper.querySelector('.data-catalog-results');if(!next)return;catalog.querySelector('.data-catalog-results')?.replaceWith(next);catalog.querySelectorAll('[data-catalog-filter]').forEach((select,i)=>select.value=wrapper.querySelectorAll('[data-catalog-filter]')[i]?.value||'');if(key==='reset'&&catalog.querySelector('[data-catalog-query]'))catalog.querySelector('[data-catalog-query]').value='';if(key==='pageSize')catalog.querySelector('[data-catalog-page-size]')?.focus({preventScroll:true});options.afterUpdate?.();
 }
 function handleAction(name,el){
  if(['catalog-prev','catalog-next','catalog-reset'].includes(name)){const catalog=el.closest('.data-catalog');if(name==='catalog-reset')updateCatalog(catalog,'reset');else updateCatalog(catalog,'page',Number(catalog.querySelector('[data-catalog-page]').dataset.catalogPage)+(name==='catalog-next'?1:-1));return true;}
  if(['publication-prev','publication-next','publication-reset'].includes(name)){
   const catalog=el.closest('.publication-catalog');
   if(name==='publication-reset')updatePublicationFilter(catalog,'reset');
   else {const state=publicationFilters.get(catalog?.dataset.publicationBlock)||{},current=Number(catalog?.querySelector('[data-publication-page]')?.dataset.publicationPage)||state.page||1;updatePublicationFilter(catalog,'page',current+(name==='publication-next'?1:-1));}
   return true;
  }
  if(name==='project-view'){if(['cards','table'].includes(el.dataset.projectView))updateProjectFilter(el.closest('.project-catalog'),'view',el.dataset.projectView);return true;}
  if(name==='project-program'||name==='project-reset'){updateProjectFilter(el.closest('.project-catalog'),name==='project-reset'?'reset':'program',el.dataset.program);return true;}
  if(name==='chart-legend'){
   const id=el.dataset.blockId,set=hiddenSeries.get(id)||new Set(),index=+el.dataset.series;
   if(set.has(index))set.delete(index);else set.add(index);hiddenSeries.set(id,set);options.refresh();return true;
  }
  return false;
 }
 function bindInputs(root){
  charts.observe(root);
  root.addEventListener('input',event=>{if(event.target.matches('[data-catalog-query]'))updateCatalog(event.target.closest('.data-catalog'),'query',event.target.value);});
  root.addEventListener('change',event=>{if(event.target.matches('[data-catalog-page-size]'))updateCatalog(event.target.closest('.data-catalog'),'pageSize',Number(event.target.value));});
  root.addEventListener('change',event=>{if(event.target.matches('[data-catalog-filter]'))updateCatalog(event.target.closest('.data-catalog'),'filter:'+event.target.dataset.catalogFilter,event.target.value);});
  root.addEventListener('input',event=>{if(event.target.matches('[data-project-query]'))updateProjectFilter(event.target.closest('.project-catalog'),'query',event.target.value);});
  root.addEventListener('change',event=>{if(event.target.matches('[data-project-role],[data-project-program-select]'))updateProjectFilter(event.target.closest('.project-catalog'),event.target.matches('[data-project-role]')?'role':'program',event.target.value);});
  root.addEventListener('input',event=>{if(event.target.matches('[data-publication-query]'))updatePublicationFilter(event.target.closest('.publication-catalog'),'query',event.target.value);});
  root.addEventListener('change',event=>{for(const key of ['faculty','index','quartile'])if(event.target.matches(`[data-publication-${key}]`))updatePublicationFilter(event.target.closest('.publication-catalog'),key,event.target.value);});
 }
 return {resolvedSettings,editableTable,repairMetricSnapshots,renderBlocks,chartData,noteResult,noteTable,catalogTable,pageCatalogYears,updateProjectFilter,handleAction,bindInputs,clearLegend:id=>hiddenSeries.delete(id)};
}
