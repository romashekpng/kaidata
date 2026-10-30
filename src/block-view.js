import { icon } from './icons.js?v=chart-libraries-20261030';
import { BLOCK_PALETTES, defaultBlockSettings, validateMetricBackground, customBackgroundStyle } from './cms-data.js?v=chart-libraries-20261030';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = value => value===''?null:Number(String(value).replace(',','.'));
const format = value => new Intl.NumberFormat('uk-UA',{maximumFractionDigits:2}).format(value);
export function blockColors(block) {
 const s={...defaultBlockSettings(block.source),...block.settings};
 return s.palette==='custom'?s.customColors:BLOCK_PALETTES[s.palette].colors;
}
export function renderBlockTable(table, showAll = false) {
 return `<div class="cms-data-scroll ${showAll?'show-all':''}"><table><thead><tr>${table.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
export function renderMetricTable(table, settings) {
 const get=(r,name,i)=>r[table.headers.indexOf(name)]??r[i]??'';
 return `<div class="cms-data-scroll cms-card-scroll ${settings.showAll?'show-all':''}"><div class="stats-grid cms-metric-grid" style="--metric-columns:${settings.columns}">${table.rows.map(r=>{
  const colors=validateMetricBackground(get(r,'background'),get(r,'backgroundColor')),colored=colors.background!=='default';
  return `<article class="stat-card ${colored?`cms-card-background cms-text-bg-${colors.background}`:''}" ${colors.background==='custom'?`style="${customBackgroundStyle(colors.backgroundColor)}"`:''}><div class="stat-top">${esc(get(r,'label',0))}</div><div class="stat-value">${esc(get(r,'value',1))}<small>${esc(get(r,'unit',2))}</small></div><div class="muted">${esc(get(r,'note',3))}</div></article>`;
 }).join('')}</div></div>`;
}
function projectISODate(value){
 const raw=String(value||'').trim(),m=raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/),iso=m?`${m[3]}-${m[2]}-${m[1]}`:raw;
 return /^\d{4}-\d{2}-\d{2}$/.test(iso)&&Number.isFinite(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso?iso:null;
}
export function projectProgress(startDate,endDate,asOf=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Kyiv'}).format(new Date())){
 const start=projectISODate(startDate),end=projectISODate(endDate),now=projectISODate(asOf);
 if(!start||!end||!now||end<start)return null;
 const percent=end===start?(now<start?0:100):Math.max(0,Math.min(100,Math.round((Date.parse(now)-Date.parse(start))/(Date.parse(end)-Date.parse(start))*100)));
 return {percent,status:now<start?'planned':now>end?'completed':'active',asOf:now};
}
export function projectsFromTable(table){
 const get=(row,name,index)=>row[table.headers.indexOf(name)]??(index===undefined?'':row[index]??'');
 return table.rows.map(row=>{
  const international=String(get(row,'Міжнародний')).trim().toLocaleLowerCase('uk-UA');
  return {title:get(row,'Назва',0),program:get(row,'Програма',1),startDate:get(row,'Початок',2),endDate:get(row,'Завершення',3),role:get(row,'Роль',4),revenue:get(row,'Надходження, грн',5),url:get(row,'Посилання',6),international:['true','1','так','міжнародний'].includes(international)?true:['false','0','ні','український'].includes(international)?false:null};
 });
}
export function filterProjects(projects,state={}){
 const programs=[...new Set(projects.map(p=>p.program).filter(Boolean))];
 const selected={query:String(state.query||'').slice(0,200),program:programs.includes(state.program)?state.program:'',role:['Координатор','Партнер'].includes(state.role)?state.role:''};
 const query=selected.query.trim().toLocaleLowerCase('uk-UA');
 return {programs,selected,rows:projects.filter(p=>(!selected.program||p.program===selected.program)&&(!selected.role||p.role===selected.role)&&(!query||[p.title,p.program,p.role].join(' ').toLocaleLowerCase('uk-UA').includes(query)))};
}
function projectMarker(international,settings){
 if(international===true&&settings.showProjectGlobe!==false)return `<span class="project-origin" role="img" aria-label="Міжнародний проєкт" title="Міжнародний проєкт">${icon('globe')}</span>`;
 if(international===false&&settings.showProjectFlag!==false)return '<span class="project-origin project-ukraine" role="img" aria-label="Український проєкт" title="Український проєкт"><svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#0057b7" d="M0 0h24v8H0z"/><path fill="#ffd700" d="M0 8h24v8H0z"/></svg></span>';
 return '';
}
export function renderProjectCard(project,settings={},asOf){
 const progress=projectProgress(project.startDate,project.endDate,asOf);
 let url='';try{const u=new URL(project.url);if(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password)url=u.href;}catch{}
 const date=value=>{const iso=projectISODate(value);return iso?iso.split('-').reverse().join('.'):esc(value);};
 const amount=String(project.revenue).replace(/\s/g,'').replace(',','.');
 const revenue=amount!==''&&Number.isFinite(Number(amount))?`${format(Number(amount)/1e6)}<small> млн ₴</small>`:esc(project.revenue||'—');
 const status=progress?({planned:'Заплановано',active:'Виконується',completed:'Завершено'})[progress.status]:'';
 return `<article class="project-card" data-project-program="${esc(project.program)}" data-project-card-role="${esc(project.role)}"><div class="project-card-top"><span class="pill ${project.international===true?'green':'blue'}">${projectMarker(project.international,settings)}${esc(project.program||'Без програми')}</span><span class="project-role">${esc(project.role)}</span></div><h3>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(project.title)} ${icon('external')}</a>`:esc(project.title)}</h3><div class="project-meta"><span>${icon('calendar')}${date(project.startDate)} — ${date(project.endDate)}</span></div><div class="project-money"><span>Надходження</span><strong>${revenue}</strong></div><div class="project-timeline">${progress?`<div class="project-timeline-caption"><span>${status}</span><strong>${progress.percent}%</strong></div><div class="project-timeline-track ${progress.status}" role="progressbar" aria-label="Час виконання проєкту: ${esc(project.title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}" aria-valuetext="${status}; минуло ${progress.percent}% строку виконання" title="Минуло ${progress.percent}% строку виконання станом на ${date(progress.asOf)}. Це часовий прогрес за датами, а не оцінка виконаних робіт."><span style="width:${progress.percent}%"></span></div>`:'<span class="muted">Для прогресу вкажіть коректні дати початку й завершення.</span>'}</div></article>`;
}
export function renderProjectTable(table,settings={},state={},blockId='',asOf){
 const projects=projectsFromTable(table),{programs,selected,rows}=filterProjects(projects,state);
 const action=(program,label)=>`<button type="button" data-cms-action="project-program" data-block-id="${esc(blockId)}" data-program="${esc(program)}" aria-pressed="${selected.program===program}" class="${selected.program===program?'selected':''}">${esc(label)}</button>`;
 return `<div class="project-catalog" data-project-block="${esc(blockId)}"><div class="project-filter-toolbar"><label class="project-search">${icon('search')}<input type="search" data-project-query aria-label="Пошук грантових проєктів" placeholder="Пошук за назвою або програмою" maxlength="200" value="${esc(selected.query)}"></label><div class="project-programs" role="group" aria-label="Програми проєктів">${action('',`Всі програми (${projects.length})`)}${programs.map(program=>action(program,program)).join('')}</div><label class="project-role-filter"><select data-project-role aria-label="Роль ЗВО"><option value="">Всі ролі ЗВО</option>${['Координатор','Партнер'].map(role=>`<option ${selected.role===role?'selected':''}>${role}</option>`).join('')}</select></label><span class="project-count" aria-live="polite">Показано: <strong>${rows.length}</strong> з ${projects.length}</span><button type="button" class="button secondary small" data-cms-action="project-reset" data-block-id="${esc(blockId)}">Скинути фільтри</button></div><div class="project-results cms-data-scroll cms-card-scroll ${settings.showAll?'show-all':''}"><div class="project-grid">${rows.length?rows.map(p=>renderProjectCard(p,settings,asOf)).join(''):'<div class="empty"><h3>Немає проєктів за вибраними умовами</h3><p>Змініть пошук, програму, роль ЗВО або звітний рік.</p></div>'}</div></div></div>`;
}
function chartTooltip(table, row, active, total, settings) {
 return `${row[0]}\n${active.map(i=>`${table.headers[i+1]}: ${row[i+1]===''?'немає даних':format(num(row[i+1]))}`).join('\n')}${settings.tooltipTotal?`\nРазом: ${format(total)}`:''}`;
}
function renderProgressChart(block, table, settings, colors, hidden, totals) {
 const active=table.headers.slice(1).map((_,i)=>i).filter(i=>!hidden.has(i)),max=Math.max(1,...totals),digits=Math.max(2,String(table.rows.length).length);
 return `<div class="cms-progress-list cms-data-scroll ${settings.showAll?'show-all':''}" style="--progress-height:${settings.height}px" role="group" aria-label="${esc(block.title)}">${table.rows.map((row,i)=>`<div class="cms-progress-row ${settings.numbering?'numbered':''}">${settings.numbering?`<span class="cms-progress-number">${String(i+1).padStart(digits,'0')}</span>`:''}<div class="cms-progress-main"><div class="cms-progress-caption"><span>${esc(row[0])}</span>${settings.totalLabels?`<strong>${row.slice(1).every(v=>v==='')?'—':format(totals[i])}</strong>`:''}</div><div class="cms-progress-track" role="progressbar" aria-label="${esc(row[0])}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${totals[i]}" title="${esc(chartTooltip(table,row,active,totals[i],settings))}"><div class="cms-progress-fill" style="width:${totals[i]/max*100}%">${active.map(j=>`<span style="flex:${num(row[j+1])||0};background:${colors[j%colors.length]}"></span>`).join('')}</div></div></div></div>`).join('')}</div>`;
}
function renderHorizontalChart(block, table, settings, colors, hidden, totals) {
 const active=table.headers.slice(1).map((_,i)=>i).filter(i=>!hidden.has(i));
 const positive=table.rows.map(row=>active.reduce((sum,j)=>sum+Math.max(0,num(row[j+1])||0),0)),negative=table.rows.map(row=>active.reduce((sum,j)=>sum+Math.min(0,num(row[j+1])||0),0));
 const rawMax=Math.max(0,...positive),rawMin=Math.min(0,...negative),rough=(rawMax-rawMin)/6;
 const base=rough>0?10**Math.floor(Math.log10(rough)):1,fraction=rough/base,step=([1,2,2.5,5,10].find(n=>n>=fraction)||10)*base;
 const min=Math.floor(rawMin/step)*step,max=Math.ceil(rawMax/step)*step||step,position=value=>(value-min)/(max-min)*100;
 const ticks=Array.from({length:Math.round((max-min)/step)+1},(_,i)=>min+i*step);
 const grid=ticks.map(value=>`<i class="cms-horizontal-gridline" style="left:${position(value)}%"></i>`).join('');
 const rows=table.rows.map((row,i)=>{
  let plus=0,minus=0;
  const bars=active.map(j=>{
   const value=num(row[j+1]);if(value===null)return '';
   const start=value>=0?plus:minus,end=start+value;if(value>=0)plus=end;else minus=end;
   return `<span class="cms-horizontal-bar" style="left:${position(Math.min(start,end))}%;width:${Math.abs(value)/(max-min)*100}%;background:${colors[j%colors.length]}">${settings.segmentValues?`<span>${format(value)}</span>`:''}</span>`;
  }).join('');
  return `<div class="cms-horizontal-row"><span class="cms-horizontal-label" title="${esc(row[0])}">${esc(row[0])}</span><div class="cms-horizontal-value"><div class="cms-horizontal-plot" title="${esc(chartTooltip(table,row,active,totals[i],settings))}">${grid}${bars}${settings.totalLabels?`<strong class="cms-horizontal-total" style="left:calc(${position(positive[i])}% + 7px)">${row.slice(1).every(v=>v==='')?'—':format(totals[i])}</strong>`:''}</div></div></div>`;
 }).join('');
 return `<div class="cms-horizontal-chart ${settings.wrapLabels?'wrap-labels':''} ${settings.totalLabels?'totals-visible':''} ${settings.showAll?'show-all':''}" role="group" aria-label="${esc(block.title)}"><div class="cms-horizontal-rows ${settings.showAll?'show-all':''}" style="--horizontal-height:${settings.height}px">${rows}</div><div class="cms-horizontal-axis"><span></span><div class="cms-horizontal-axis-plot">${ticks.map(value=>`<span style="left:${position(value)}%">${format(value)}</span>`).join('')}</div></div></div>`;
}
export function renderChartTable(block, table, hidden = []) {
 const s={...defaultBlockSettings(block.source),...block.settings},colors=blockColors(block),pie=['donut','pie'].includes(s.chartType),hiddenSet=new Set(hidden);
 const names=pie?table.rows.map(r=>r[0]):table.headers.slice(1);
 const values=pie?table.rows.map(r=>r.slice(1).reduce((sum,v)=>sum+(num(v)||0),0)):[];
 const totals=table.rows.map(r=>r.slice(1).reduce((sum,v,i)=>sum+(hiddenSet.has(i)?0:num(v)||0),0));
 const legend=s.legend==='none'?'':`<div class="cms-chart-legend ${s.legendCentered&&['top','bottom'].includes(s.legend)?'legend-centered':''} ${s.showAll?'show-all':''}" aria-label="Легенда графіка">${names.map((name,i)=>`<button type="button" data-cms-action="chart-legend" data-block-id="${block.id}" data-series="${i}" aria-pressed="${!hiddenSet.has(i)}" class="${hiddenSet.has(i)?'series-hidden':''}" title="${esc(name)}${pie?`: ${format(values[i])}`:''}"><i style="background:${colors[i%colors.length]}"></i><span>${esc(name)}</span>${pie?`<strong>${format(values[i])}</strong>`:''}</button>`).join('')}</div>`;
 let graphic='';
 if(!table.rows.length)graphic='<div class="empty"><p>Додайте дані для побудови графіка.</p></div>';
 else if(s.chartType==='progress')graphic=renderProgressChart(block,table,s,colors,hiddenSet,totals);
 else if(s.chartType==='horizontal')graphic=renderHorizontalChart(block,table,s,colors,hiddenSet,totals);
 else if(pie){
  const total=values.reduce((sum,v,i)=>sum+(hiddenSet.has(i)?0:v),0);let angle=-Math.PI/2;
  const point=a=>[100+83*Math.cos(a),100+83*Math.sin(a)];
  const slices=values.map((value,i)=>{
   if(hiddenSet.has(i)||!value||!total)return '';
   const share=value/total,from=point(angle),next=angle+share*Math.PI*2,to=point(next),mid=angle+share*Math.PI,tip=`${table.rows[i][0]}: ${format(value)}${s.tooltipTotal?`\nРазом: ${format(total)}`:''}`;
   const shape=share>=.999999?`<circle cx="100" cy="100" r="83" fill="${colors[i%colors.length]}"><title>${esc(tip)}</title></circle>`:`<path d="M100 100 L${from.join(' ')} A83 83 0 ${share>.5?1:0} 1 ${to.join(' ')} Z" fill="${colors[i%colors.length]}"><title>${esc(tip)}</title></path>`;
   angle=next;
   const labelX=100+63*Math.cos(mid),labelY=104+63*Math.sin(mid),percent=new Intl.NumberFormat('uk-UA',{maximumFractionDigits:1}).format(share*100)+'%';
   const label=s.segmentValues&&s.segmentPercentages?`<tspan x="${labelX}" dy="-5">${format(value)}</tspan><tspan x="${labelX}" dy="13">${percent}</tspan>`:s.segmentPercentages?percent:format(value);
   return shape+((s.segmentValues||s.segmentPercentages)&&share>.035?`<text class="cms-segment-label" x="${labelX}" y="${labelY}">${label}</text>`:'');
  }).join('');
  graphic=`<svg class="cms-chart-svg cms-pie-svg" viewBox="0 0 200 200" role="img" aria-label="${esc(block.title)}">${slices}${s.chartType==='donut'?`<circle cx="100" cy="100" r="48" fill="var(--surface)"/>${s.totalLabels?`<text x="100" y="104" text-anchor="middle" class="cms-donut-total">${format(total)}</text>`:''}`:''}${!total?'<text x="100" y="105" text-anchor="middle">Немає даних</text>':''}</svg>`;
 } else {
  const width=Math.max(600,Math.min(2400,table.rows.length*60)),height=s.height,left=58,right=20,top=34,bottom=54,pw=width-left-right,ph=height-top-bottom,series=table.headers.length-1;
  const active=Array.from({length:series},(_,i)=>i).filter(i=>!hiddenSet.has(i));
  const all=table.rows.flatMap(r=>active.map(i=>num(r[i+1])??0));
  if(s.chartType==='stacked')for(const r of table.rows){all.push(active.reduce((sum,i)=>sum+Math.max(0,num(r[i+1])||0),0));all.push(active.reduce((sum,i)=>sum+Math.min(0,num(r[i+1])||0),0));}
  const max=Math.max(1,...all)*1.1,min=Math.min(0,...all)*1.1,y=value=>top+(max-value)/(max-min)*ph,step=pw/Math.max(1,table.rows.length),x=i=>left+step*(i+.5),baseline=y(0);
  const axes=Array.from({length:5},(_,i)=>{const value=min+(max-min)*i/4,at=y(value);return `<line x1="${left}" y1="${at}" x2="${width-right}" y2="${at}" class="cms-chart-gridline"/><text x="${left-8}" y="${at+4}" text-anchor="end" class="cms-chart-axis">${format(value)}</text>`;}).join('');
  const labels=table.rows.map((r,i)=>i%Math.max(1,Math.ceil(table.rows.length/14))===0?`<text x="${x(i)}" y="${height-20}" text-anchor="middle" class="cms-chart-axis">${esc(r[0].length>22?r[0].slice(0,20)+'…':r[0])}</text>`:'').join('');
  const tooltip=(r,i)=>`${r[0]}\n${active.map(j=>`${table.headers[j+1]}: ${r[j+1]===''?'немає даних':format(num(r[j+1]))}`).join('\n')}${s.tooltipTotal?`\nРазом: ${format(totals[i])}`:''}`;
  let marks='';
  if(s.chartType==='line'){
   marks=active.map(j=>{
    let drawing=false;const path=table.rows.map((r,i)=>{const value=num(r[j+1]);if(value===null){drawing=false;return '';}const part=`${drawing?'L':'M'}${x(i)} ${y(value)}`;drawing=true;return part;}).join(' ');
    return `<path d="${path}" fill="none" stroke="${colors[j%colors.length]}" stroke-width="3"/>${table.rows.map((r,i)=>num(r[j+1])===null?'':`<circle cx="${x(i)}" cy="${y(num(r[j+1]))}" r="4" fill="${colors[j%colors.length]}"><title>${esc(tooltip(r,i))}</title></circle>${s.segmentValues?`<text x="${x(i)}" y="${y(num(r[j+1]))-10}" text-anchor="middle" class="cms-chart-axis">${format(num(r[j+1]))}</text>`:''}`).join('')}`;
   }).join('');
  } else marks=table.rows.map((r,i)=>{
   let positive=0,negative=0;
   return active.map((j,k)=>{
    const value=num(r[j+1]);if(value===null)return '';
    const bw=s.chartType==='stacked'?step*.62:step*.75/Math.max(1,active.length),bx=s.chartType==='stacked'?x(i)-bw/2:left+step*i+step*.125+k*bw;
    const start=s.chartType==='stacked'?(value>=0?positive:negative):0,end=start+value;
    if(value>=0)positive=end;else negative=end;
    const by=Math.min(y(start),y(end)),bh=Math.abs(y(start)-y(end));
    return `<rect x="${bx}" y="${by}" width="${Math.max(.2,bw-1)}" height="${bh}" rx="2" fill="${colors[j%colors.length]}"><title>${esc(tooltip(r,i))}</title></rect>${s.segmentValues&&bh>17?`<text x="${bx+bw/2}" y="${by+bh/2+4}" class="cms-segment-label">${format(value)}</text>`:''}`;
   }).join('');
  }).join('');
  const totalLabels=s.totalLabels?table.rows.map((r,i)=>{const high=s.chartType==='stacked'?active.reduce((sum,j)=>sum+Math.max(0,num(r[j+1])||0),0):Math.max(0,...active.map(j=>num(r[j+1])||0));return `<text x="${x(i)}" y="${y(high)-10}" text-anchor="middle" class="cms-chart-total">${r.slice(1).every(v=>v==='')?'—':format(totals[i])}</text>`;}).join(''):'';
  graphic=`<div class="cms-chart-scroll"><svg class="cms-chart-svg" viewBox="0 0 ${width} ${height}" style="min-width:${Math.min(width,Math.max(300,table.rows.length*32))}px" role="img" aria-label="${esc(block.title)}">${axes}<line x1="${left}" y1="${baseline}" x2="${width-right}" y2="${baseline}" class="cms-chart-gridline"/>${marks}${totalLabels}${labels}</svg></div>`;
 }
 return `<div class="cms-chart-body legend-${s.legend}" style="--chart-height:${s.height}px">${s.legend==='top'||s.legend==='right'?legend:''}<div class="cms-chart-graphic">${graphic}</div>${s.legend==='bottom'?legend:''}</div>${s.showChartData?`<details class="cms-chart-data"><summary>Дані графіка</summary>${renderBlockTable(table,s.showAll)}</details>`:''}`;
}
