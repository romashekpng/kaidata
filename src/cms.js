import {catalogEditorFields,updateCatalogField,catalogEditorAction} from './catalog-editor.js?v=chart-tooltip-20261110';
import {readCatalogUpload,catalogSheetTable} from './catalog-io.js?v=chart-tooltip-20261110';
import {inferCatalogConfig,publicationCatalogConfig} from './catalog-schema.js?v=chart-tooltip-20261110';
import {renderCatalog} from './catalog-view.js?v=chart-tooltip-20261110';
import { createProjectReportsEditor } from './project-reports.js?v=chart-tooltip-20261110';
import { PUBLICATION_ASSETS, VISITOR_ASSETS, buildPublicationFiles } from './publication.js?v=chart-tooltip-20261110';
import { createSiteView } from './site-view.js?v=chart-tooltip-20261110';
import { CHART_SORTS, defaultChartBinding, NOTE_SOURCES, NOTE_OPERATIONS, BLOCK_WIDTH_MODES, blockWidthLabel, FEATURE_ICONS, FEATURE_LINK_ICONS, validateFeatureStyle, validateMetricBackground, isHorizontalChartType, CHART_LIBRARIES, LIBRARY_SETTING_KEYS, chartSettingsForLibrary, rememberChartSettings, selectChartLibrary, CORE_PAGES, BLOCK_TYPES, ANALYTICS, CHART_SOURCES, CHART_TYPES, TEXT_BACKGROUNDS, BLOCK_PALETTES, isMetricBlock, metricColorTable, metricAppearanceFromTable, applyMetricAppearance, expandSiteBlocks, moveTableItem, validateSite, validateCMSPage, validateCMSBlock, defaultCMSBlock, defaultBlockSubtitle, newCMSId, cmsRoute } from './cms-data.js?v=chart-tooltip-20261110';
import { tableToCMSBlock, cmsBlockCSV, importCMSBlockCSV, cmsBlockXLSX, importCMSBlockXLSX, readCMSJSON } from './cms-io.js?v=chart-tooltip-20261110';
import { renderChartTable, renderDataNote, renderBlockTable } from './block-view.js?v=chart-tooltip-20261110';
import { validateBundle } from './data.js?v=chart-tooltip-20261110';
import { createSiteZip } from './zip.js';
import { icon } from './icons.js?v=chart-tooltip-20261110';
const CMS_KEY = 'kai-science.pages.v1';
const escapeCMS = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const publicationBlock=block=>block?.type==='analytics'&&block.source==='publications';
const catalogEditorBlock=block=>block?.type==='catalog'||publicationBlock(block);
const CMS_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export function createCMS(options) {
  const e = escapeCMS;
  const projectReports=createProjectReportsEditor({getData:options.getData,save:next=>{options.replaceData(next);options.rerender();},notify:options.notify});
  let site, draft, selected, dirty = false, temporary = false, pendingDataRestore = false, history = [], transfer = null, importValue = null, importToken = 0;
  let widgetState=null,dragItem=null,publicationTicket=0,metricPalette=null;

  const $ = selector => document.querySelector(selector);
  const button = (action, label, extra = '', cls = 'secondary') => `<button type="button" class="button ${cls}" data-cms-action="${action}" ${extra}>${label}</button>`;
  const input = (label, field, value, extra = '') => `<label>${label}<input data-cms-field="${field}" value="${e(value)}" ${extra}></label>`;
  const blockInput = (b, field, label, extra = '') => `<label>${label}<input data-block-id="${b.id}" data-block-field="${field}" value="${e(b[field])}" ${extra}></label>`;
  const blockText = (b, field, label, rows = 4, value = b[field]) => `<label class="span-2">${label}<textarea data-block-id="${b.id}" data-block-field="${field}" rows="${rows}">${e(value)}</textarea></label>`;
  const view=createSiteView({...options,getBlock:currentBlock,widgetTools,refresh:()=>{if(options.isAdmin())schedulePreview();else redraw();},afterUpdate:()=>{const frame=$('#cms-live-frame'),page=frame?.contentDocument?.querySelector('.cms-frame-page');if(page)frame.style.height=`${Math.ceil(page.getBoundingClientRect().height)}px`;}});
  const {resolvedSettings,editableTable,renderBlocks}=view;
  const repairMetricSnapshots=()=>{site=view.repairMetricSnapshots(site);};
  view.bindInputs(document);
  function activePages() { return site.pages.filter(p => p.visible && (p.kind === 'custom' || p.id === 'overview' || options.getData().institution.blocks.includes(p.id))); }
  function findPage(route) { return site.pages.find(p => cmsRoute(p) === route); }
  function currentBlock(id) { return (options.isAdmin() ? draft?.blocks.find(b => b.id === id) : null) || site.pages.flatMap(p => p.blocks).find(b => b.id === id); }
  function status() {
    const el = $('#cms-save-status'); if (el) el.textContent = dirty ? 'Є незбережені зміни' : temporary ? 'Збережено лише до закриття сторінки' : 'Збережено в цьому браузері';
    document.querySelectorAll('[data-cms-action="publish-zip"]').forEach(el => { el.disabled = dirty; });
  }
  function change(mutator) {
    history.push(structuredClone(draft)); if (history.length > 20) history.shift();
    mutator(draft); dirty = true; redraw();
  }
  function redraw() { options.rerender(); }
  function selectPage(id, ask = true) {
    if (ask && dirty && !confirm('Відкинути незбережені зміни сторінки?')) return false;
    selected = id; draft = structuredClone(site.pages.find(p => p.id === id)); dirty = false; history = []; return true;
  }
  function writeLocal(next, dataOverride = null) {
    const nextData=dataOverride||(pendingDataRestore?options.getData():null);
    let original=null,changed=false;temporary=false;
    try {
      original=localStorage.getItem(CMS_KEY);
      localStorage.setItem(CMS_KEY,JSON.stringify(next));changed=true;
      if(nextData)localStorage.setItem(options.dataStorageKey(),JSON.stringify(nextData));
      pendingDataRestore=false;
    }catch {
      temporary=true;pendingDataRestore=!!nextData;
      if(changed){try{if(original===null)localStorage.removeItem(CMS_KEY);else localStorage.setItem(CMS_KEY,original);}catch{options.notify('Не вдалося відновити попереднє сховище. Експортуйте резервну копію поточного сайта.');}}
    }
    site=next;
  }
  function saveSite(next, message = 'Зміни збережено в цьому браузері.') {
    const valid = validateSite({ ...next, updatedAt: new Date().toISOString() });
    writeLocal(valid);
    options.notify(temporary ? 'Сховище браузера недоступне. Експортуйте резервну копію перед закриттям сторінки.' : message);
  }
  function savePage() {
    const page = validateCMSPage(draft);
    saveSite({ ...site, pages: site.pages.map(p => p.id === selected ? page : p) });
    selectPage(selected, false); redraw();
  }
  function uniqueSlug(base = 'nova-storinka') {
    let slug = base.slice(0, 54), n = 1;
    while (site.pages.some(p => p.kind === 'custom' && p.slug === slug)) slug = `${base.slice(0, 54)}-${n++}`;
    return slug;
  }
  function newPage() {
    if (dirty && !confirm('Відкинути незбережені зміни перед створенням сторінки?')) return;
    const id = newCMSId('page'), slug = uniqueSlug();
    const page = { id, kind: 'custom', slug, title: 'Нова сторінка', heading: 'Нова сторінка', description: '', visible: true, showYear: false, blocks: [defaultCMSBlock('text')] };
    saveSite({ ...site, pages: [...site.pages, page] }, 'Сторінку створено локально. Додайте вміст і збережіть.');
    selectPage(id, false); redraw();
  }
  function blockFields(b) {
    if(b.type==='catalog')return '<p class="cms-field-help span-2">Виберіть джерело, стовпчики, пошук і фільтри через «Налаштування» або «Редагувати».</p>';
    if(b.type==='dataNote')return noteContentFields(b,false);
    if(b.type==='feature')return featureContentFields(b,false);
    if (b.type === 'text') return blockText(b, 'text', 'Текст · абзаци розділяються порожнім рядком', 7)+textLinkFields(b,false);
    if (b.type === 'banner') return `${blockText(b, 'text', 'Текст банера')}<label>Оформлення<select data-block-id="${b.id}" data-block-field="tone">${[['green','Зелений'],['blue','Синій'],['amber','Теплий'],['dark','Темний']].map(([v,t])=>`<option value="${v}" ${b.tone===v?'selected':''}>${t}</option>`).join('')}</select></label>${blockInput(b,'linkLabel','Текст кнопки')}${blockInput(b,'linkUrl','Посилання · https://… або #page/slug')}`;
    if (b.type === 'list') return `${blockText(b,'items','Пункти · кожен із нового рядка',7,b.items.join('\n'))}<label class="checkbox-label"><input type="checkbox" data-block-id="${b.id}" data-block-field="ordered" ${b.ordered?'checked':''}>Нумерований список</label>`;
    if (b.type === 'analytics') return `<label class="span-2">Джерело аналітики<select data-block-id="${b.id}" data-block-field="source">${Object.entries(ANALYTICS).filter(([key])=>!['insight','revenueNotice'].includes(key)).map(([v,t])=>`<option value="${v}" ${b.source===v?'selected':''}>${t}</option>`).join('')}</select></label><p class="cms-field-help span-2">Використовує дані сайта за вибраний рік. Для зміни таблиць відкрийте «Імпорт даних аналітики». Увімкніть фільтр року в параметрах сторінки.</p>`;
    if (b.type === 'existing') return `<p class="cms-field-help span-2">Початкова сторінка «${e(CORE_PAGES[b.source])}» із графіками, фільтрами й каталогами. Її можна перемістити, приховати або видалити; додаткові блоки розміщуються поруч у порядку нижче.</p>`;
    if(b.type==='chart'&&b.binding&&b.binding.kind!=='manual')return '<p class="cms-field-help span-2">Діаграма використовує обране джерело. Змініть його через «Налаштування». «Редагувати» або імпорт CSV/XLSX створить власні дані лише цієї діаграми.</p>';
    if (b.type === 'table' || b.type === 'chart') {
      const offset = Math.min(b._editorPage || 0, Math.max(0, Math.ceil(b.rows.length / 20) - 1)) * 20;
      return `${blockInput(b,'caption','Примітка таблиці')}<div class="cms-table-editor span-2"><div class="table-scroll"><table><thead><tr>${b.columns.map((c,i)=>`<th><input aria-label="Назва колонки ${i+1}" data-block-id="${b.id}" data-table-column="${i}" value="${e(c)}">${button('remove-column','×',`data-block-id="${b.id}" data-col="${i}" aria-label="Видалити колонку ${i+1}"`,'secondary small')}</th>`).join('')}<th></th></tr></thead><tbody>${b.rows.slice(offset,offset+20).map((row,r)=>`<tr>${row.map((cell,c)=>`<td><input aria-label="Рядок ${offset+r+1}, колонка ${c+1}" data-block-id="${b.id}" data-table-row="${offset+r}" data-table-cell="${c}" value="${e(cell)}"></td>`).join('')}<td>${button('remove-row','×',`data-block-id="${b.id}" data-row="${offset+r}" aria-label="Видалити рядок ${offset+r+1}"`,'secondary small')}</td></tr>`).join('')}</tbody></table></div><div class="cms-table-tools">${button('add-row','+ Рядок',`data-block-id="${b.id}"`,'secondary small')}${button('add-column','+ Колонка',`data-block-id="${b.id}"`,'secondary small')}<span>${b.rows.length?offset+1:0}–${Math.min(offset+20,b.rows.length)} з ${b.rows.length} рядків</span>${button('table-prev','←',`data-block-id="${b.id}" ${offset===0?'disabled':''} aria-label="Попередні рядки"`,'secondary small')}${button('table-next','→',`data-block-id="${b.id}" ${offset+20>=b.rows.length?'disabled':''} aria-label="Наступні рядки"`,'secondary small')}</div></div>`;
    }
    if (b.type === 'metrics') return `<div class="cms-metrics-editor span-2">${b.items.map((item,i)=>`<div class="cms-metric-editor"><div class="form-grid">${[['label','Назва'],['value','Значення'],['unit','Одиниця'],['note','Примітка']].map(([field,label])=>`<label>${label}<input data-block-id="${b.id}" data-metric-index="${i}" data-metric-field="${field}" value="${e(item[field])}"></label>`).join('')}</div>${button('remove-metric','Видалити картку',`data-block-id="${b.id}" data-index="${i}"`,'secondary small')}</div>`).join('')}${button('add-metric','+ Картка показника',`data-block-id="${b.id}"`,'secondary small')}</div>`;
    return '';
  }
  function blockEditor(b, index) {
    return `<section class="cms-block-editor" data-editor-block="${b.id}"><div class="cms-block-top"><div><span class="cms-block-number">${String(index+1).padStart(2,'0')}</span><strong>${BLOCK_TYPES[b.type]}</strong>${!b.visible?'<span class="pill">Приховано</span>':''}</div><div class="cms-block-order">${button('block-up','↑',`data-block-id="${b.id}" ${index===0?'disabled':''} aria-label="Перемістити блок ${index+1} вгору"`,'secondary small')}${button('block-down','↓',`data-block-id="${b.id}" ${index===draft.blocks.length-1?'disabled':''} aria-label="Перемістити блок ${index+1} вниз"`,'secondary small')}</div></div>${widgetTools(b)}<div class="form-grid">${blockInput(b,'title',b.type==='existing'?'Назва в редакторі':'Заголовок блоку')}<label class="checkbox-label"><input type="checkbox" data-block-id="${b.id}" data-block-field="visible" ${b.visible?'checked':''}>Показувати блок</label>${blockFields(b)}</div><div class="cms-block-actions">${button('block-import',`${icon('upload')} Імпорт`, `data-block-id="${b.id}"`,'secondary small')}${button('block-export',`${icon('download')} Експорт`, `data-block-id="${b.id}"`,'secondary small')}${['analytics','existing'].includes(b.type)?button('analytics-import','Імпорт даних аналітики',`data-block-id="${b.id}"`,'secondary small')+button('analytics-export','Експорт даних аналітики',`data-block-id="${b.id}"`,'secondary small'):button('duplicate-block','Дублювати',`data-block-id="${b.id}"`,'secondary small')}${button('remove-block','Видалити',`data-block-id="${b.id}"`,'secondary small')}</div></section>`;
  }
  let previewTimer;
  function schedulePreview(delay = 0) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updateLivePreview, delay);
  }
  function updateLivePreview() {
    const frame = $('#cms-live-frame');
    if (!frame || !draft || !options.isAdmin()) return;
    // Match the visitor's viewport breakpoints, rather than the narrower iframe.
    const previewCSS = rules => [...rules].map(rule => {
      if (rule.type === CSSRule.MEDIA_RULE) return window.matchMedia(rule.conditionText).matches ? previewCSS(rule.cssRules) : '';
      return rule.cssText;
    }).join('\n');
    const css = [...document.styleSheets].map(sheet => {
      try { return previewCSS(sheet.cssRules); } catch { return ''; }
    }).join('\n').replaceAll('</style', '<\\/style');
    const root = document.documentElement;
    const content = `<div class="cms-frame-page">${options.renderHeader(draft)}${renderBlocks(draft,true)}</div>`;
    frame.onload = () => {
      const page = frame.contentDocument?.querySelector('.cms-frame-page');
      if (page) frame.style.height = `${Math.ceil(page.getBoundingClientRect().height)}px`;
      frame.contentDocument?.addEventListener('click',event=>{
        if(event.target.closest('summary,[data-project-query],[data-project-role],[data-project-program-select],.publication-filter-toolbar,.catalog-toolbar,[data-catalog-page-size],#all-years')&&!event.target.closest('[data-cms-action]'))return;event.preventDefault();const el=event.target.closest('[data-cms-action]');
        if(el)action(el.dataset.cmsAction,el).catch(showError);
        const yearButton=event.target.closest('[data-year]');
        if(yearButton){options.selectPreviewYear(+yearButton.dataset.year);schedulePreview();}
      });
      if(frame.contentDocument)view.bindInputs(frame.contentDocument);
      frame.contentDocument?.addEventListener('change',event=>{if(event.target.id==='all-years'){options.selectPreviewYear(+event.target.value);schedulePreview();}});
      frame.contentDocument?.addEventListener('toggle',()=>{if(page)frame.style.height=`${Math.ceil(page.getBoundingClientRect().height)}px`;},true);
    };
    frame.srcdoc = `<!doctype html><html lang="uk" data-theme="${e(root.dataset.theme || 'blue')}" ${root.hasAttribute('data-site-style')?'data-site-style':''} style="${e(root.getAttribute('style') || '')}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вигляд сторінки</title><style>${css}html,body{margin:0;min-width:0}.cms-frame-page{display:flow-root;padding:0;--period-sticky-top:0px}</style></head><body>${content}</body></html>`;
  }
  new MutationObserver(() => schedulePreview()).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-site-style','style']});
  window.addEventListener('resize', () => schedulePreview(100));
  function renderAdmin() {
    if (!draft) selectPage(site.pages[0].id, false);
    schedulePreview();
    return `<div class="page-heading"><div><div class="eyebrow">КЕРУВАННЯ ВМІСТОМ</div><h1>Адмінка сайта</h1><p>Сторінки, блоки та дані вашого університету.</p></div><div class="heading-actions">${button('new-page',`${icon('file')} Нова сторінка`,'','primary')}${button('publish-zip',`${icon('download')} Сайт для публікації`,dirty?'disabled':'')}</div></div><div class="notice cms-local-note">${icon('info')}<span><strong>Локальна адмінка без серверної авторизації.</strong> Редагування змінює лише цей браузер. Щоб опублікувати зміни для всіх, завантажте ZIP і замініть файли в GitHub. Чужі відвідувачі не можуть змінити серверні файли через цей редактор.</span></div><div class="cms-admin-tools"><button type="button" class="button secondary" data-action="export">${icon('download')}<span>Експорт даних</span></button><button type="button" class="button primary" data-action="import">${icon('upload')}<span>Імпорт даних</span></button>${button('project-reports','Надходження грантів за роками')}${button('site-export','Резервна копія сайта · JSON')}${button('site-import','Відновити сайт із JSON')}${button('page-import','Імпортувати сторінку · JSON')}</div><div class="cms-layout"><aside class="cms-page-list"><div class="section-head"><h2>Сторінки</h2><span class="pill">${site.pages.length}</span></div>${site.pages.map((p,n)=>`<div class="cms-page-row ${p.id===selected?'selected':''}"><button type="button" data-cms-action="select-page" data-page-id="${p.id}"><strong>${e(p.title)}</strong><span>${p.kind==='builtin'?'Вбудована':`#page/${e(p.slug)}`} ${p.visible?'':'· прихована'}</span></button><div>${button('page-up','↑',`data-page-id="${p.id}" ${n===0?'disabled':''} aria-label="Сторінка вгору"`,'secondary small')}${button('page-down','↓',`data-page-id="${p.id}" ${n===site.pages.length-1?'disabled':''} aria-label="Сторінка вниз"`,'secondary small')}</div></div>`).join('')}</aside><div class="cms-workbench"><section class="cms-live-pane" aria-label="Візуалізація сторінки"><div class="cms-live-heading"><div><h2>Вигляд сторінки</h2><p>Оновлюється автоматично · чернетка</p></div><span class="pill green">Наживо</span></div><iframe id="cms-live-frame" title="Візуалізація поточної сторінки" sandbox="allow-same-origin"></iframe></section><div class="cms-editor"><form id="cms-page-form"><section class="panel"><div class="section-head"><h2>Параметри сторінки</h2><span class="pill ${dirty?'amber':'green'}" id="cms-save-status">${dirty?'Є незбережені зміни':temporary?'Тимчасова копія':'Збережено в цьому браузері'}</span></div><div class="form-grid">${input('Назва в меню','title',draft.title,'required maxlength="120"')}${input('Адреса · латиницею','slug',draft.slug,`required pattern="[a-z0-9][a-z0-9-]{0,63}" ${draft.kind==='builtin'?'readonly':''}`)}${input('Надзаголовок','eyebrow',draft.eyebrow,'maxlength="240" placeholder="Порожнє поле приховує надзаголовок"')}${input('Заголовок сторінки','heading',draft.heading,'required maxlength="200"')}<label>Опис<input data-cms-field="description" value="${e(draft.description)}"></label><label class="checkbox-label"><input type="checkbox" data-cms-field="visible" ${draft.visible?'checked':''}>Показувати в меню</label><label class="checkbox-label"><input type="checkbox" data-cms-field="showYear" ${draft.showYear?'checked':''}>Показувати фільтр року</label><label class="checkbox-label"><input type="checkbox" data-cms-field="stickyYear" ${draft.stickyYear?'checked':''} ${draft.showYear?'':'disabled'}>Закріпити «Звітний період» під час прокручування</label></div><div class="cms-page-actions">${button('page-export','Експорт сторінки · JSON')}${button('duplicate-page','Копіювати сторінку')}${draft.kind==='custom'?button('delete-page','Видалити сторінку','','secondary danger'):''}</div></section><div class="section-head"><div><h2>Блоки сторінки</h2><p>Редагуйте вміст та змінюйте порядок стрілками.</p></div>${button('undo','Скасувати зміну',history.length?'':'disabled','secondary small')}</div>${draft.blocks.map(blockEditor).join('')}<section class="cms-block-palette"><h3>Додати блок</h3><div>${Object.entries(BLOCK_TYPES).filter(([key])=>key!=='existing').map(([key,title])=>button('add-block',`+ ${title}`,`data-block-type="${key}"`)).join('')}</div></section><div class="cms-save-bar"><span>Зміни застосуються до локальної копії сайта</span><button class="button primary" type="submit">${icon('check')} Зберегти сторінку</button></div><div class="form-error" id="cms-editor-error" role="alert"></div></form></div></div></div>`;
  }
  function transferBlock(block) { if(block.type==='catalog')return {...block,dataTable:editableTable(block)};return block.type==='analytics'?{...block,dataTable:editableTable(block),...(block.dataMode!=='manual'?{dataPeriod:options.getBlockPeriod(block)}:{})}:block; }
  function widgetTools(block) {
    const extra=`data-block-id="${block.id}"`;
    const tool=(action,label,ico)=>button(action,`${icon(ico)}<span>${label}</span>`,`${extra} title="${label}" aria-label="${label}: ${e(block.title||BLOCK_TYPES[block.type])}"`,'secondary small');
    return `<div class="cms-widget-toolbar" role="group" aria-label="Керування блоком">${tool('widget-settings','Налаштування','settings')}${tool('widget-edit','Редагувати','edit')}${tool('block-export','Експорт','download')}${tool('block-import','Імпорт','upload')}${button('widget-width',`${icon('width')}<span>${blockWidthLabel(resolvedSettings(block))}</span>`,`${extra} title="Ширина блоку" aria-label="Ширина блоку: ${e(block.title||BLOCK_TYPES[block.type])}"`,'secondary small')}</div>`;
  }
  function widgetDialog(block, kind) {
    if(block.type==='existing'&&kind==='edit'){options.openDataManager('import',block.source);return;}
    widgetState={kind,block:structuredClone(kind==='edit'?transferBlock(block):block),page:0,editLibrary:block.settings?.chartLibrary||'echarts'};
    widgetState.block.settings=resolvedSettings(block);
    if(kind==='edit')widgetState.table=isMetricBlock(block)?metricColorTable(editableTable(block)):editableTable(block);
    if(kind==='edit'&&block.type==='chart'&&block.binding&&block.binding.kind!=='manual'){const result=view.chartData(block);if(result.error)throw new Error(result.error);widgetState.table=result.table;widgetState.block.binding={...defaultChartBinding(),periodMode:result.period?'fixed':'all',period:result.period.replace('–','-')};}
    if(kind==='settings'&&publicationBlock(widgetState.block)&&!widgetState.block.catalog)widgetState.block.catalog=publicationCatalogConfig(editableTable(widgetState.block).headers,widgetState.block.settings.publicationTitleLinks);
    renderWidgetDialog();
  }
  function catalogFields(block){return catalogEditorFields(block,{table:view.catalogTable(block,true).table,result:view.catalogTable(block),sources:noteSourceOptions(block.id),sheets:widgetState?.catalogSheets||[],sheet:widgetState?.catalogSheet||'',error:widgetState?.catalogError||'',presentationOnly:publicationBlock(block)});}
  function refreshCatalogPreview(){if(catalogEditorBlock(widgetState?.block)&&$('#cms-catalog-preview')){const block=widgetState.block;$('#cms-catalog-preview').innerHTML=renderCatalog(block,view.catalogTable(block),{},5);}}
  function useCatalogTable(state,table){
    const old=state.block,fields=old.catalog.columns.flatMap(col=>col.lines.map(line=>line.field)).filter(Boolean),remap=old.binding.kind!=='upload'||!old.dataTable||fields.some(field=>!table.headers.includes(field));old.binding={...old.binding,kind:'upload'};old.dataTable=table;if(old.binding.yearColumn&&!table.headers.includes(old.binding.yearColumn))old.binding.yearColumn='';if(remap)old.catalog=inferCatalogConfig(table.headers);
  }
  function textLinkFields(block,widget=true){
    const attr=key=>widget?`data-widget-text="${key}"`:`data-block-id="${block.id}" data-block-field="${key}"`;
    return `<fieldset class="${widget?'':'span-2'}"><legend>Посилання</legend><div class="form-grid"><label>Текст посилання<input ${attr('linkLabel')} value="${e(block.linkLabel||'')}" maxlength="240" placeholder="Дослідити публікації"></label><label>Адреса посилання<input ${attr('linkUrl')} value="${e(block.linkUrl||'')}" maxlength="2000" placeholder="https://… або #publications"></label><label>Розміщення посилання<select ${attr('linkPlacement')}><option value="inline" ${block.linkPlacement!=='line'?'selected':''}>Продовження тексту</option><option value="line" ${block.linkPlacement==='line'?'selected':''}>Окремий рядок</option></select></label><label class="checkbox-label cms-setting-check"><input type="checkbox" ${attr('openInNewTab')} ${block.openInNewTab?'checked':''}><span>Відкривати в новій вкладці</span></label></div><p class="cms-field-help">Посилання додається в кінці тексту. Підтримуються адреси http/https та внутрішні сторінки, наприклад #publications або #page/slug. Щоб приховати посилання, очистьте його адресу.</p></fieldset>`;
  }
  function noteContentFields(block,widget=true){
    const attr=key=>widget?`data-widget-text="${key}"`:`data-block-id="${block.id}" data-block-field="${key}"`;
    return `<label class="${widget?'':'span-2'}">Вступ / виділений текст<input ${attr('lead')} value="${e(block.lead)}"></label><label class="${widget?'':'span-2'}">Текст примітки<textarea ${attr('text')} rows="4">${e(block.text)}</textarea></label><label>Як показувати відсутність даних<input ${attr('emptyText')} value="${e(block.emptyText)}"></label><label>Іконка<select ${attr('icon')}>${Object.entries(FEATURE_ICONS).map(([key,title])=>`<option value="${key}" ${block.icon===key?'selected':''}>${title}</option>`).join('')}</select></label><p class="cms-field-help ${widget?'':'span-2'}">Підстановки: {value} — результат; {unit} — одиниця; {period} — рік або період; {periodLabel} — «у 2026 році» / «за 2021–2025 роки»; {source} — назва джерела.</p>${widget?'':textLinkFields(block,false)}`;
  }
  function noteSourceOptions(id){
    return site.pages.flatMap(page=>(draft&&page.id===selected?draft:page).blocks.filter(block=>block.id!==id&&(['table','chart'].includes(block.type)||block.type==='analytics'&&Object.hasOwn(NOTE_SOURCES,block.source))).map(block=>({id:block.id,label:`${page.title} — ${block.title||BLOCK_TYPES[block.type]}${!page.visible||!block.visible?' (прихований)':''}`})));
  }
  const noteUnit=source=>['funding','programs','fundingSources','fundingTable','fundingStats'].includes(source)?'тис. грн':source==='projectChart'?'проєктів':['patentFaculties','patentStats','patents'].includes(source)?'патентів':'публікацій';
  function noteBindingFields(block){
    const b=block.binding,select=(key,label,values)=>`<label>${label}<select data-note-binding="${key}">${Object.entries(values).map(([value,title])=>`<option value="${e(value)}" ${b[key]===value?'selected':''}>${e(title)}</option>`).join('')}</select></label>`;
    const field=(key,label,extra='')=>`<label>${label}<input data-note-binding="${key}" value="${e(b[key])}" ${extra}></label>`;
    let table=null;try{table=view.noteTable(block);}catch{}
    const headers=table?.headers||[],rows=[...new Set((table?.rows||[]).map(row=>row[0]))].slice(0,100),blocks=noteSourceOptions(block.id),blockOptions=Object.fromEntries([['','Оберіть таблицю або діаграму'],...blocks.map(item=>[item.id,item.label])]);if(b.blockId&&!Object.hasOwn(blockOptions,b.blockId))blockOptions[b.blockId]='Джерело не знайдено — виберіть інше';
    const columns={'':'Підібрати автоматично','*':'Усі числові колонки (разом)',...Object.fromEntries(headers.map(h=>[h,h]))};if(b.column&&!Object.hasOwn(columns,b.column))columns[b.column]=b.column+' (відсутня у джерелі)';
    return `<fieldset><legend>Джерело та період даних</legend>${select('kind','Звідки брати дані',{builtin:'Таблиці аналітики сайта',block:'Обрана таблиця або діаграма на сторінках',manual:'Вказати власне значення або текст'})}${b.kind==='builtin'?select('source','Таблиця аналітики',NOTE_SOURCES):b.kind==='block'?select('blockId','Таблиця / діаграма',blockOptions):field('manualValue','Власне значення або текст')}${select('periodMode','Як реагувати на перемикання року',{year:'Оновлювати за вибраним роком сторінки',fixed:'Показувати фіксований рік або період'})}${b.periodMode==='fixed'?field('period','Рік або період','placeholder="2021-2025" maxlength="20"'):''}<p class="cms-field-help">Для фіксованого періоду значення та підпис не змінюються при перемиканні року. Для власної таблиці додайте колонку «Рік» або колонки 2024, 2025 тощо; без року її дані залишаються однаковими.</p>${b.kind==='manual'?'':`${select('operation','Що показувати',NOTE_OPERATIONS)}${!['count','distinct'].includes(b.operation)?select('column','Колонка даних',columns):''}${field('row','Рядок за назвою з першої колонки (необов’язково)','list="cms-note-row-options" placeholder="Усі рядки"')}<datalist id="cms-note-row-options">${rows.map(row=>`<option value="${e(row)}"></option>`).join('')}</datalist><p class="cms-field-help">Сума, середнє, мінімум і максимум обчислюються з числових клітинок. «Значення одного рядка» може показувати й текст. Порожні клітинки та «—» не вважаються нулями.</p>`}<div class="form-grid">${field('unit','Одиниця виміру (необов’язково)')}${field('decimals','Знаків після коми','type="number" min="0" max="6" step="1"')}</div></fieldset><fieldset><legend>Попередній перегляд результату</legend><div id="cms-note-preview" aria-live="polite">${renderDataNote(block,view.noteResult(block))}</div></fieldset>`;
  }
  function chartSeriesFields(binding,table){
    const rules=binding.seriesRules||[];
    return `<fieldset><legend>Власні серії</legend><p class="cms-field-help">Додайте серії з власними назвами та виберіть значення колонки, які до них входять. Усередині однієї серії кожен рядок рахується один раз. Якщо рядок відповідає кільком серіям, він входить у кожну з них. Без власних правил діє автоматичний поділ на серії. Для підрахунку за indexes оберіть джерело «Публікації (вихідні записи)» і колонку «Індексація (indexes)».</p>${rules.map((rule,i)=>{
      const column=table.headers.indexOf(rule.column),values=[...new Set([...(table.rows||[]).map(r=>r[column]??''),...rule.values])].sort((a,b)=>a.localeCompare(b,'uk'));
      return `<fieldset class="cms-chart-series-rule"><legend>Серія ${i+1}</legend><div class="form-grid"><label>Назва серії<input data-chart-rule="${i}" data-rule-field="name" value="${e(rule.name)}" maxlength="160"></label><label>Колонка ознаки<select data-chart-rule="${i}" data-rule-field="column">${[...new Set([...table.headers,rule.column])].map(h=>`<option value="${e(h)}" ${h===rule.column?'selected':''}>${e(h==='Індексація'?'Індексація (indexes)':h)}</option>`).join('')}</select></label></div><label>Значення для включення (можна вибрати кілька)<select multiple size="5" data-chart-rule="${i}" data-rule-field="values">${values.map(value=>`<option value="${e(value)}" ${rule.values.includes(value)?'selected':''}>${e(value||'(порожнє значення)')}</option>`).join('')}</select></label><label class="checkbox-label cms-series-visible"><input type="checkbox" data-chart-rule="${i}" data-rule-field="visible" ${rule.visible?'checked':''}>Показувати серію</label>${button('widget-series-remove','Видалити серію',`data-rule-index="${i}"`,'secondary small')}</fieldset>`;
    }).join('')}${button('widget-series-add','+ Додати серію',rules.length>=30?'disabled':'','secondary small')}</fieldset>`;
  }
  function chartBindingFields(block){
    const b=block.binding||{...defaultChartBinding(),periodMode:block.settings?.allYears?'all':'year'},configured={...block,binding:b};
    if(widgetState?.kind==='edit'){configured.columns=widgetState.table.headers;configured.rows=widgetState.table.rows;}
    const sourceResult=view.chartData(configured,true),table=sourceResult.table,headers=table.headers;
    const select=(key,label,values)=>`<label>${label}<select data-chart-binding="${key}">${Object.entries(b[key]&&!Object.hasOwn(values,b[key])?{...values,[b[key]]:b[key]+' (відсутня у джерелі)'}:values).map(([v,t])=>`<option value="${e(v)}" ${b[key]===v?'selected':''}>${e(t)}</option>`).join('')}</select></label>`;
    const sources=Object.fromEntries([['','Оберіть таблицю'],...noteSourceOptions(block.id).map(x=>[x.id,x.label])]);if(b.blockId&&!sources[b.blockId])sources[b.blockId]='Джерело не знайдено';
    return `<fieldset><legend>Джерело та період даних</legend>${select('kind','Звідки брати дані',{manual:'Ручне введення / імпорт CSV/XLSX',builtin:'Таблиці аналітики сайта',block:'Обрана таблиця на сторінках'})}${b.kind==='builtin'?select('source','Таблиця-джерело',{...NOTE_SOURCES,publications:'Публікації (вихідні записи)',publicationChart:'Публікації за роками (готове зведення)'}):b.kind==='block'?select('blockId','Таблиця-джерело',sources):''}${select('periodMode','Період даних',{year:'За вибраним роком сторінки',fixed:'Фіксований рік або період',all:'За всі роки'})}${b.periodMode==='fixed'?`<label>Рік або період<input data-chart-binding="period" value="${e(b.period)}" placeholder="2021-2025"></label>`:''}${select('yearColumn','Колонка року / дати',{'':'Автоматично',...Object.fromEntries(headers.map(h=>[h,h]))})}<div class="form-grid cms-chart-group-sort">${select('groupColumn','Групування (підписи)',{'':'Перша колонка',...Object.fromEntries(headers.map(h=>[h,h]))})}${select('sortOrder','Сортування',CHART_SORTS)}</div><p class="cms-field-help">Сортування за значенням враховує суму всіх серій після розрахунку. Порожні значення та нечислові підписи для числового сортування розміщуються в кінці.</p>${select('seriesColumn','Розділити на серії',{'':'Без поділу',...Object.fromEntries(headers.map(h=>[h,h]))})}${chartSeriesFields(b,table)}${select('operation','Розрахунок',{count:'Кількість',sum:'Сума',avg:'Середнє',min:'Мінімум',max:'Максимум'})}<p class="cms-field-help">Колонки значень (без вибору — усі числові). Порожні клітинки не вважаються нулями. Без колонки року власна таблиця однакова для всіх років.</p>${[...new Set([...headers,...b.valueColumns])].map(h=>`<label class="checkbox-label cms-chart-value-option"><input type="checkbox" data-chart-value="${e(h)}" ${b.valueColumns.includes(h)?'checked':''}>${e(h)}</label>`).join('')}${sourceResult.error?`<p class="form-error">${e(sourceResult.error)}</p>`:''}</fieldset><fieldset><legend>Попередній перегляд результату</legend><div id="cms-chart-preview" aria-live="polite">${chartPreview(configured)}</div></fieldset>`;
  }
  function chartPreview(block){const result=view.chartData({...block,settings:widgetSettings()});return result.error?`<p class="form-error">${e(result.error)}</p>`:renderChartTable({...block,settings:widgetSettings()},result.table);}
  function refreshChartPreview(){if(widgetState?.block.type!=='chart'||!$('#cms-chart-preview'))return;const block={...widgetState.block,binding:widgetState.block.binding||{...defaultChartBinding(),periodMode:widgetState.block.settings.allYears?'all':'year'}};if(widgetState.kind==='edit'){block.columns=widgetState.table.headers;block.rows=widgetState.table.rows;}$('#cms-chart-preview').innerHTML=chartPreview(block);}
  function refreshNotePreview(){if(widgetState?.block.type==='dataNote'&&$('#cms-note-preview'))$('#cms-note-preview').innerHTML=renderDataNote(widgetState.block,view.noteResult(widgetState.block));}
  function featureContentFields(block, widget = true) {
    const attr=key=>widget?`data-widget-text="${key}"`:`data-block-id="${block.id}" data-block-field="${key}"`;
    const text=(key,label,rows=0)=>`<label class="${widget?'':'span-2'}">${label}${rows?`<textarea ${attr(key)} rows="${rows}">${e(block[key])}</textarea>`:`<input ${attr(key)} value="${e(block[key])}">`}</label>`;
    const select=(key,label,values)=>`<label>${label}<select ${attr(key)}>${Object.entries(values).map(([value,name])=>`<option value="${value}" ${block[key]===value?'selected':''}>${name}</option>`).join('')}</select></label>`;
    return `${text('eyebrow','Напис біля іконки')}${text('headline','Заголовок картки',2)}${text('text','Опис картки',4)}${text('linkLabel','Текст посилання')}${text('linkUrl','Адреса посилання · https://… або #page/slug')}${select('icon','Іконка біля напису',FEATURE_ICONS)}${select('linkIcon','Іконка посилання',FEATURE_LINK_ICONS)}<label class="checkbox-label"><input type="checkbox" ${attr('openInNewTab')} ${block.openInNewTab?'checked':''}>Відкривати посилання в новій вкладці</label><p class="cms-field-help ${widget?'':'span-2'}">Порожній текст приховує відповідний елемент. Для приховування посилання очистьте його адресу. Переноси рядків у заголовку й описі зберігаються.</p>`;
  }
  function featureAppearanceFields(block) {
    const style=validateFeatureStyle(block.appearance);
    const select=(key,label,values)=>`<label>${label}<select data-feature-style="${key}">${Object.entries(values).map(([value,name])=>`<option value="${value}" ${style[key]===value?'selected':''}>${name}</option>`).join('')}</select></label>`;
    const field=(key,label,type,extra='')=>`<label>${label}<input type="${type}" data-feature-style="${key}" value="${style[key]}" ${extra}></label>`;
    return `<fieldset><legend>Оформлення картки</legend><label class="checkbox-label cms-setting-check"><input type="checkbox" data-feature-style="autoHeight" ${style.autoHeight?'checked':''}><span><strong>Висота по тексту</strong><small>Висота картки та блоку підлаштовується під вміст. Мінімальна висота не застосовується.</small></span></label><div class="form-grid">${select('background','Фон картки',TEXT_BACKGROUNDS)}${field('backgroundColor','Власний колір фону','color')}${select('align','Вирівнювання',{left:'Ліворуч',center:'По центру',right:'Праворуч'})}${[['eyebrowColor','Колір напису й іконки'],['headingColor','Колір заголовка'],['textColor','Колір опису'],['linkColor','Колір посилання'],['borderColor','Колір рамки']].map(([key,label])=>field(key,label,'color')).join('')}${[['minHeight','Мінімальна висота картки, px',0,1000],['padding','Внутрішні відступи, px',0,80],['radius','Заокруглення кутів, px',0,80],['borderWidth','Товщина рамки, px',0,10],['eyebrowSize','Розмір напису біля іконки, px',10,36],['headingSize','Розмір заголовка, px',12,64],['textSize','Розмір опису, px',10,36],['linkSize','Розмір посилання, px',10,36]].map(([key,label,min,max])=>field(key,label,'number',`min="${min}" max="${max}" step="1" ${key==='minHeight'&&style.autoHeight?'disabled':''}`)).join('')}</div><p class="cms-field-help">Власний колір фону застосовується, коли вибрано фон «Власний колір». Висота може збільшуватися, щоб умістити весь текст.</p></fieldset>`;
  }
  function metricBackgroundEditor(table,row,index){
    const background=row[table.headers.indexOf('background')]||'default',color=row[table.headers.indexOf('backgroundColor')]||'#25395d';
    return `<div class="cms-metric-background-editor" data-metric-background-index="${index}"><label for="metric-background-${index}">Фон картки ${index+1}</label>${button('metric-background-open',`<i class="cms-metric-background-swatch cms-text-bg-${background}" ${background==='custom'?`style="--text-block-bg:${color}"`:''} aria-hidden="true"></i><span>${e(TEXT_BACKGROUNDS[background])}</span>${icon('chevron')}`,`id="metric-background-${index}" data-row="${index}" aria-label="Вибрати фон картки ${index+1}" aria-haspopup="dialog" aria-controls="cms-metric-background-dialog"`,'secondary cms-metric-background-trigger')}</div>`;
  }
  function openMetricBackground(index){
    if(!widgetState||widgetState.kind!=='edit'||!isMetricBlock(widgetState.block)||!widgetState.table.rows[index])return;
    const table=widgetState.table,row=table.rows[index];
    metricPalette={index,background:row[table.headers.indexOf('background')]||'default',backgroundColor:row[table.headers.indexOf('backgroundColor')]||'#25395d'};
    let dialog=$('#cms-metric-background-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='cms-metric-background-dialog';document.body.append(dialog);dialog.addEventListener('input',updateMetricBackground);dialog.addEventListener('change',updateMetricBackground);dialog.addEventListener('cancel',()=>{metricPalette=null;});}
    const label=table.headers.indexOf('label'),name=label<0?'':row[label];
    dialog.innerHTML=`<div class="dialog-heading"><h2 id="cms-metric-background-title">Фон картки ${index+1}</h2>${button('metric-background-cancel','×','aria-label="Закрити вибір фону"','secondary small')}</div><div class="dialog-body"><p class="cms-widget-name">${e(name)}</p><p class="cms-field-help">Кольори теми змінюються разом із темою сайта. Власний колір залишається вибраним; колір тексту підбирається автоматично.</p><div class="cms-text-background-options">${Object.entries(TEXT_BACKGROUNDS).map(([key,title])=>`<label class="cms-text-background-option"><input type="radio" name="metricBackgroundChoice" data-metric-palette-background value="${key}" ${metricPalette.background===key?'checked':''}><i class="cms-text-bg-${key}" ${key==='custom'?`style="--text-block-bg:${metricPalette.backgroundColor}"`:''} aria-hidden="true"></i><span>${e(title)}</span></label>`).join('')}</div><label class="cms-metric-palette-color">Вибрати колір із палітри<input type="color" data-metric-palette-color value="${metricPalette.backgroundColor}" aria-label="Власний колір фону картки ${index+1}"></label><div id="cms-metric-background-error" class="form-error" role="alert"></div><div class="dialog-actions">${button('metric-background-cancel','Скасувати')}${button('metric-background-apply','Застосувати','','primary')}</div></div>`;
    dialog.setAttribute('aria-labelledby','cms-metric-background-title');dialog.showModal();
  }
  function updateMetricBackground(event){
    if(!metricPalette)return;const el=event.target;
    if(el.hasAttribute('data-metric-palette-background'))metricPalette.background=el.value;
    if(el.hasAttribute('data-metric-palette-color')){metricPalette.backgroundColor=el.value;metricPalette.background='custom';$('#cms-metric-background-dialog input[value="custom"]').checked=true;$('#cms-metric-background-dialog .cms-text-bg-custom').style.setProperty('--text-block-bg',el.value);}
  }
  function closeMetricBackground(apply=false){
    if(!metricPalette)return;
    const {index,background,backgroundColor}=metricPalette;
    if(apply){const table=widgetState.table,row=table.rows[index],valid=validateMetricBackground(background,backgroundColor);row[table.headers.indexOf('background')]=valid.background;row[table.headers.indexOf('backgroundColor')]=valid.backgroundColor;}
    $('#cms-metric-background-dialog').close();metricPalette=null;
    if(apply){const editor=$(`#cms-widget-dialog [data-metric-background-index="${index}"]`);editor.outerHTML=metricBackgroundEditor(widgetState.table,widgetState.table.rows[index],index);$(`#metric-background-${index}`).focus();}
  }
  function widgetSettings(){return chartSettingsForLibrary(widgetState.block.settings,widgetState.editLibrary,widgetState.block.source);}
  function storeWidgetSetting(key,value){
    const state=widgetState,settings=state.block.settings;
    if(LIBRARY_SETTING_KEYS.includes(key)){
      const library=state.editLibrary;
      settings.librarySettings ||= {};
      settings.librarySettings[library] ||= Object.fromEntries(LIBRARY_SETTING_KEYS.map(k=>[k,structuredClone(widgetSettings()[k])]));
      settings.librarySettings[library][key]=value;
      if(library===settings.chartLibrary)settings[key]=value;
    }else settings[key]=value;
  }
  function renderWidgetDialog() {
    if(!widgetState)return;
    let dialog=$('#cms-widget-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='cms-widget-dialog';document.body.append(dialog);}
    const {kind,block}=widgetState,s=widgetSettings(),metric=isMetricBlock(block);
    const chartSettings=kind==='settings'&&(block.type==='chart'||(block.type==='analytics'&&CHART_SOURCES.includes(block.source)));
    const totalLabel=s.chartType==='horizontalStacked'?'Показувати значення справа від стовпчиків':s.chartType==='horizontal'?'Виводити загальну суму справа від стовпчиків':s.chartType==='progress'?'Показувати значення справа від смуг':'Виводити загальну суму над стовпчиками';
    const field=(label,key,type='text',extra='')=>`<label>${label}<input type="${type}" data-widget-setting="${key}" value="${e(s[key])}" ${extra}></label>`;
    const check=(key,label,detail='')=>`<label class="checkbox-label cms-setting-check"><input type="checkbox" data-widget-setting="${key}" ${s[key]?'checked':''}><span><strong>${label}</strong>${detail?`<small>${detail}</small>`:''}</span></label>`;
    const percentageOptions=`<div class="cms-percentage-options" data-percentage-options ${s.segmentPercentages?'':'hidden'}><label>Округлення відсотків<select data-widget-setting="segmentPercentageDecimals"><option value="1" ${s.segmentPercentageDecimals===1?'selected':''}>До десятих (12,3%)</option><option value="0" ${s.segmentPercentageDecimals===0?'selected':''}>До цілих (12%)</option></select></label><div data-small-percentage-option ${s.segmentPercentageDecimals===0?'':'hidden'}>${check('smallPercentagesAsDecimal','Якщо відсоток менше 1%, показувати з округленням до десятих','Наприклад: 0,4% замість 0%.')}</div></div>`;
    const width=`<fieldset><legend>Ширина блоку</legend><label>Спосіб визначення ширини<select data-widget-setting="widthMode">${Object.entries(BLOCK_WIDTH_MODES).map(([value,label])=>`<option value="${value}" ${s.widthMode===value?'selected':''}>${label}</option>`).join('')}</select></label><div data-width-percent ${s.widthMode==='percent'?'':'hidden'}><div class="cms-width-options">${[33,50,66,75,100].map(w=>button('widget-width-preset',`${w}%`,`data-width="${w}" aria-pressed="${s.width===w}"`,s.width===w?'primary small':'secondary small')).join('')}</div>${field('Вказати свій %','width','number','min="1" max="100" step="0.1"')}</div><div data-width-fixed ${s.widthMode==='fixed'?'':'hidden'}>${field('Ширина блоку, px','widthPixels','number','min="80" max="4000" step="1"')}<p class="cms-field-help">Сусідньому блоку виберіть «Підібрати автоматично», щоб він заповнив решту рядка.</p></div><p class="cms-field-help" data-width-auto ${s.widthMode==='auto'?'':'hidden'}>Заповнює вільну ширину поруч із фіксованими блоками. Кілька автоматичних блоків ділять залишок порівну.</p><p class="cms-field-help">На телефоні блоки розміщуються один під одним на всю ширину.</p></fieldset>`;
    let body='';
    if(kind==='width')body=width;
    else if(kind==='settings'){
      const cards=metric;
      body=`<div class="form-grid"><label>Заголовок<input data-widget-text="title" value="${e(block.title)}" maxlength="240"></label><label>Підзаголовок<input data-widget-text="subtitle" value="${e(block.subtitle??(block.type==='analytics'?defaultBlockSubtitle(block.source):''))}" maxlength="2000"></label></div>`;
      if(block.type==='feature')body+=`<fieldset><legend>Вміст картки</legend>${featureContentFields(block)}</fieldset>${featureAppearanceFields(block)}`;
      if(block.type==='catalog')body+=catalogFields(block);
      if(block.type==='dataNote')body+=`<fieldset><legend>Вміст примітки</legend>${noteContentFields(block)}</fieldset>${textLinkFields(block)}${noteBindingFields(block)}`;
      if(block.type==='text')body+=textLinkFields(block);
      if(block.type==='analytics')body+=`<label class="cms-field-help">Джерело даних<select data-widget-text="dataMode"><option value="live" ${block.dataMode!=='manual'?'selected':''}>Аналітика сайта — автоматичний розрахунок</option><option value="manual" ${block.dataMode==='manual'?'selected':''}>Власні дані цього блоку</option></select></label><p class="cms-field-help">${metric?'Зміна лише фону або порядку карток зберігає автоматичний розрахунок. Ручна зміна чисел і текстів створює власні дані блоку.':'Редагування та імпорт CSV/XLSX створюють власні дані лише для цього блоку.'} Для зміни вихідних записів усіх пов’язаних блоків використайте «Керування даними».</p>`;
      if(chartSettings){
        body+=`<section class="cms-chart-libraries" aria-label="Бібліотеки діаграм"><div class="cms-library-row"><div><strong>Активна бібліотека для діаграм</strong><p>Налаштування зберігаються окремо під кожну бібліотеку</p></div><div class="cms-library-options" role="group" aria-label="Активна бібліотека для діаграм">${Object.entries(CHART_LIBRARIES).map(([key,label])=>button('widget-library-active',label,`data-library="${key}" aria-pressed="${block.settings.chartLibrary===key}"`,block.settings.chartLibrary===key?'primary small':'secondary small')).join('')}</div></div><div class="cms-library-row cms-library-editor"><strong>Редагувати параметри для:</strong><div class="cms-library-options" role="group" aria-label="Бібліотека для редагування параметрів">${Object.entries(CHART_LIBRARIES).map(([key,label])=>button('widget-library-edit',`${label}${block.settings.chartLibrary===key?' (активна)':''}`,`data-library="${key}" aria-pressed="${widgetState.editLibrary===key}"`,widgetState.editLibrary===key?'primary small':'secondary small')).join('')}</div></div></section>`;
        body+=`<label>Тип графіка<select data-widget-setting="chartType">${Object.entries(CHART_TYPES).map(([value,label])=>`<option value="${value}" ${s.chartType===value?'selected':''}>${label}</option>`).join('')}</select></label><fieldset><legend>Кольорова схема стовпчиків / серій</legend><div class="cms-palette-grid">${Object.entries(BLOCK_PALETTES).map(([key,p])=>`<label class="cms-palette-option"><input type="radio" name="widgetPalette" data-widget-setting="palette" value="${key}" ${s.palette===key?'checked':''}><strong>${p.name}</strong><span class="cms-color-strip">${p.colors.map(c=>`<i style="background:${c}"></i>`).join('')}</span></label>`).join('')}<label class="cms-palette-option"><input type="radio" name="widgetPalette" data-widget-setting="palette" value="custom" ${s.palette==='custom'?'checked':''}><strong>Власна тема</strong><span class="cms-color-strip">${s.customColors.map(c=>`<i style="background:${c}"></i>`).join('')}</span></label></div><div class="cms-custom-colors">${s.customColors.map((color,i)=>`<label>Колір ${i+1}<input type="color" data-widget-color="${i}" value="${color}"></label>`).join('')}${button('widget-add-color','+ Колір','','secondary small')}${button('widget-remove-color','− Колір',s.customColors.length<=1?'disabled':'','secondary small')}</div></fieldset><fieldset><legend>Розташування легенди</legend><div class="cms-legend-layout"><div class="cms-legend-options">${[['top','Вгорі'],['bottom','Внизу'],['right','Праворуч'],['none','Приховати']].map(([value,label])=>`<label><input type="radio" name="widgetLegend" data-widget-setting="legend" value="${value}" ${s.legend===value?'checked':''}>${label}</label>`).join('')}</div><label class="cms-legend-center" ${['top','bottom'].includes(s.legend)?'':'hidden'}><input type="checkbox" data-widget-setting="legendCentered" ${s.legendCentered?'checked':''}>Вирівняти по центру</label></div></fieldset><fieldset><legend>Відображення значень і підсумків</legend>${s.chartType==='progress'?check('numbering','Нумерація','Показувати порядковий номер на початку кожного рядка.'):''}${isHorizontalChartType(s.chartType)?check('wrapLabels','Переносити довгі назви','Назва, яка не вміщується по ширині, переноситься на наступні рядки; їхня висота збільшується автоматично.'):''}${check('totalLabels',totalLabel,'Підсумок ураховує лише активні серії легенди; у кільцевій діаграмі показується в центрі.')}${check('tooltipTotal','Показувати підсумок «Разом» у спливаючій підказці')}${s.chartType==='progress'?'':check('segmentValues','Відображати числові значення всередині сегментів')}${['donut','pie'].includes(s.chartType)?check('segmentPercentages','Відображати числові значення всередині сегментів у відсотках','Частка розраховується від суми видимих сегментів. Можна одночасно показувати числа й відсотки.')+percentageOptions:''}${block.type==='chart'?'':check('allYears','Відображати загальний звіт за весь період','Якщо вимкнено, аналітика та рядки з роками використовують вибраний звітний рік.')}${field('Висота графіка, px','height','number','min="180" max="800"')}${check('showChartData','Відображати Дані графіка','Показувати під діаграмою розділ із таблицею її даних. За замовчуванням вимкнено.')}</fieldset>`;
      }
      if(['text','dataNote'].includes(block.type))body+=`<fieldset><legend>${block.type==='dataNote'?'Фон примітки':'Фон текстового блоку'}</legend>${block.type==='text'?check('showTextFrame','Додати рамку','Зовнішня рамка з відступами навколо всього блоку, як в інформаційній картці.'):''}<p class="cms-field-help">Кольори теми змінюються разом із темою сайта. Власний колір залишається вибраним; колір тексту підбирається автоматично.</p><div class="cms-text-background-options">${Object.entries(TEXT_BACKGROUNDS).map(([key,label])=>`<label class="cms-text-background-option"><input type="radio" name="textBackground" data-widget-setting="background" value="${key}" ${s.background===key?'checked':''}><i class="cms-text-bg-${key}" ${key==='custom'?`style="--text-block-bg:${s.backgroundColor}"`:''} aria-hidden="true"></i><span>${label}</span></label>`).join('')}</div><div class="cms-custom-colors"><label>Вибрати колір із палітри<input type="color" data-widget-setting="backgroundColor" value="${s.backgroundColor}"></label></div></fieldset>`;
      if(block.type==='list')body+=`<label class="checkbox-label cms-setting-check"><input type="checkbox" data-widget-text="ordered" ${block.ordered?'checked':''}><span>Нумерований список</span></label>`;
      if(block.type==='table')body+=`<label>Примітка таблиці<input data-widget-text="caption" value="${e(block.caption)}" maxlength="2000"></label>`;
      if(block.type==='banner')body+=`<div class="form-grid"><label>Оформлення<select data-widget-text="tone">${[['green','Зелене'],['blue','Синє'],['amber','Тепле'],['dark','Темне']].map(([v,t])=>`<option value="${v}" ${block.tone===v?'selected':''}>${t}</option>`).join('')}</select></label><label>Текст кнопки<input data-widget-text="linkLabel" value="${e(block.linkLabel)}"></label><label>Посилання<input data-widget-text="linkUrl" value="${e(block.linkUrl)}"></label></div>`;
      if(block.type==='analytics'&&block.source==='projects')body+=`<fieldset><legend>Картки грантових проєктів</legend>${check('showProjectGlobe','Показувати земну кулю для міжнародних проєктів')}${check('showProjectFlag','Показувати прапор України для українських проєктів')}<p class="cms-field-help">Вимкніть обидва пункти, щоб приховати позначення. Для ручних даних колонка «Міжнародний»: true — міжнародний, false — український; порожнє значення — тип не вказано. Смуга внизу картки показує часовий прогрес за датами виконання.</p></fieldset>`;
      if(publicationBlock(block))body+=`<p class="cms-field-help">Додаткові колонки (DOI, посилання Scopus / WoS та інші) зберігаються у вихідних даних. Нижче виберіть, які з них показувати, шукати й фільтрувати. Назву статті можна пов’язати з колонкою DOI. Зміна оформлення не змінює дані для розрахунку показників.</p>${catalogFields(block)}`;
      if(metric&&block.type==='analytics'&&block.dataMode==='manual')body+=`<div class="notice"><span>Можна повернути автоматичні показники, іконки та порівняння. Кольори збережуться; ручні дані залишаться доступними в ручному режимі.</span></div>${button('widget-metric-live','Відновити автоматичні картки зі збереженням кольорів')}`;
      if(cards)body+=`<fieldset><legend>Картки показників</legend>${check('autoColumns','Без обмеження кількості карток по ширині','Картки автоматично заповнюють доступну ширину блоку й переносяться на наступний рядок. Фіксована кількість карток не застосовується.')}${field('Кількість карток по ширині','columns','number',`min="1" max="6" step="1" ${s.autoColumns?'disabled':''}`)}<p class="cms-field-help">Для фіксованої кількості: від 1 до 6 карток у рядку. На телефоні — не більше двох.</p></fieldset>`;
      if(['table','list','metrics','chart','analytics','catalog'].includes(block.type))body+=`<fieldset><legend>Відображення вмісту</legend>${check('showAll','Показувати весь список (без прокрутки)','За замовчуванням увімкнено для нових блоків. Весь вміст показується без вертикальної прокрутки; у каталозі також вимикається поділ на сторінки.')}</fieldset>`;
      if(!['feature','dataNote','catalog','chart'].includes(block.type)&&(block.type!=='analytics'||block.dataMode==='manual'))body+=`<fieldset><legend>Період даних</legend>${field('Рік або діапазон (необов’язково)','period','text','maxlength="20" placeholder="2026 або 2021-2026"')}<p class="cms-field-help">Якщо порожньо, період визначається з років у даних або з періоду, за який було створено ручну копію.</p></fieldset>`;
      body+=width;
    } else if(block.type==='text') {
      body=`<label>Текст · абзаци розділяються порожнім рядком<textarea data-widget-text="text" rows="7">${e(block.text)}</textarea></label>${textLinkFields(block)}`;
    } else if(block.type==='feature') {
      body=featureContentFields(block);
    } else if(block.type==='catalog') {
      body=catalogFields(block);
    } else if(block.type==='dataNote') {
      body=noteContentFields(block)+textLinkFields(block)+noteBindingFields(block);
    } else {
      const table=widgetState.table,offset=widgetState.page*20,free=['table','chart','analytics'].includes(block.type);
      const visibleColumns=table.headers.map((h,c)=>({h,c})).filter(({h})=>!metric||!['background','backgroundColor'].includes(h));
      body=`${block.type==='chart'||CHART_SOURCES.includes(block.source)?`<label>Тип графіка<select data-widget-setting="chartType">${Object.entries(CHART_TYPES).map(([v,t])=>`<option value="${v}" ${s.chartType===v?'selected':''}>${t}</option>`).join('')}</select></label>`:''}<p class="cms-field-help">${block.type==='analytics'?(metric?'Зміна лише фону або порядку карток зберігає автоматичний розрахунок, іконки та порівняння. Зміна чисел або текстів створює власні дані цього блоку. ':`Застосування створить власні дані лише для цього блоку. Вихідні записи сайта залишаться окремими. ${block.source==='publications'?'Каталог збереже пошук, фільтри та оформлення. Назви колонок визначають поля: зберігайте їхні назви; порядок можна змінювати. Поле «Посилання» використовується для назви статті. ':''}`):''}Перетягуйте рядки й колонки за значок ⋮⋮ або використовуйте стрілки. ${block.type==='chart'||CHART_SOURCES.includes(block.source)?'Перша колонка — підписи, решта — числові серії. Порожнє значення означає відсутність даних.':''}</p><div class="cms-data-editor"><table><thead><tr><th></th>${visibleColumns.map(({h,c})=>`<th data-drop-axis="column" data-drop-index="${c}"><input aria-label="Назва колонки ${c+1}" data-widget-header="${c}" value="${e(h)}"><div class="cms-cell-actions"><button type="button" class="button secondary small" draggable="true" data-drag-axis="column" data-drag-index="${c}" aria-label="Перетягнути колонку ${c+1}">⋮⋮</button>${button('widget-move-column','←',`data-from="${c}" data-to="${c-1}" ${c===0?'disabled':''}`,'secondary small')}${button('widget-move-column','→',`data-from="${c}" data-to="${c+1}" ${c===table.headers.length-1?'disabled':''}`,'secondary small')}${free?button('widget-delete-column','×',`data-col="${c}"`,'secondary small'):''}</div></th>`).join('')}${metric?'<th class="cms-metric-background-heading">Фон картки</th>':''}<th></th></tr></thead><tbody>${table.rows.slice(offset,offset+20).map((row,i)=>{const r=i+offset;return `<tr data-drop-axis="row" data-drop-index="${r}"><td><div class="cms-row-actions"><button type="button" class="button secondary small" draggable="true" data-drag-axis="row" data-drag-index="${r}" aria-label="Перетягнути рядок ${r+1}">⋮⋮</button>${button('widget-move-row','↑',`data-from="${r}" data-to="${r-1}" ${r===0?'disabled':''}`,'secondary small')}${button('widget-move-row','↓',`data-from="${r}" data-to="${r+1}" ${r===table.rows.length-1?'disabled':''}`,'secondary small')}</div></td>${visibleColumns.map(({c})=>`<td><input aria-label="Рядок ${r+1}, колонка ${c+1}" data-widget-row="${r}" data-widget-cell="${c}" value="${e(row[c])}"></td>`).join('')}${metric?`<td>${metricBackgroundEditor(table,row,r)}</td>`:''}<td>${button('widget-delete-row','×',`data-row="${r}" aria-label="Видалити рядок ${r+1}"`,'secondary small')}</td></tr>`;}).join('')}</tbody></table></div><div class="cms-table-tools">${button('widget-add-row','+ Рядок')}${free?button('widget-add-column','+ Колонка'):''}<span>${table.rows.length} рядків · ${visibleColumns.length} колонок</span>${button('widget-data-prev','Назад',widgetState.page===0?'disabled':'','secondary small')}${button('widget-data-next','Далі',offset+20>=table.rows.length?'disabled':'','secondary small')}</div>`;
      if(!free)body+='<p class="cms-field-help">Назви колонок для цього типу визначають поля блоку: зберігайте їхній набір. Порядок колонок і рядків можна змінювати.</p>';
    }
    if(block.type==='chart'&&['edit','settings'].includes(kind))body=chartBindingFields(block)+body;
    const title=kind==='edit'?'Редагування даних':kind==='width'?'Ширина блоку':'Налаштування блоку';
    const actions=`<div class="dialog-actions">${button('widget-close','Скасувати')}${button('widget-apply','Застосувати до чернетки','','primary')}</div>`;
    dialog.classList.toggle('cms-chart-dialog',chartSettings);
    dialog.innerHTML=`<div class="dialog-heading"><h2 id="cms-widget-title">${title}</h2>${button('widget-close','×','aria-label="Закрити налаштування"','secondary small')}</div><div class="dialog-body"><p class="cms-widget-name">${e(block.title||BLOCK_TYPES[block.type])}</p>${chartSettings?`<div class="cms-chart-settings">${body}</div>`:body}<div id="cms-widget-error" class="form-error" role="alert"></div>${chartSettings?'':actions}</div>${chartSettings?actions:''}`;
    dialog.setAttribute('aria-labelledby','cms-widget-title');if(!dialog.open)dialog.showModal();
  }
  function applyWidget() {
    if(!widgetState)return;
    if(widgetState.catalogLoading)throw new Error('Дочекайтесь завершення завантаження таблиці.');
    const sizeInput=$('#cms-widget-dialog [data-catalog-page-sizes]');if(sizeInput&&!sizeInput.checkValidity())throw new Error(sizeInput.validationMessage);
    let next=widgetState.block;
    if(widgetState.kind==='edit'&&!['text','feature','dataNote','catalog'].includes(next.type))next=tableToCMSBlock(widgetState.table,next);
    if(next.type==='analytics'&&next.dataMode==='manual'&&!next.dataTable){next.dataTable=editableTable(currentBlock(next.id));next.dataPeriod=options.getBlockPeriod(currentBlock(next.id));}
    next=validateCMSBlock(next);
    if(next.type==='chart'&&next.binding){const result=view.chartData(next);if(result.error)throw new Error(result.error);}
    validateCMSPage({...draft,blocks:draft.blocks.map(b=>b.id===next.id?next:b)});
    $('#cms-widget-dialog').close();widgetState=null;
    change(p=>{p.blocks=p.blocks.map(b=>b.id===next.id?next:b);});
    view.clearLegend(next.id);
    options.notify('Блок оновлено в чернетці. Збережіть сторінку для застосування.');
  }
  function updateWidgetField(el) {
    if(!widgetState)return;
    const state=widgetState;
    if(catalogEditorBlock(state.block)&&(el.dataset.catalogEdit||el.dataset.catalogSearchField!==undefined||el.dataset.catalogPageSizes!==undefined)){
      if(el.dataset.catalogEdit==='binding.kind'&&el.value==='upload'&&!state.block.dataTable){const table=view.catalogTable(state.block,true).table;if(table.headers.length)state.block.dataTable=table;}
      const result=updateCatalogField(state.block,el);
      if(result.error){$('#cms-widget-error').textContent=result.error;return;}
      if(result.sizesChanged){$('#cms-widget-error').textContent='';const select=$('#cms-widget-dialog [data-catalog-edit="catalog.pageSize"]');select.innerHTML=state.block.catalog.pageSizes.map(n=>`<option value="${n}" ${n===state.block.catalog.pageSize?'selected':''}>${n===0?'Всі':n}</option>`).join('');}
      if(state.block.binding?.periodMode==='fixed'&&!state.block.binding.period)state.block.binding.period=String(options.getYear());
      if(result.source){state.block.binding.yearColumn='';const table=view.catalogTable(state.block,true).table;if(table.headers.length)state.block.catalog=inferCatalogConfig(table.headers);}
      if(result.rerender)renderWidgetDialog();else refreshCatalogPreview();return;
    }
    if(el.dataset.chartRule!==undefined){const rule=state.block.binding.seriesRules[+el.dataset.chartRule],key=el.dataset.ruleField;rule[key]=key==='visible'?el.checked:key==='values'?[...el.selectedOptions].map(o=>o.value):el.value;if(key==='column'){rule.values=[];renderWidgetDialog();}refreshChartPreview();return;}
    if(el.dataset.chartBinding||el.dataset.chartValue!==undefined){
      const b=state.block.binding||{...defaultChartBinding(),periodMode:state.block.settings?.allYears?'all':'year'};state.block.binding=b;
      if(el.dataset.chartValue!==undefined)b.valueColumns=el.checked?[...new Set([...b.valueColumns,el.dataset.chartValue])]:b.valueColumns.filter(v=>v!==el.dataset.chartValue);
      else {const key=el.dataset.chartBinding;b[key]=el.value;if(['kind','source','blockId'].includes(key)){b.groupColumn='';b.seriesColumn='';b.yearColumn='';b.valueColumns=[];b.seriesRules=[];}if(key==='periodMode'&&b.periodMode==='fixed'&&!b.period)b.period=String(options.getYear());if(key!=='period')renderWidgetDialog();}refreshChartPreview();return;
    }
    if(el.dataset.noteBinding){
      const key=el.dataset.noteBinding;state.block.binding={...state.block.binding,[key]:key==='decimals'?Number(el.value):el.value};
      if(['kind','source','blockId'].includes(key)){state.block.binding.column='';state.block.binding.row='';if(state.block.binding.kind==='builtin')state.block.binding.unit=noteUnit(state.block.binding.source);}
      if(key==='operation')state.block.binding.unit=el.value==='count'?'рядків':el.value==='distinct'?'назв':state.block.binding.kind==='builtin'?noteUnit(state.block.binding.source):state.block.binding.unit;
      if(key==='periodMode'&&el.value==='fixed'&&!state.block.binding.period)state.block.binding.period=String(options.getYear());
      if(['kind','source','blockId','periodMode','operation'].includes(key)){renderWidgetDialog();return;}
    }
    if(el.dataset.featureStyle){const key=el.dataset.featureStyle;state.block.appearance={...state.block.appearance,[key]:el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value};if(key==='autoHeight')$('#cms-widget-dialog [data-feature-style="minHeight"]').disabled=el.checked;if(key==='backgroundColor'){state.block.appearance.background='custom';$('#cms-widget-dialog [data-feature-style="background"]').value='custom';}}
    if(el.dataset.widgetSetting){const key=el.dataset.widgetSetting;storeWidgetSetting(key,el.type==='checkbox'?el.checked:el.type==='number'||key==='segmentPercentageDecimals'?Number(el.value):el.value);}
    if(el.dataset.widgetSetting==='widthMode'){for(const mode of ['percent','fixed','auto'])$('#cms-widget-dialog [data-width-'+mode+']').hidden=mode!==el.value;}
    if(el.dataset.widgetSetting==='autoColumns')$('#cms-widget-dialog [data-widget-setting="columns"]').disabled=el.checked;
    if(['segmentPercentages','segmentPercentageDecimals'].includes(el.dataset.widgetSetting)){
      const settings=widgetSettings(),controls=$('#cms-widget-dialog [data-percentage-options]'),small=$('#cms-widget-dialog [data-small-percentage-option]');
      if(controls)controls.hidden=!settings.segmentPercentages;if(small)small.hidden=settings.segmentPercentageDecimals!==0;
    }
    if(el.dataset.widgetSetting==='legend'){const center=$('#cms-widget-dialog .cms-legend-center');if(center)center.hidden=!['top','bottom'].includes(el.value);}
    if(el.dataset.widgetSetting==='backgroundColor'){
      state.block.settings.background='custom';
      $('#cms-widget-dialog input[name="textBackground"][value="custom"]').checked=true;
      $('#cms-widget-dialog .cms-text-bg-custom').style.setProperty('--text-block-bg',el.value);
    }
    if(el.dataset.widgetText==='dataMode'&&isMetricBlock(state.block)){
      if(el.value==='live'&&state.block.dataMode==='manual'){
        state.block.metricAppearance=metricAppearanceFromTable(state.block.dataTable);
        state.block.metricManualBackup={dataTable:structuredClone(state.block.dataTable),dataPeriod:state.block.dataPeriod||''};
      }
      if(el.value==='manual'&&state.block.dataMode!=='manual'&&state.block.metricManualBackup){
        state.block.dataTable=applyMetricAppearance(state.block.metricManualBackup.dataTable,state.block.metricAppearance);
        state.block.dataPeriod=state.block.metricManualBackup.dataPeriod;
      }
      state.block.metricEditingVersion=1;
    }
    if(el.dataset.widgetText)state.block[el.dataset.widgetText]=el.type==='checkbox'?el.checked:el.value;
    refreshNotePreview();refreshCatalogPreview();
    if(el.dataset.widgetColor!==undefined){const colors=[...widgetSettings().customColors];colors[+el.dataset.widgetColor]=el.value;storeWidgetSetting('customColors',colors);storeWidgetSetting('palette','custom');$('#cms-widget-dialog input[value="custom"]').checked=true;}
    if(el.dataset.widgetHeader!==undefined){const old=state.table.headers[+el.dataset.widgetHeader];state.table.headers[+el.dataset.widgetHeader]=el.value;if(state.block.type==='chart'&&state.block.binding?.kind==='manual'){for(const key of ['groupColumn','seriesColumn','yearColumn'])if(state.block.binding[key]===old)state.block.binding[key]=el.value;state.block.binding.valueColumns=state.block.binding.valueColumns.map(h=>h===old?el.value:h);for(const rule of state.block.binding.seriesRules||[])if(rule.column===old)rule.column=el.value;}}
    if(el.dataset.widgetRow!==undefined)state.table.rows[+el.dataset.widgetRow][+el.dataset.widgetCell]=el.value;
    refreshChartPreview();
  }

  function transferDialog(kind, mode, blockId = null) {
    let dialog=$('#cms-dialog'); if(!dialog){dialog=document.createElement('dialog');dialog.id='cms-dialog';document.body.append(dialog);}
    importToken++;importValue=null;transfer={kind,mode,blockId,pageId:selected};
    const block=blockId?currentBlock(blockId):null, tabular=block&&block.type!=='existing';
    const label=kind==='block'?'блоку':kind==='page'?'сторінки':'сайта';
    dialog.innerHTML=`<div class="dialog-heading"><h2 id="cms-dialog-title">${mode==='import'?'Імпорт':'Експорт'} ${label}</h2>${button('close-transfer','×','aria-label="Закрити обмін файлами"','secondary small')}</div><div class="dialog-body"><p class="cms-field-help">${kind==='block'?'JSON зберігає весь блок. CSV/XLSX передають його дані; для таблиці — колонки й рядки.':kind==='page'?'JSON сторінки містить її налаштування та всі блоки. Імпорт створює нову сторінку.':'Резервна копія містить усі сторінки та аналітичні дані. Імпорт замінює весь локальний сайт.'}</p><label class="import-type">Формат<select id="cms-transfer-format"><option value="json">JSON</option>${tabular?'<option value="csv">CSV</option><option value="xlsx">XLSX · Excel</option>':''}</select></label>${mode==='import'?'<label class="dropzone"><input id="cms-file-input" type="file" accept=".json"><strong>Оберіть файл для перевірки</strong><span>До 5 МБ для блоку/сторінки та до 20 МБ для сайта. Зміни застосуються після підтвердження.</span></label>':button('download-transfer',`${icon('download')} Завантажити файл`,'','primary')}<div id="cms-transfer-result" aria-live="polite"></div></div>`;
    dialog.setAttribute('aria-labelledby','cms-dialog-title');dialog.showModal();
  }
  async function exportTransfer() {
    const {kind,blockId}=transfer, format=$('#cms-transfer-format').value;
    if(kind==='block'){
      let block=validateCMSBlock(format==='json'?currentBlock(blockId):transferBlock(currentBlock(blockId)));
      if(format!=='json'&&block.type==='chart'&&block.binding?.kind&&block.binding.kind!=='manual'){const result=view.chartData(block);if(result.error)throw new Error(result.error);block={...block,columns:result.table.headers,rows:result.table.rows};}
      if(format==='csv')options.download(`block-${block.type}.csv`,cmsBlockCSV(block),'text/csv;charset=utf-8');
      else if(format==='xlsx')options.download(`block-${block.type}.xlsx`,await cmsBlockXLSX(block),CMS_MIME);
      else options.download(`block-${block.type}.json`,JSON.stringify({blockVersion:1,block},null,2));
    }else if(kind==='page')options.download(`${draft.slug}.json`,JSON.stringify({pageVersion:1,page:validateCMSPage(draft)},null,2));
    else {if(dirty)throw new Error('Спочатку збережіть сторінку, щоб додати всі зміни в резервну копію.');options.download('site-backup.json',JSON.stringify({packageVersion:1,site:validateSite(site),data:validateBundle(options.getData())},null,2));}
  }
  async function readTransfer(file) {
    if(!file)return;const token=++importToken, context={...transfer}, result=$('#cms-transfer-result');importValue=null;
    try{
      if(file.size>(context.kind==='site'?20:5)*1024*1024)throw new Error('Файл перевищує дозволений розмір.');
      const format=$('#cms-transfer-format').value;if(!file.name.toLowerCase().endsWith('.'+format))throw new Error(`Оберіть файл .${format}.`);
      result.innerHTML='<p>Перевіряємо файл…</p>';
      let next;let block=context.blockId?transferBlock(currentBlock(context.blockId)):null;
      if(format!=='json'&&block?.type==='chart')block={...block,binding:block.binding||{...defaultChartBinding(),periodMode:block.settings.allYears?'all':'year'}};
      if(format==='json')next=readCMSJSON(await file.text(),context.kind,block);
      else if(format==='csv')next=importCMSBlockCSV(await file.text(),block);
      else next=await importCMSBlockXLSX(await file.arrayBuffer(),block);
      if(format!=='json'&&next.type==='chart'&&next.binding?.kind!=='manual'){next.binding={...defaultChartBinding(),periodMode:next.binding?.periodMode||'all',period:next.binding?.period||''};next=validateCMSBlock(next);}
      if(format!=='json'&&next.type==='chart'&&next.binding){for(const key of ['groupColumn','seriesColumn','yearColumn'])if(next.binding[key]&&!next.columns.includes(next.binding[key]))next.binding[key]='';next.binding.valueColumns=next.binding.valueColumns.filter(h=>next.columns.includes(h));next.binding.seriesRules=next.binding.seriesRules.filter(r=>next.columns.includes(r.column));}
      if(context.kind==='block')validateCMSPage({...draft,blocks:draft.blocks.map(b=>b.id===context.blockId?next:b)});
      if(token!==importToken||!result.isConnected||!$('#cms-dialog').open)return;
      importValue=next;
      const summary=context.kind==='site'?`${next.site.pages.length} сторінок; ${next.data.publications.length} публікацій, ${next.data.projects.length} проєктів.`:context.kind==='page'?`Сторінка «${next.title}», ${next.blocks.length} блоків. Буде створено окрему копію.`:`${BLOCK_TYPES[next.type]}: ${next.dataTable?next.dataTable.rows.length+' рядків':next.rows?next.rows.length+' рядків':next.items?next.items.length+' елементів':next.title}.`;
      const previewTable=['table','chart'].includes(next.type)?{headers:next.columns,rows:next.rows.slice(0,5)}:next.dataTable?{headers:next.dataTable.headers,rows:next.dataTable.rows.slice(0,5)}:null;
      result.innerHTML=`<div class="import-preview"><h3>${icon('check')} Формат перевірено</h3><p>${e(file.name)}</p><p>${e(summary)}</p><p>${context.kind==='site'?'Буде замінено весь локальний сайт та аналітичні дані. Спочатку експортуйте резервну копію.':context.kind==='block'?'Поточний блок буде замінено в чернетці. Для публічної локальної сторінки збережіть її після імпорту.':''}</p>${previewTable?renderBlockTable(previewTable):''}${button('apply-transfer','Застосувати імпорт','','primary')}</div>`;
    }catch(err){if(token===importToken&&result.isConnected)result.innerHTML=`<div class="form-error error-box" role="alert">${e(err.message)}</div>`;}
  }
  function importPage(value) {
    const clone=structuredClone(value);clone.id=newCMSId('page');clone.kind='custom';clone.slug=uniqueSlug(clone.slug);
    const copiedIds=new Map(clone.blocks.map(b=>[b.id,newCMSId()]));
    clone.blocks=clone.blocks.map(b=>b.type==='existing'?{...defaultCMSBlock('analytics'),source:({overview:'stats',publications:'publications',projects:'projects',patents:'patents',funding:'funding'})[b.source]}:{...b,id:copiedIds.get(b.id),...(['dataNote','catalog','chart'].includes(b.type)&&b.binding?.kind==='block'&&copiedIds.has(b.binding.blockId)?{binding:{...b.binding,blockId:copiedIds.get(b.binding.blockId)}}:{})});
    saveSite({...site,pages:[...site.pages,validateCMSPage(clone)]},'Сторінку імпортовано як нову копію.');selectPage(clone.id,false);
  }
  function applyTransfer() {
    if(!importValue)return;
    if(transfer.kind==='block'){const value=importValue;change(p=>{const at=p.blocks.findIndex(b=>b.id===transfer.blockId);if(at<0)throw new Error('Блок уже видалено.');p.blocks[at]=value;});}
    if(transfer.kind==='page'){if(dirty&&!confirm('Відкинути поточну чернетку й додати імпортовану сторінку?'))return;importPage(importValue);}
    if(transfer.kind==='site'){
      const nextSite=expandSiteBlocks({...importValue.site,updatedAt:new Date().toISOString()}),nextData=validateBundle(importValue.data);
      writeLocal(nextSite,nextData);options.replaceData(nextData,false);repairMetricSnapshots();selectPage(site.pages[0].id,false);
      options.notify(temporary?'Копія відкрита тимчасово: сховище недоступне. Експортуйте JSON перед закриттям.':'Резервну копію сайта відновлено локально.');
    }
    importValue=null;importToken++;$('#cms-dialog').close();redraw();
  }
  function openPublicationDialog(){
    if(dirty)throw new Error('Спочатку збережіть сторінку.');
    publicationTicket++;
    let dialog=$('#cms-publication-dialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='cms-publication-dialog';document.body.append(dialog);dialog.addEventListener('cancel',()=>{publicationTicket++;});}
    dialog.innerHTML=`<div class="dialog-heading"><h2 id="cms-publication-title">Сайт для публікації</h2>${button('publication-close','×','aria-label="Закрити вибір варіанта"','secondary small')}</div><div class="dialog-body"><p class="publication-help">Виберіть, який варіант сайта зберегти в ZIP-архів.</p><div class="publication-options"><label class="publication-choice"><input type="radio" name="publicationMode" value="editor" checked><span><strong>Зберегти сайт з адмінкою</strong><small>Для редагування сторінок, блоків, налаштувань та оновлення даних.</small></span></label><label class="publication-choice"><input type="radio" name="publicationMode" value="visitor"><span><strong>Зберегти сайт без адмінки</strong><small>Тільки для відвідувачів: сторінки, пошук, фільтри, графіки. Редактор та імпорт даних відсутні.</small></span></label></div><p class="publication-help">Розпакуйте ZIP і завантажте на хостинг весь його вміст: index.html, styles.css та папки src і data зі збереженням структури. Для подальших змін збережіть версію з адмінкою або резервну копію сайта. При заміні вже опублікованого сайта видаліть файли попереднього варіанта, яких немає в новому архіві.</p><div id="cms-publication-error" class="form-error" role="alert"></div><div class="dialog-actions">${button('publication-close','Скасувати')}${button('publication-download',`${icon('download')} Завантажити ZIP`,'','primary')}</div></div>`;
    dialog.setAttribute('aria-labelledby','cms-publication-title');dialog.showModal();
  }
  async function publishZip(target){
    if(dirty)throw new Error('Спочатку збережіть сторінку.');
    const dialog=$('#cms-publication-dialog'),mode=dialog.querySelector('input[name="publicationMode"]:checked')?.value,ticket=++publicationTicket;
    const themeSnapshot=document.documentElement.dataset.theme,dataSnapshot=structuredClone(options.getData()),siteSnapshot=structuredClone(site),names=mode==='editor'?PUBLICATION_ASSETS:VISITOR_ASSETS;
    target.disabled=true;$('#cms-publication-error').textContent='';
    try{
      const pairs=await Promise.all(names.map(async name=>{
        if(globalThis.KAI_PUBLIC_ASSETS&&Object.hasOwn(globalThis.KAI_PUBLIC_ASSETS,name))return [name,globalThis.KAI_PUBLIC_ASSETS[name]];
        const response=await fetch(new URL(name,document.baseURI),{cache:'no-store'});if(!response.ok)throw new Error(`Не вдалося завантажити ${name}.`);return [name,await response.text()];
      }));
      if(ticket!==publicationTicket||!dialog.open)return;
      const files=buildPublicationFiles(Object.fromEntries(pairs),dataSnapshot,siteSnapshot,mode,themeSnapshot);
      options.download(mode==='editor'?'kai-site-with-admin.zip':'kai-site-visitors.zip',createSiteZip(files),'application/zip');
      dialog.close();options.notify(mode==='editor'?'ZIP сайта з адмінкою готовий.':'ZIP сайта для відвідувачів готовий.');
    }catch(error){if(ticket===publicationTicket&&dialog.open)$('#cms-publication-error').textContent=error.message;}
    finally{target.disabled=false;}
  }
  function showError(err) {
    if($('#cms-metric-background-dialog')?.open)$('#cms-metric-background-error').textContent=err.message;
    const widgetError=$('#cms-widget-error');if($('#cms-widget-dialog')?.open&&widgetError)widgetError.textContent=err.message;
    const el=$('#cms-editor-error');if(el)el.textContent=err.message;
    const result=$('#cms-transfer-result');if($('#cms-dialog')?.open&&result)result.innerHTML=`<div class="form-error error-box" role="alert">${e(err.message)}</div>`;
    options.notify(err.message);
  }
  async function action(name, el) {
    const id=el.dataset.blockId, b=id?currentBlock(id):null;
    if(view.handleAction(name,el))return;
    if(name.startsWith('catalog-')&&catalogEditorBlock(widgetState?.block)){if(catalogEditorAction(widgetState.block,name.slice(8),el,view.catalogTable(widgetState.block,true).table.headers)){renderWidgetDialog();return;}}
    if(name==='metric-background-open'){openMetricBackground(+el.dataset.row);return;}
    if(name==='metric-background-apply'||name==='metric-background-cancel'){closeMetricBackground(name==='metric-background-apply');return;}
    if(name==='project-reports'){projectReports.open();return;}
    if(name==='widget-settings'||name==='widget-edit'||name==='widget-width'){widgetDialog(b,name.slice(7));return;}
    if(name==='widget-library-active'&&widgetState){widgetState.block.settings=selectChartLibrary(widgetState.block.settings,el.dataset.library,widgetState.block.source);widgetState.editLibrary=el.dataset.library;renderWidgetDialog();return;}
    if(name==='widget-library-edit'&&widgetState){widgetState.editLibrary=el.dataset.library;renderWidgetDialog();return;}
    if(name==='widget-close'){$('#cms-widget-dialog').close();widgetState=null;return;}
    if(name==='widget-apply'){applyWidget();return;}
    if(name==='widget-metric-live'&&widgetState){
      const block=widgetState.block;block.metricManualBackup={dataTable:structuredClone(block.dataTable),dataPeriod:block.dataPeriod||''};block.metricAppearance=metricAppearanceFromTable(block.dataTable);block.dataMode='live';block.metricEditingVersion=1;renderWidgetDialog();return;
    }
    if(name==='widget-series-add'&&widgetState){const block=widgetState.block;block.binding||={...defaultChartBinding(),periodMode:block.settings.allYears?'all':'year'};block.binding.seriesRules||=[];if(block.binding.seriesRules.length>=30)return;const table=view.chartData(block,true).table;if(!table.headers.length)throw new Error('Спочатку оберіть таблицю-джерело.');let n=block.binding.seriesRules.length+1;while(block.binding.seriesRules.some(r=>r.name==='Серія '+n))n++;if(!block.binding.seriesRules.length)block.binding.operation='count';block.binding.seriesRules.push({name:'Серія '+n,column:block.binding.seriesColumn||table.headers[0],values:[],visible:true});renderWidgetDialog();return;}
    if(name==='widget-series-remove'&&widgetState){widgetState.block.binding.seriesRules.splice(+el.dataset.ruleIndex,1);renderWidgetDialog();return;}
    if(name.startsWith('widget-')&&widgetState){
      const state=widgetState,table=state.table;
      if(name==='widget-width-preset'){state.block.settings.width=+el.dataset.width;state.block.settings.widthMode='percent';}
      if(name==='widget-add-color'&&widgetSettings().customColors.length<12){storeWidgetSetting('customColors',[...widgetSettings().customColors,'#3479c6']);storeWidgetSetting('palette','custom');}
      if(name==='widget-remove-color'&&widgetSettings().customColors.length>1){storeWidgetSetting('customColors',widgetSettings().customColors.slice(0,-1));storeWidgetSetting('palette','custom');}
      if(name==='widget-add-row'){if(table.rows.length>=(publicationBlock(state.block)?25000:1000))throw new Error(publicationBlock(state.block)?'До 25 000 рядків.':'До 1000 рядків.');table.rows.push(table.headers.map(()=>''));state.page=Math.floor((table.rows.length-1)/20);}
      if(name==='widget-delete-row'){table.rows.splice(+el.dataset.row,1);state.page=Math.min(state.page,Math.max(0,Math.ceil(table.rows.length/20)-1));}
      if(name==='widget-add-column'){if(table.headers.length>=(publicationBlock(state.block)?80:isMetricBlock(state.block)?14:12))throw new Error(publicationBlock(state.block)?'До 80 колонок даних.':'До 12 колонок даних.');let n=table.headers.length+1;while(table.headers.includes('Колонка '+n))n++;table.headers.push('Колонка '+n);table.rows.forEach(r=>r.push(''));}
      if(name==='widget-delete-column'){
        const minimum=state.block.type==='chart'||CHART_SOURCES.includes(state.block.source)?2:1;if(table.headers.length<=minimum)throw new Error(`Залиште хоча б ${minimum} колонки.`);
        table.headers.splice(+el.dataset.col,1);table.rows.forEach(r=>r.splice(+el.dataset.col,1));
      }
      if(name==='widget-move-column'||name==='widget-move-row')state.table=moveTableItem(table,name==='widget-move-column'?'column':'row',+el.dataset.from,+el.dataset.to);
      if(name==='widget-data-prev')state.page=Math.max(0,state.page-1);
      if(name==='widget-data-next')state.page=Math.min(Math.max(0,Math.ceil(table.rows.length/20)-1),state.page+1);
      renderWidgetDialog();return;
    }
    if(name==='select-page'){if(selectPage(el.dataset.pageId))redraw();}
    if(name==='new-page')newPage();
    if(name==='add-block')change(p=>{if(p.blocks.length>=50)throw new Error('Не більше 50 блоків.');p.blocks.push(defaultCMSBlock(el.dataset.blockType));});
    if(name==='remove-block')change(p=>{p.blocks=p.blocks.filter(x=>x.id!==id);});
    if(name==='duplicate-block')change(p=>{const at=p.blocks.findIndex(x=>x.id===id);p.blocks.splice(at+1,0,{...structuredClone(b),id:newCMSId()});});
    if(name==='block-up'||name==='block-down')change(p=>{const at=p.blocks.findIndex(x=>x.id===id),to=at+(name==='block-up'?-1:1);if(to>=0&&to<p.blocks.length)[p.blocks[at],p.blocks[to]]=[p.blocks[to],p.blocks[at]];});
    if(name==='undo'&&history.length){draft=history.pop();dirty=true;redraw();}
    if(name==='duplicate-page'){if(dirty&&!confirm('Копіювати незбережену чернетку в нову сторінку?'))return;const copy=validateCMSPage(draft);copy.title+=' · копія';copy.slug=uniqueSlug(copy.slug);importPage(copy);redraw();}
    if(name==='delete-page'&&draft.kind==='custom'&&confirm(`Видалити сторінку «${draft.title}»?`)){saveSite({...site,pages:site.pages.filter(p=>p.id!==selected)});selectPage(site.pages[0].id,false);redraw();}
    if(name==='page-up'||name==='page-down'){
      if(dirty)throw new Error('Збережіть сторінку перед зміною порядку меню.');
      const pages=[...site.pages],at=pages.findIndex(p=>p.id===el.dataset.pageId),to=at+(name==='page-up'?-1:1);if(to>=0&&to<pages.length){[pages[at],pages[to]]=[pages[to],pages[at]];saveSite({...site,pages});redraw();}
    }
    if(name==='add-row')change(()=>{if(b.rows.length>=1000)throw new Error('До 1000 рядків.');b.rows.push(b.columns.map(()=>''));});
    if(name==='remove-row')change(()=>{b.rows.splice(+el.dataset.row,1);});
    if(name==='add-column')change(()=>{if(b.columns.length>=12)throw new Error('До 12 колонок.');let n=b.columns.length+1;while(b.columns.includes('Колонка '+n))n++;b.columns.push('Колонка '+n);b.rows.forEach(r=>r.push(''));});
    if(name==='remove-column')change(()=>{if(b.columns.length<=1)throw new Error('Залиште хоча б одну колонку.');const c=+el.dataset.col;b.columns.splice(c,1);b.rows.forEach(r=>r.splice(c,1));});
    if(name==='table-prev'||name==='table-next'){b._editorPage=Math.max(0,(b._editorPage||0)+(name==='table-prev'?-1:1));redraw();}
    if(name==='add-metric')change(()=>{if(b.items.length>=12)throw new Error('До 12 карток.');b.items.push({label:'Показник',value:'0',unit:'',note:''});});
    if(name==='remove-metric')change(()=>{b.items.splice(+el.dataset.index,1);});
    if(name==='block-import'||name==='block-export')transferDialog('block',name.endsWith('import')?'import':'export',id);
    if(name==='page-import'||name==='page-export')transferDialog('page',name.endsWith('import')?'import':'export');
    if(name==='site-import'||name==='site-export')transferDialog('site',name.endsWith('import')?'import':'export');
    if(name==='close-transfer'){importToken++;$('#cms-dialog').close();}
    if(name==='download-transfer')await exportTransfer();
    if(name==='apply-transfer')applyTransfer();
    if(name==='publish-zip')openPublicationDialog();
    if(name==='publication-download')await publishZip(el);
    if(name==='publication-close'){publicationTicket++;$('#cms-publication-dialog').close();}
    if(name==='analytics-import'||name==='analytics-export')options.openDataManager(name.endsWith('import')?'import':'export',b.source);
  }
  document.addEventListener('click',event=>{const el=event.target.closest('[data-cms-action]');if(el){event.preventDefault();action(el.dataset.cmsAction,el).catch(showError);}});
  function updateField(el) {
    if(!draft)return;const value=el.type==='checkbox'?el.checked:el.value;
    if(el.dataset.cmsField){draft[el.dataset.cmsField]=value;if(el.dataset.cmsField==='showYear')$('#cms-page-form [data-cms-field="stickyYear"]').disabled=!value;dirty=true;status();}
    if(el.dataset.blockId){const b=draft.blocks.find(x=>x.id===el.dataset.blockId);if(!b)return;
      if(el.dataset.blockField)b[el.dataset.blockField]=el.dataset.blockField==='items'?String(value).split(/\r?\n/):value;
      if(el.dataset.tableColumn!==undefined)b.columns[+el.dataset.tableColumn]=value;
      if(el.dataset.tableRow!==undefined)b.rows[+el.dataset.tableRow][+el.dataset.tableCell]=value;
      if(el.dataset.metricIndex!==undefined)b.items[+el.dataset.metricIndex][el.dataset.metricField]=value;
      dirty=true;status();
    }
    schedulePreview(100);
  }
  document.addEventListener('input',event=>{if(event.target.closest('#cms-page-form'))updateField(event.target);});
  document.addEventListener('input',event=>{if(event.target.closest('#cms-widget-dialog'))updateWidgetField(event.target);});
  document.addEventListener('change',event=>{if(widgetState?.block.type==='chart'&&event.target.closest('#cms-widget-dialog')&&event.target.dataset.widgetHeader!==undefined)renderWidgetDialog();});
  document.addEventListener('change',async event=>{
    if(!widgetState||!['cms-catalog-file','cms-catalog-sheet'].includes(event.target.id))return;const state=widgetState;state.catalogError='';
    try{
      if(event.target.id==='cms-catalog-sheet'){state.catalogSheet=event.target.value;useCatalogTable(state,catalogSheetTable(state.catalogBook,state.catalogSheet));}
      else {const file=event.target.files[0];if(!file)return;state.catalogLoading=true;const apply=$('#cms-widget-dialog [data-cms-action="widget-apply"]');apply.disabled=true;const upload=await readCatalogUpload(file);if(widgetState!==state)return;state.catalogBook=upload.book;state.catalogSheets=upload.sheets;state.catalogSheet=upload.sheets[0]||'';state.catalogError=upload.error;if(upload.table)useCatalogTable(state,upload.table);}
    }catch(error){state.catalogError=error.message;}
    finally{state.catalogLoading=false;if(widgetState===state)renderWidgetDialog();}
  });
  document.addEventListener('dragstart',event=>{
    const handle=event.target.closest('[data-drag-axis]');if(!handle||!widgetState)return;
    dragItem={axis:handle.dataset.dragAxis,index:+handle.dataset.dragIndex};event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(dragItem.index));
  });
  document.addEventListener('dragover',event=>{if(dragItem&&event.target.closest(`[data-drop-axis="${dragItem.axis}"]`)){event.preventDefault();event.dataTransfer.dropEffect='move';}});
  document.addEventListener('drop',event=>{
    if(!dragItem||!widgetState)return;const target=event.target.closest(`[data-drop-axis="${dragItem.axis}"]`);if(!target)return;
    event.preventDefault();widgetState.table=moveTableItem(widgetState.table,dragItem.axis,dragItem.index,+target.dataset.dropIndex);dragItem=null;renderWidgetDialog();
  });
  document.addEventListener('dragend',()=>{dragItem=null;});
  document.addEventListener('change',event=>{
    if(event.target.closest('#cms-widget-dialog')){updateWidgetField(event.target);if((event.target.dataset.widgetSetting==='chartType'||event.target.dataset.widgetText==='dataMode')&&widgetState?.kind==='settings')renderWidgetDialog();}
    if(event.target.closest('#cms-page-form'))updateField(event.target);
    if(event.target.id==='cms-transfer-format'){importToken++;importValue=null;$('#cms-transfer-result').innerHTML='';const input=$('#cms-file-input');if(input){input.accept='.'+event.target.value;input.value='';}}
    if(event.target.id==='cms-file-input')readTransfer(event.target.files[0]);
  });
  document.addEventListener('submit',event=>{if(event.target.id==='cms-page-form'){event.preventDefault();try{savePage();}catch(err){showError(err);}}});
  window.addEventListener('beforeunload',event=>{if(dirty||temporary){event.preventDefault();event.returnValue='';}});
  return {
    init(initial){site=expandSiteBlocks(initial);let saved=null;try{saved=localStorage.getItem(CMS_KEY);if(saved)site=expandSiteBlocks(JSON.parse(saved),site);}catch{saved=null;options.notify('Локальні сторінки недоступні або пошкоджені. Завантажено серверну версію.');}repairMetricSnapshots();if(saved&&JSON.stringify(site)!==saved)writeLocal(site);},
    pages:()=>activePages(),getPage:findPage,renderAdmin,renderBlocks,pageCatalogYears:view.pageCatalogYears,
    getSite:()=>structuredClone(site),isDirty:()=>dirty,
  };
}
