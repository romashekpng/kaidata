import { CORE_PAGES, BLOCK_TYPES, ANALYTICS, validateSite, validateCMSPage, validateCMSBlock, defaultCMSBlock, newCMSId, cmsRoute } from './cms-data.js';
import { cmsBlockCSV, importCMSBlockCSV, cmsBlockXLSX, importCMSBlockXLSX, readCMSJSON } from './cms-io.js';
import { validateBundle } from './data.js';
import { createSiteZip } from './zip.js';
import { icon } from './icons.js';
const CMS_KEY = 'kai-science.pages.v1';
const escapeCMS = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const CMS_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export function createCMS(options) {
  const e = escapeCMS;
  let site, draft, selected, dirty = false, temporary = false, pendingDataRestore = false, history = [], transfer = null, importValue = null, importToken = 0;
  const $ = selector => document.querySelector(selector);
  const button = (action, label, extra = '', cls = 'secondary') => `<button type="button" class="button ${cls}" data-cms-action="${action}" ${extra}>${label}</button>`;
  const input = (label, field, value, extra = '') => `<label>${label}<input data-cms-field="${field}" value="${e(value)}" ${extra}></label>`;
  const blockInput = (b, field, label, extra = '') => `<label>${label}<input data-block-id="${b.id}" data-block-field="${field}" value="${e(b[field])}" ${extra}></label>`;
  const blockText = (b, field, label, rows = 4, value = b[field]) => `<label class="span-2">${label}<textarea data-block-id="${b.id}" data-block-field="${field}" rows="${rows}">${e(value)}</textarea></label>`;
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
    if (b.type === 'text') return blockText(b, 'text', 'Текст · абзаци розділяються порожнім рядком', 7);
    if (b.type === 'banner') return `${blockText(b, 'text', 'Текст банера')}<label>Оформлення<select data-block-id="${b.id}" data-block-field="tone">${[['green','Зелений'],['blue','Синій'],['amber','Теплий'],['dark','Темний']].map(([v,t])=>`<option value="${v}" ${b.tone===v?'selected':''}>${t}</option>`).join('')}</select></label>${blockInput(b,'linkLabel','Текст кнопки')}${blockInput(b,'linkUrl','Посилання · https://… або #page/slug')}`;
    if (b.type === 'list') return `${blockText(b,'items','Пункти · кожен із нового рядка',7,b.items.join('\n'))}<label class="checkbox-label"><input type="checkbox" data-block-id="${b.id}" data-block-field="ordered" ${b.ordered?'checked':''}>Нумерований список</label>`;
    if (b.type === 'analytics') return `<label class="span-2">Джерело аналітики<select data-block-id="${b.id}" data-block-field="source">${Object.entries(ANALYTICS).map(([v,t])=>`<option value="${v}" ${b.source===v?'selected':''}>${t}</option>`).join('')}</select></label><p class="cms-field-help span-2">Використовує дані сайта за вибраний рік. Для зміни таблиць відкрийте «Імпорт даних аналітики». Увімкніть фільтр року в параметрах сторінки.</p>`;
    if (b.type === 'existing') return `<p class="cms-field-help span-2">Початкова сторінка «${e(CORE_PAGES[b.source])}» із графіками, фільтрами й каталогами. Її можна перемістити, приховати або видалити; додаткові блоки розміщуються поруч у порядку нижче.</p>`;
    if (b.type === 'table') {
      const offset = Math.min(b._editorPage || 0, Math.max(0, Math.ceil(b.rows.length / 20) - 1)) * 20;
      return `${blockInput(b,'caption','Примітка таблиці')}<div class="cms-table-editor span-2"><div class="table-scroll"><table><thead><tr>${b.columns.map((c,i)=>`<th><input aria-label="Назва колонки ${i+1}" data-block-id="${b.id}" data-table-column="${i}" value="${e(c)}">${button('remove-column','×',`data-block-id="${b.id}" data-col="${i}" aria-label="Видалити колонку ${i+1}"`,'secondary small')}</th>`).join('')}<th></th></tr></thead><tbody>${b.rows.slice(offset,offset+20).map((row,r)=>`<tr>${row.map((cell,c)=>`<td><input aria-label="Рядок ${offset+r+1}, колонка ${c+1}" data-block-id="${b.id}" data-table-row="${offset+r}" data-table-cell="${c}" value="${e(cell)}"></td>`).join('')}<td>${button('remove-row','×',`data-block-id="${b.id}" data-row="${offset+r}" aria-label="Видалити рядок ${offset+r+1}"`,'secondary small')}</td></tr>`).join('')}</tbody></table></div><div class="cms-table-tools">${button('add-row','+ Рядок',`data-block-id="${b.id}"`,'secondary small')}${button('add-column','+ Колонка',`data-block-id="${b.id}"`,'secondary small')}<span>${b.rows.length?offset+1:0}–${Math.min(offset+20,b.rows.length)} з ${b.rows.length} рядків</span>${button('table-prev','←',`data-block-id="${b.id}" ${offset===0?'disabled':''} aria-label="Попередні рядки"`,'secondary small')}${button('table-next','→',`data-block-id="${b.id}" ${offset+20>=b.rows.length?'disabled':''} aria-label="Наступні рядки"`,'secondary small')}</div></div>`;
    }
    if (b.type === 'metrics') return `<div class="cms-metrics-editor span-2">${b.items.map((item,i)=>`<div class="cms-metric-editor"><div class="form-grid">${[['label','Назва'],['value','Значення'],['unit','Одиниця'],['note','Примітка']].map(([field,label])=>`<label>${label}<input data-block-id="${b.id}" data-metric-index="${i}" data-metric-field="${field}" value="${e(item[field])}"></label>`).join('')}</div>${button('remove-metric','Видалити картку',`data-block-id="${b.id}" data-index="${i}"`,'secondary small')}</div>`).join('')}${button('add-metric','+ Картка показника',`data-block-id="${b.id}"`,'secondary small')}</div>`;
    return '';
  }
  function blockEditor(b, index) {
    return `<section class="cms-block-editor" data-editor-block="${b.id}"><div class="cms-block-top"><div><span class="cms-block-number">${String(index+1).padStart(2,'0')}</span><strong>${BLOCK_TYPES[b.type]}</strong>${!b.visible?'<span class="pill">Приховано</span>':''}</div><div class="cms-block-order">${button('block-up','↑',`data-block-id="${b.id}" ${index===0?'disabled':''} aria-label="Перемістити блок ${index+1} вгору"`,'secondary small')}${button('block-down','↓',`data-block-id="${b.id}" ${index===draft.blocks.length-1?'disabled':''} aria-label="Перемістити блок ${index+1} вниз"`,'secondary small')}</div></div><div class="form-grid">${blockInput(b,'title',b.type==='existing'?'Назва в редакторі':'Заголовок блоку')}<label class="checkbox-label"><input type="checkbox" data-block-id="${b.id}" data-block-field="visible" ${b.visible?'checked':''}>Показувати блок</label>${blockFields(b)}</div><div class="cms-block-actions">${button('block-import',`${icon('upload')} Імпорт`, `data-block-id="${b.id}"`,'secondary small')}${button('block-export',`${icon('download')} Експорт`, `data-block-id="${b.id}"`,'secondary small')}${['analytics','existing'].includes(b.type)?button('analytics-import','Імпорт даних аналітики',`data-block-id="${b.id}"`,'secondary small')+button('analytics-export','Експорт даних аналітики',`data-block-id="${b.id}"`,'secondary small'):button('duplicate-block','Дублювати',`data-block-id="${b.id}"`,'secondary small')}${button('remove-block','Видалити',`data-block-id="${b.id}"`,'secondary small')}</div></section>`;
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
    const content = `<div class="cms-frame-page" inert>${options.renderHeader(draft)}${renderBlocks(draft,true)}</div>`;
    frame.onload = () => {
      const page = frame.contentDocument?.querySelector('.cms-frame-page');
      if (page) frame.style.height = `${Math.ceil(page.getBoundingClientRect().height)}px`;
    };
    frame.srcdoc = `<!doctype html><html lang="uk" data-theme="${e(root.dataset.theme || 'blue')}" style="${e(root.getAttribute('style') || '')}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вигляд сторінки</title><style>${css}html,body{margin:0;min-width:0}.cms-frame-page{display:flow-root;padding:0}</style></head><body>${content}</body></html>`;
  }
  new MutationObserver(() => schedulePreview()).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','style']});
  window.addEventListener('resize', () => schedulePreview(100));
  function renderAdmin() {
    if (!draft) selectPage(site.pages[0].id, false);
    schedulePreview();
    return `<div class="page-heading"><div><div class="eyebrow">КЕРУВАННЯ ВМІСТОМ</div><h1>Адмінка сайта<span class="title-dot">.</span></h1><p>Сторінки, блоки та дані вашого університету.</p></div><div class="heading-actions">${button('new-page',`${icon('file')} Нова сторінка`,'','primary')}${button('publish-zip',`${icon('download')} Сайт для публікації`,dirty?'disabled':'')}</div></div><div class="notice cms-local-note">${icon('info')}<span><strong>Локальна адмінка без серверної авторизації.</strong> Редагування змінює лише цей браузер. Щоб опублікувати зміни для всіх, завантажте ZIP і замініть файли в GitHub. Чужі відвідувачі не можуть змінити серверні файли через цей редактор.</span></div><div class="cms-admin-tools">${button('site-export','Резервна копія сайта · JSON')}${button('site-import','Відновити сайт із JSON')}${button('page-import','Імпортувати сторінку · JSON')}</div><div class="cms-layout"><aside class="cms-page-list"><div class="section-head"><h2>Сторінки</h2><span class="pill">${site.pages.length}</span></div>${site.pages.map((p,n)=>`<div class="cms-page-row ${p.id===selected?'selected':''}"><button type="button" data-cms-action="select-page" data-page-id="${p.id}"><strong>${e(p.title)}</strong><span>${p.kind==='builtin'?'Вбудована':`#page/${e(p.slug)}`} ${p.visible?'':'· прихована'}</span></button><div>${button('page-up','↑',`data-page-id="${p.id}" ${n===0?'disabled':''} aria-label="Сторінка вгору"`,'secondary small')}${button('page-down','↓',`data-page-id="${p.id}" ${n===site.pages.length-1?'disabled':''} aria-label="Сторінка вниз"`,'secondary small')}</div></div>`).join('')}</aside><div class="cms-workbench"><section class="cms-live-pane" aria-label="Візуалізація сторінки"><div class="cms-live-heading"><div><h2>Вигляд сторінки</h2><p>Оновлюється автоматично · чернетка</p></div><span class="pill green">Наживо</span></div><iframe id="cms-live-frame" title="Візуалізація поточної сторінки" sandbox="allow-same-origin"></iframe></section><div class="cms-editor"><form id="cms-page-form"><section class="panel"><div class="section-head"><h2>Параметри сторінки</h2><span class="pill ${dirty?'amber':'green'}" id="cms-save-status">${dirty?'Є незбережені зміни':temporary?'Тимчасова копія':'Збережено в цьому браузері'}</span></div><div class="form-grid">${input('Назва в меню','title',draft.title,'required maxlength="120"')}${input('Адреса · латиницею','slug',draft.slug,`required pattern="[a-z0-9][a-z0-9-]{0,63}" ${draft.kind==='builtin'?'readonly':''}`)}${input('Заголовок сторінки','heading',draft.heading,'required maxlength="200"')}<label>Опис<input data-cms-field="description" value="${e(draft.description)}"></label><label class="checkbox-label"><input type="checkbox" data-cms-field="visible" ${draft.visible?'checked':''}>Показувати в меню</label><label class="checkbox-label"><input type="checkbox" data-cms-field="showYear" ${draft.showYear?'checked':''}>Показувати фільтр року</label></div><div class="cms-page-actions">${button('page-export','Експорт сторінки · JSON')}${button('duplicate-page','Копіювати сторінку')}${draft.kind==='custom'?button('delete-page','Видалити сторінку','','secondary danger'):''}</div></section><div class="section-head"><div><h2>Блоки сторінки</h2><p>Редагуйте вміст та змінюйте порядок стрілками.</p></div>${button('undo','Скасувати зміну',history.length?'':'disabled','secondary small')}</div>${draft.blocks.map(blockEditor).join('')}<section class="cms-block-palette"><h3>Додати блок</h3><div>${Object.entries(BLOCK_TYPES).filter(([key])=>key!=='existing').map(([key,title])=>button('add-block',`+ ${title}`,`data-block-type="${key}"`)).join('')}</div></section><div class="cms-save-bar"><span>Зміни застосуються до локальної копії сайта</span><button class="button primary" type="submit">${icon('check')} Зберегти сторінку</button></div><div class="form-error" id="cms-editor-error" role="alert"></div></form></div></div></div>`;
  }
  function renderBlocks(page, inPreview = false) {
    return page.blocks.filter(b=>b.visible).map(b=>{
      const title=b.title?`<h2>${e(b.title)}</h2>`:'';
      const tools=`<div class="cms-public-block-tools">${button('block-export','Експорт блоку',`data-block-id="${b.id}"`,'secondary small')}</div>`;
      if(b.type==='existing')return `<div class="cms-existing" ${inPreview?'inert':''}>${options.renderExisting(b.source)}</div>`;
      if(b.type==='analytics')return `<section class="cms-public-block"><div class="section-head">${title}</div>${options.renderAnalytics(b.source)}${button('analytics-export','Експорт даних аналітики',`data-block-id="${b.id}"`,'secondary small')}${tools}</section>`;
      if(b.type==='banner')return `<section class="cms-banner ${b.tone}">${title}<p>${e(b.text).replaceAll('\n','<br>')}</p>${b.linkUrl?`<a class="button primary" href="${e(b.linkUrl)}" ${b.linkUrl.startsWith('http')?'target="_blank" rel="noopener noreferrer"':''}>${e(b.linkLabel)} ${icon('arrow')}</a>`:''}${tools}</section>`;
      if(b.type==='text')return `<section class="panel cms-public-block">${title}<div class="cms-prose">${b.text.split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${e(p).replaceAll('\n','<br>')}</p>`).join('')}</div>${tools}</section>`;
      if(b.type==='list')return `<section class="panel cms-public-block">${title}<${b.ordered?'ol':'ul'} class="cms-list">${b.items.map(item=>`<li>${e(item)}</li>`).join('')}</${b.ordered?'ol':'ul'}>${tools}</section>`;
      if(b.type==='table')return `<section class="panel cms-public-block">${title}${b.caption?`<p class="cms-field-help">${e(b.caption)}</p>`:''}<div class="table-scroll"><table><thead><tr>${b.columns.map(c=>`<th scope="col">${e(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(row=>`<tr>${row.map(c=>`<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${tools}</section>`;
      if(b.type==='metrics')return `<section class="cms-public-block">${title}<div class="stats-grid">${b.items.map(item=>`<article class="stat-card"><div class="stat-top">${e(item.label)}</div><div class="stat-value">${e(item.value)}<small>${e(item.unit)}</small></div><div class="muted">${e(item.note)}</div></article>`).join('')}</div>${tools}</section>`;
      return '';
    }).join('') || '<div class="empty"><h3>На цій сторінці поки немає видимих блоків.</h3></div>';
  }
  function transferDialog(kind, mode, blockId = null) {
    let dialog=$('#cms-dialog'); if(!dialog){dialog=document.createElement('dialog');dialog.id='cms-dialog';document.body.append(dialog);}
    importToken++;importValue=null;transfer={kind,mode,blockId,pageId:selected};
    const block=blockId?currentBlock(blockId):null, tabular=block&&!['analytics','existing'].includes(block.type);
    const label=kind==='block'?'блоку':kind==='page'?'сторінки':'сайта';
    dialog.innerHTML=`<div class="dialog-heading"><h2 id="cms-dialog-title">${mode==='import'?'Імпорт':'Експорт'} ${label}</h2>${button('close-transfer','×','aria-label="Закрити обмін файлами"','secondary small')}</div><div class="dialog-body"><p class="cms-field-help">${kind==='block'?'JSON зберігає весь блок. CSV/XLSX передають його дані; для таблиці — колонки й рядки.':kind==='page'?'JSON сторінки містить її налаштування та всі блоки. Імпорт створює нову сторінку.':'Резервна копія містить усі сторінки та аналітичні дані. Імпорт замінює весь локальний сайт.'}</p><label class="import-type">Формат<select id="cms-transfer-format"><option value="json">JSON</option>${tabular?'<option value="csv">CSV</option><option value="xlsx">XLSX · Excel</option>':''}</select></label>${mode==='import'?'<label class="dropzone"><input id="cms-file-input" type="file" accept=".json"><strong>Оберіть файл для перевірки</strong><span>До 5 МБ для блоку/сторінки та до 20 МБ для сайта. Зміни застосуються після підтвердження.</span></label>':button('download-transfer',`${icon('download')} Завантажити файл`,'','primary')}<div id="cms-transfer-result" aria-live="polite"></div></div>`;
    dialog.setAttribute('aria-labelledby','cms-dialog-title');dialog.showModal();
  }
  async function exportTransfer() {
    const {kind,blockId}=transfer, format=$('#cms-transfer-format').value;
    if(kind==='block'){
      const block=validateCMSBlock(currentBlock(blockId));
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
      let next;const block=context.blockId?currentBlock(context.blockId):null;
      if(format==='json')next=readCMSJSON(await file.text(),context.kind,block);
      else if(format==='csv')next=importCMSBlockCSV(await file.text(),block);
      else next=await importCMSBlockXLSX(await file.arrayBuffer(),block);
      if(context.kind==='block')validateCMSPage({...draft,blocks:draft.blocks.map(b=>b.id===context.blockId?next:b)});
      if(token!==importToken||!result.isConnected||!$('#cms-dialog').open)return;
      importValue=next;
      const summary=context.kind==='site'?`${next.site.pages.length} сторінок; ${next.data.publications.length} публікацій, ${next.data.projects.length} проєктів.`:context.kind==='page'?`Сторінка «${next.title}», ${next.blocks.length} блоків. Буде створено окрему копію.`:`${BLOCK_TYPES[next.type]}: ${next.rows?next.rows.length+' рядків':next.items?next.items.length+' елементів':next.title}.`;
      result.innerHTML=`<div class="import-preview"><h3>${icon('check')} Формат перевірено</h3><p>${e(file.name)}</p><p>${e(summary)}</p><p>${context.kind==='site'?'Буде замінено весь локальний сайт та аналітичні дані. Спочатку експортуйте резервну копію.':context.kind==='block'?'Поточний блок буде замінено в чернетці. Для публічної локальної сторінки збережіть її після імпорту.':''}</p>${next.type==='table'?`<div class="table-scroll"><table><thead><tr>${next.columns.map(c=>`<th>${e(c)}</th>`).join('')}</tr></thead><tbody>${next.rows.slice(0,5).map(r=>`<tr>${r.map(c=>`<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''}${button('apply-transfer','Застосувати імпорт','','primary')}</div>`;
    }catch(err){if(token===importToken&&result.isConnected)result.innerHTML=`<div class="form-error error-box" role="alert">${e(err.message)}</div>`;}
  }
  function importPage(value) {
    const clone=structuredClone(value);clone.id=newCMSId('page');clone.kind='custom';clone.slug=uniqueSlug(clone.slug);
    clone.blocks=clone.blocks.map(b=>b.type==='existing'?{...defaultCMSBlock('analytics'),source:({overview:'stats',publications:'publications',projects:'projects',patents:'patents',funding:'funding'})[b.source]}:{...b,id:newCMSId()});
    saveSite({...site,pages:[...site.pages,validateCMSPage(clone)]},'Сторінку імпортовано як нову копію.');selectPage(clone.id,false);
  }
  function applyTransfer() {
    if(!importValue)return;
    if(transfer.kind==='block'){const value=importValue;change(p=>{const at=p.blocks.findIndex(b=>b.id===transfer.blockId);if(at<0)throw new Error('Блок уже видалено.');p.blocks[at]=value;});}
    if(transfer.kind==='page'){if(dirty&&!confirm('Відкинути поточну чернетку й додати імпортовану сторінку?'))return;importPage(importValue);}
    if(transfer.kind==='site'){
      const nextSite=validateSite({...importValue.site,updatedAt:new Date().toISOString()}),nextData=validateBundle(importValue.data);
      writeLocal(nextSite,nextData);options.replaceData(nextData,false);selectPage(site.pages[0].id,false);
      options.notify(temporary?'Копія відкрита тимчасово: сховище недоступне. Експортуйте JSON перед закриттям.':'Резервну копію сайта відновлено локально.');
    }
    importValue=null;importToken++;$('#cms-dialog').close();redraw();
  }
  async function publishZip(target) {
    if(dirty)throw new Error('Спочатку збережіть сторінку.');target.disabled=true;
    try{
      const names=['index.html','styles.css','src/app.js','src/data.js','src/icons.js','src/spreadsheet.js','src/cms-data.js','src/cms-io.js','src/cms.js','src/zip.js','src/vendor/exceljs.min.js','src/vendor/exceljs.LICENSE.txt'];
      const files=await Promise.all(names.map(async name=>{if(globalThis.KAI_PUBLIC_ASSETS&&Object.hasOwn(globalThis.KAI_PUBLIC_ASSETS,name))return {name,data:globalThis.KAI_PUBLIC_ASSETS[name]};const response=await fetch(new URL(name,document.baseURI));if(!response.ok)throw new Error(`Не вдалося завантажити ${name}.`);return {name,data:await response.arrayBuffer()};}));
      files.push({name:'data/demo.json',data:JSON.stringify(validateBundle(options.getData()),null,2)},{name:'data/pages.json',data:JSON.stringify(validateSite(site),null,2)},{name:'.nojekyll',data:''},{name:'PUBLICATION.txt',data:'Розпакуйте архів. Замініть однойменні файли в GitHub-репозиторії та створіть коміт. GitHub Pages: main, / (root). Дані й сторінки стануть публічними. Локальні копії браузерів не оновлюються примусово: в адмінці імпортуйте site-backup.json або очистьте локальні налаштування сайта після резервної копії.'});
      options.download('kai-site-publication.zip',createSiteZip(files),'application/zip');options.notify('ZIP готовий. Розпакуйте його й замініть файли в GitHub для публікації.');
    }finally{target.disabled=false;}
  }
  function showError(err) {
    const el=$('#cms-editor-error');if(el)el.textContent=err.message;
    const result=$('#cms-transfer-result');if($('#cms-dialog')?.open&&result)result.innerHTML=`<div class="form-error error-box" role="alert">${e(err.message)}</div>`;
    options.notify(err.message);
  }
  async function action(name, el) {
    const id=el.dataset.blockId, b=id?currentBlock(id):null;
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
    if(name==='publish-zip')await publishZip(el);
    if(name==='analytics-import'||name==='analytics-export')options.openDataManager(name.endsWith('import')?'import':'export',b.source);
  }
  document.addEventListener('click',event=>{const el=event.target.closest('[data-cms-action]');if(el){event.preventDefault();action(el.dataset.cmsAction,el).catch(showError);}});
  function updateField(el) {
    if(!draft)return;const value=el.type==='checkbox'?el.checked:el.value;
    if(el.dataset.cmsField){draft[el.dataset.cmsField]=value;dirty=true;status();}
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
  document.addEventListener('change',event=>{
    if(event.target.closest('#cms-page-form'))updateField(event.target);
    if(event.target.id==='cms-transfer-format'){importToken++;importValue=null;$('#cms-transfer-result').innerHTML='';const input=$('#cms-file-input');if(input){input.accept='.'+event.target.value;input.value='';}}
    if(event.target.id==='cms-file-input')readTransfer(event.target.files[0]);
  });
  document.addEventListener('submit',event=>{if(event.target.id==='cms-page-form'){event.preventDefault();try{savePage();}catch(err){showError(err);}}});
  window.addEventListener('beforeunload',event=>{if(dirty||temporary){event.preventDefault();event.returnValue='';}});
  return {
    init(initial){site=validateSite(initial);try{const saved=localStorage.getItem(CMS_KEY);if(saved)site=validateSite(JSON.parse(saved));}catch{options.notify('Локальні сторінки недоступні або пошкоджені. Завантажено серверну версію.');}},
    pages:()=>activePages(),getPage:findPage,renderAdmin,renderBlocks,
    getSite:()=>structuredClone(site),isDirty:()=>dirty,
  };
}
