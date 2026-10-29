import { BLOCK_PALETTES, defaultBlockSettings } from './cms-data.js?v=block-tools-20261029';
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
 return `<div class="cms-data-scroll cms-card-scroll ${settings.showAll?'show-all':''}"><div class="stats-grid cms-metric-grid" style="--metric-columns:${settings.columns}">${table.rows.map(r=>`<article class="stat-card"><div class="stat-top">${esc(get(r,'label',0))}</div><div class="stat-value">${esc(get(r,'value',1))}<small>${esc(get(r,'unit',2))}</small></div><div class="muted">${esc(get(r,'note',3))}</div></article>`).join('')}</div></div>`;
}
export function renderProjectTable(table, settings) {
 const get=(r,name,index)=>r[table.headers.indexOf(name)]??r[index]??'';
 return `<div class="cms-data-scroll ${settings.showAll?'show-all':''}"><div class="project-grid">${table.rows.map(r=>`<article class="project-card"><div class="project-card-top"><span class="pill blue">${esc(get(r,'Програма',1))}</span></div><h3>${esc(get(r,'Назва',0))}</h3><div class="project-meta"><span>${esc(get(r,'Початок',2))} — ${esc(get(r,'Завершення',3))}</span><span>${esc(get(r,'Роль',4))}</span></div><div class="project-money"><span>Надходження, грн</span><strong>${esc(get(r,'Надходження, грн',5))}</strong></div></article>`).join('')}</div></div>`;
}
export function renderChartTable(block, table, hidden = []) {
 const s={...defaultBlockSettings(block.source),...block.settings},colors=blockColors(block),pie=['donut','pie'].includes(s.chartType),hiddenSet=new Set(hidden);
 const names=pie?table.rows.map(r=>r[0]):table.headers.slice(1);
 const values=pie?table.rows.map(r=>r.slice(1).reduce((sum,v)=>sum+(num(v)||0),0)):[];
 const totals=table.rows.map(r=>r.slice(1).reduce((sum,v,i)=>sum+(hiddenSet.has(i)?0:num(v)||0),0));
 const legend=s.legend==='none'?'':`<div class="cms-chart-legend ${s.showAll?'show-all':''}" aria-label="Легенда графіка">${names.map((name,i)=>`<button type="button" data-cms-action="chart-legend" data-block-id="${block.id}" data-series="${i}" aria-pressed="${!hiddenSet.has(i)}" class="${hiddenSet.has(i)?'series-hidden':''}" title="${esc(name)}${pie?`: ${format(values[i])}`:''}"><i style="background:${colors[i%colors.length]}"></i><span>${esc(name)}</span>${pie?`<strong>${format(values[i])}</strong>`:''}</button>`).join('')}</div>`;
 let graphic='';
 if(!table.rows.length)graphic='<div class="empty"><p>Додайте дані для побудови графіка.</p></div>';
 else if(pie){
  const total=values.reduce((sum,v,i)=>sum+(hiddenSet.has(i)?0:v),0);let angle=-Math.PI/2;
  const point=a=>[100+83*Math.cos(a),100+83*Math.sin(a)];
  const slices=values.map((value,i)=>{
   if(hiddenSet.has(i)||!value||!total)return '';
   const share=value/total,from=point(angle),next=angle+share*Math.PI*2,to=point(next),mid=angle+share*Math.PI,tip=`${table.rows[i][0]}: ${format(value)}${s.tooltipTotal?`\nРазом: ${format(total)}`:''}`;
   const shape=share>=.999999?`<circle cx="100" cy="100" r="83" fill="${colors[i%colors.length]}"><title>${esc(tip)}</title></circle>`:`<path d="M100 100 L${from.join(' ')} A83 83 0 ${share>.5?1:0} 1 ${to.join(' ')} Z" fill="${colors[i%colors.length]}"><title>${esc(tip)}</title></path>`;
   angle=next;
   return shape+(s.segmentValues&&share>.035?`<text class="cms-segment-label" x="${100+63*Math.cos(mid)}" y="${104+63*Math.sin(mid)}">${format(value)}</text>`:'');
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
 return `<div class="cms-chart-body legend-${s.legend}" style="--chart-height:${s.height}px">${s.legend==='top'||s.legend==='right'?legend:''}<div class="cms-chart-graphic">${graphic}</div>${s.legend==='bottom'?legend:''}</div><details class="cms-chart-data"><summary>Дані графіка</summary>${renderBlockTable(table,s.showAll)}</details>`;
}
