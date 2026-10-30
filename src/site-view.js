import { createChartRenderer } from './chart-runtime.js?v=chart-libraries-20261030';
import { chartSettingsForLibrary, defaultBlockSettings, CHART_SOURCES, isMetricBlock, validateCMSBlock, applyMetricAppearance, restoreMetricSnapshot, customBackgroundStyle, metricDataEqual, metricAppearanceFromTable, blockTableData } from './cms-data.js?v=chart-libraries-20261030';
import { renderChartTable, renderMetricTable, renderProjectTable, renderBlockTable } from './block-view.js?v=chart-libraries-20261030';
import { icon } from './icons.js?v=chart-libraries-20261030';
const escapeView=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createSiteView(options){
 const charts=createChartRenderer();
 const e=escapeView,hiddenSeries=new Map(),projectFilters=new Map();
 const currentBlock=id=>options.getBlock(id);
  function resolvedSettings(block) { return chartSettingsForLibrary(block.settings,block.settings?.chartLibrary||'echarts',block.source); }
  function editableTable(block) {
    if(block.type==='analytics'){
      if(block.dataMode==='manual')return structuredClone(block.dataTable);
      const table=options.getBlockTable(block.source,resolvedSettings(block).allYears);
      return isMetricBlock(block)?applyMetricAppearance(table,block.metricAppearance):table;
    }
    return blockTableData(block);
  }
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
      const appearance=new Map((block.metricAppearance||[]).map((entry,i)=>[entry.key,{...entry,index:i}]));
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
    const family={publicationChart:'publications',quartiles:'publications',faculties:'publications',publications:'publications',insight:'publications',projects:'projects',projectChart:'projects',programs:'projects',patents:'patents',patentStats:'patents',patentFaculties:'patents',funding:'funding',fundingStats:'funding',fundingSources:'funding',fundingTable:'funding',revenueNotice:'funding'};
    const enabled=options.getData().institution.blocks;
    const content=page.blocks.filter(b=>b.visible&&!(b.type==='analytics'&&family[b.source]&&!enabled.includes(family[b.source]))).map(b=>{
      const s=resolvedSettings(b),isChart=b.type==='chart'||(b.type==='analytics'&&CHART_SOURCES.includes(b.source));
      const title=b.title?`<h2>${e(b.title)}</h2>`:'',subtitle=b.subtitle?`<p class="cms-widget-subtitle">${e(b.subtitle)}</p>`:'';
      let body='',displayedTable=null;
      if(isChart){try{validateCMSBlock(b);let table=editableTable(b);if(!s.allYears&&table.rows.length&&table.rows.every(r=>/^\d{4}$/.test(r[0])))table={...table,rows:table.rows.filter(r=>+r[0]===options.getYear())};displayedTable=table;const hidden=[...(hiddenSeries.get(b.id)||[])];body=renderChartTable({...b,settings:s},table,hidden);if(table.rows.length){const payload=e(JSON.stringify({title:b.title,settings:s,table,hidden}));body=body.replace('<div class="cms-chart-graphic">',`<div class="cms-chart-graphic" data-library-chart="${payload}">`);}}catch(err){body=`<p class="form-error">${e(err.message)}</p>`;}}
      else if(b.type==='analytics'){
        if(isMetricBlock(b))body=renderAnalyticMetrics(b,s);
        else if(b.source==='projects')body=renderProjectTable(editableTable(b),s,projectFilters.get(b.id),b.id);
        else if(b.dataMode==='manual'&&['insight','revenueNotice'].includes(b.source))body=`<div class="${b.source==='insight'?'insight-card':'notice'}"><p>${editableTable(b).rows.map(r=>e(r.join(' · '))).join('<br>')}</p></div>`;
        else if(b.dataMode==='manual'||b.source==='fundingTable')body=renderBlockTable(editableTable(b),s.showAll);
        else body=`<div class="cms-analytics-content ${s.showAll?'show-all':''}">${options.renderAnalytics(b.source,s)}</div>`;
      }
      else if(b.type==='existing')body=options.renderExisting(b.source);
      else if(b.type==='banner')body=`<div class="cms-banner ${b.tone}"><p>${e(b.text).replaceAll('\n','<br>')}</p>${b.linkUrl?`<a class="button primary" href="${e(b.linkUrl)}" ${b.linkUrl.startsWith('http')?'target="_blank" rel="noopener noreferrer"':''}>${e(b.linkLabel)} ${icon('arrow')}</a>`:''}</div>`;
      else if(b.type==='text')body=`<div class="cms-prose">${b.text.split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${e(p).replaceAll('\n','<br>')}</p>`).join('')}</div>`;
      else if(b.type==='list')body=`<div class="cms-data-scroll ${s.showAll?'show-all':''}"><${b.ordered?'ol':'ul'} class="cms-list">${b.items.map(item=>`<li>${e(item)}</li>`).join('')}</${b.ordered?'ol':'ul'}></div>`;
      else if(b.type==='table')body=`${b.caption?`<p class="cms-field-help">${e(b.caption)}</p>`:''}${renderBlockTable(editableTable(b),s.showAll)}`;
      else if(b.type==='metrics')body=renderMetricTable(editableTable(b),s);
      const backgroundStyle=b.type==='text'&&s.background==='custom'?';'+customBackgroundStyle(s.backgroundColor):'';
      const period=options.getBlockPeriod(b,displayedTable||(b.dataMode==='manual'?b.dataTable:['table','metrics'].includes(b.type)?editableTable(b):null));
      const heading=title||period?`<div class="cms-widget-heading">${title}${period?`<span class="cms-widget-period" aria-label="Період даних">${e(period)}</span>`:''}</div>`:'';
      return `<section class="cms-widget ${b.type==='text'?`cms-text-background cms-text-bg-${s.background}`:''} ${isChart?'cms-chart-widget':''} ${s.showAll?'show-all':''}" data-widget-id="${b.id}" style="--widget-basis:calc(${s.width}% - var(--site-block-gap,24px) * ${(100-s.width)/100});--metric-columns:${s.columns};--mobile-metric-columns:${Math.min(2,s.columns)}${backgroundStyle}">${inPreview&&options.widgetTools?options.widgetTools(b):''}<div class="cms-widget-content">${heading}${subtitle}${body}</div></section>`;
    }).join('');
    return `<div class="cms-block-grid">${content||'<div class="empty"><h3>На цій сторінці поки немає видимих блоків.</h3></div>'}</div>`;
  }
  function updateProjectFilter(catalog,field,value){
    if(!catalog)return;
    const id=catalog.dataset.projectBlock,block=currentBlock(id);if(!block||block.source!=='projects')return;
    const state=field==='reset'?{}:{...projectFilters.get(id),[field]:value};
    projectFilters.set(id,state);
    const wrapper=catalog.ownerDocument.createElement('div');wrapper.innerHTML=renderProjectTable(editableTable(block),resolvedSettings(block),state,id);
    catalog.querySelector('.project-results').replaceWith(wrapper.querySelector('.project-results'));
    catalog.querySelector('.project-count').innerHTML=wrapper.querySelector('.project-count').innerHTML;
    const buttons=wrapper.querySelectorAll('.project-programs button');
    catalog.querySelectorAll('.project-programs button').forEach((button,i)=>{button.className=buttons[i].className;button.setAttribute('aria-pressed',buttons[i].getAttribute('aria-pressed'));});
    catalog.querySelector('[data-project-role]').value=wrapper.querySelector('[data-project-role]').value;
    if(field==='reset')catalog.querySelector('[data-project-query]').value='';
    options.afterUpdate?.();
  }

 function handleAction(name,el){
  if(name==='project-program'||name==='project-reset'){updateProjectFilter(el.closest('.project-catalog'),name==='project-reset'?'reset':'program',el.dataset.program);return true;}
  if(name==='chart-legend'){
   const id=el.dataset.blockId,set=hiddenSeries.get(id)||new Set(),index=+el.dataset.series;
   if(set.has(index))set.delete(index);else set.add(index);hiddenSeries.set(id,set);options.refresh();return true;
  }
  return false;
 }
 function bindInputs(root){
  charts.observe(root);
  root.addEventListener('input',event=>{if(event.target.matches('[data-project-query]'))updateProjectFilter(event.target.closest('.project-catalog'),'query',event.target.value);});
  root.addEventListener('change',event=>{if(event.target.matches('[data-project-role]'))updateProjectFilter(event.target.closest('.project-catalog'),'role',event.target.value);});
 }
 return {resolvedSettings,editableTable,repairMetricSnapshots,renderBlocks,updateProjectFilter,handleAction,bindInputs,clearLegend:id=>hiddenSeries.delete(id)};
}
