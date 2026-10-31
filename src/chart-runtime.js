import { isHorizontalChartType, CHART_LIBRARIES, BLOCK_PALETTES, chartSettingsForLibrary } from './cms-data.js?v=project-views-20261031';
const chartLoads=new Map();
const chartVendor={echarts:['echarts.min.js','echarts'],chartjs:['chart.min.js','Chart'],plotly:['plotly.min.js','Plotly']};
const chartEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chartNumber=value=>value===''?null:Number(String(value).replace(',','.'));
const chartFormat=value=>new Intl.NumberFormat('uk-UA',{maximumFractionDigits:2}).format(value);
export async function loadChartLibrary(library){
 if(!Object.hasOwn(CHART_LIBRARIES,library))throw new Error('Невідома бібліотека для діаграм.');
 const [file,name]=chartVendor[library];if(globalThis[name])return globalThis[name];
 if(!chartLoads.has(library))chartLoads.set(library,new Promise((resolve,reject)=>{
  const script=document.createElement('script'),asset='src/vendor/'+file;
  const complete=()=>{if(globalThis[name])resolve(globalThis[name]);else reject(new Error(`Не вдалося запустити ${CHART_LIBRARIES[library]}.`));};
  script.onerror=()=>{script.remove();reject(new Error(`Не вдалося завантажити ${CHART_LIBRARIES[library]}. Перевірте файли бібліотеки.`));};
  if(globalThis.KAI_PUBLIC_ASSETS?.[asset]){script.textContent=globalThis.KAI_PUBLIC_ASSETS[asset];document.head.append(script);complete();}
  else{script.src=new URL(asset,document.baseURI).href+'?v=project-views-20261031';script.onload=complete;document.head.append(script);}
 }).catch(error=>{chartLoads.delete(library);throw error;}));
 return chartLoads.get(library);
}
export function chartModel(payload){
 const {table}=payload,s=chartSettingsForLibrary(payload.settings),pie=['pie','donut'].includes(s.chartType),progress=s.chartType==='progress',horizontal=progress||isHorizontalChartType(s.chartType),hidden=new Set(payload.hidden||[]);
 const colors=s.palette==='custom'?s.customColors:BLOCK_PALETTES[s.palette].colors;
 const active=table.headers.slice(1).map((_,i)=>i).filter(i=>!hidden.has(i));
 const values=table.rows.map(row=>row.slice(1).reduce((sum,v)=>sum+(chartNumber(v)||0),0));
 const totals=table.rows.map(row=>active.reduce((sum,j)=>sum+(chartNumber(row[j+1])||0),0));
 const total=values.reduce((sum,value,i)=>sum+(!hidden.has(i)?value:0),0);
 const series=active.map(j=>({name:table.headers[j+1],color:colors[j%colors.length],values:table.rows.map(row=>chartNumber(row[j+1]))}));
 return {s,pie,progress,horizontal,colors,active,values,totals,total,series,labels:table.rows.map(row=>row[0]),title:payload.title||''};
}
export function wrapChartLabel(value,characters=26){
 const words=String(value).split(/\s+/),lines=[];let line='';
 for(let word of words){while(word.length>characters){if(line){lines.push(line);line='';}lines.push(word.slice(0,characters));word=word.slice(characters);}if(line&&line.length+word.length+1>characters){lines.push(line);line='';}line+=(line?' ':'')+word;}
 if(line)lines.push(line);return lines.length?lines:[''];
}
function chartTheme(node){
 const css=node.ownerDocument.defaultView.getComputedStyle(node),get=(key,fallback)=>css.getPropertyValue(key).trim()||fallback;
 return {ink:get('--ink','#18324d'),muted:get('--muted','#52687c'),line:get('--line','#e3e9ef'),surface:get('--surface','#fff'),font:css.fontFamily,size:parseFloat(get('--site-chart-size','12'))||12};
}
function segmentText(m,value){const parts=[];if(m.s.segmentValues)parts.push(chartFormat(value));if(m.pie&&m.s.segmentPercentages)parts.push(chartFormat(m.total?value/m.total*100:0)+'%');return parts.join('\n');}
function tipText(m,index){return `${m.labels[index]}\n${m.series.map(series=>`${series.name}: ${series.values[index]===null?'немає даних':chartFormat(series.values[index])}`).join('\n')}${m.s.tooltipTotal?'\nРазом: '+chartFormat(m.totals[index]):''}`;}
function labelsFor(m,width){const count=Math.max(10,Math.floor(width*.32/7));return m.labels.map(label=>m.horizontal&&m.s.wrapLabels?wrapChartLabel(label,count):[label.length>34?label.slice(0,32)+'…':label]);}
function progressLabel(m,i){return (m.s.numbering?String(i+1).padStart(2,'0')+'  ':'')+m.labels[i];}
function renderECharts(engine,node,m,theme,width,height){
 const chart=engine.init(node,null,{renderer:'svg'}),labelLines=labelsFor(m,width),category=m.horizontal?'yAxis':'xAxis',valueAxis=m.horizontal?'xAxis':'yAxis';
 const option={animation:false,textStyle:{fontFamily:theme.font,fontSize:theme.size,color:theme.muted},color:m.colors,tooltip:{confine:true,trigger:m.pie?'item':'axis',formatter:params=>{
  if(m.pie){const p=params;return chartEscape(m.labels[p.dataIndex])+': '+chartFormat(m.values[p.dataIndex])+(m.s.tooltipTotal?'<br>Разом: '+chartFormat(m.total):'');}
  const index=params[0]?.dataIndex??0;return chartEscape(tipText(m,index)).replaceAll('\n','<br>');
 }},series:[]};
 if(m.pie){option.series=[{type:'pie',stillShowZeroSum:false,radius:m.s.chartType==='donut'?['56%','90%']:'90%',center:['50%','50%'],label:{show:m.s.segmentValues||m.s.segmentPercentages,position:'inside',color:'#fff',fontSize:theme.size,formatter:p=>segmentText(m,p.value)},labelLine:{show:false},data:m.labels.map((name,i)=>({name,value:m.values[i],itemStyle:{color:m.colors[i%m.colors.length],opacity:(new Set(m.hidden)).has(i)?0:1}})).filter((_,i)=>!m.hidden.includes(i))}];}
 else{
  option.grid={left:m.horizontal&&!m.progress?Math.max(100,Math.min(260,width*.34)):m.progress?4:48,right:m.s.totalLabels?52:18,top:m.progress?30:28,bottom:m.progress?8:42,containLabel:false};
  option[category]={type:'category',data:m.labels,inverse:m.horizontal,axisTick:{show:false},axisLine:{show:!m.progress,lineStyle:{color:theme.line}},axisLabel:{show:!m.progress,color:theme.muted,fontSize:theme.size,interval:0,width:m.horizontal?Math.max(88,Math.min(240,width*.32)):undefined,overflow:m.s.wrapLabels?'break':'truncate',formatter:(_,i)=>labelLines[i].join('\n')}};
  option[valueAxis]={type:'value',show:!m.progress,axisLabel:{color:theme.muted,fontSize:theme.size,formatter:chartFormat},splitLine:{lineStyle:{color:theme.line,type:'dashed'}},...(m.progress?{min:0,max:Math.max(1,...m.totals)}:{})};
  option.series=m.series.map(series=>({name:series.name,type:m.s.chartType==='line'?'line':'bar',stack:['stacked','horizontal','horizontalStacked','progress'].includes(m.s.chartType)?'values':undefined,connectNulls:false,symbolSize:7,barMaxWidth:m.progress?5:60,showBackground:m.progress,backgroundStyle:{color:theme.line},itemStyle:{color:series.color,borderRadius:m.progress?3:2},label:{show:!m.progress&&m.s.segmentValues,position:m.s.chartType==='line'?'top':'inside',color:m.s.chartType==='line'?theme.ink:'#fff',formatter:p=>chartFormat(p.value)},data:series.values}));
  if(m.s.totalLabels&&!m.progress)option.series.push({name:'',type:'scatter',symbolSize:0,tooltip:{show:false},label:{show:true,position:m.horizontal?'right':'top',color:theme.ink,formatter:p=>chartFormat(m.totals[p.dataIndex])},data:m.labels.map((label,i)=>{const high=m.s.chartType==='stacked'||m.horizontal?m.series.reduce((sum,series)=>sum+Math.max(0,series.values[i]||0),0):Math.max(0,...m.series.map(series=>series.values[i]||0));return m.horizontal?[high,label]:[label,high];})});
  if(m.progress)option.graphic=m.labels.flatMap((label,i)=>{const y=30+(height-38)*(i+.5)/Math.max(1,m.labels.length)-22;return [{type:'text',left:4,top:y,silent:true,style:{text:progressLabel(m,i),fill:theme.muted,fontFamily:theme.font,fontSize:theme.size,overflow:'truncate',width:width-65}},...(m.s.totalLabels?[{type:'text',right:8,top:y,silent:true,style:{text:chartFormat(m.totals[i]),fill:theme.ink,fontSize:theme.size}}]:[])];});
 }
 // Hidden pie rows are removed, so use the original index stored with each slice.
 if(m.pie)option.series[0].data=m.labels.flatMap((name,i)=>m.hidden.includes(i)?[]:[{name,value:m.values[i],itemStyle:{color:m.colors[i%m.colors.length]},originalIndex:i}]);
 if(m.pie)option.tooltip.formatter=p=>chartEscape(p.name)+': '+chartFormat(p.value)+(m.s.tooltipTotal?'<br>Разом: '+chartFormat(m.total):'');
 chart.setOption(option);return {resize:()=>chart.resize(),dispose:()=>chart.dispose()};
}
function renderChartJS(engine,node,m,theme,width,height){
 const canvas=node.ownerDocument.createElement('canvas');node.append(canvas);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',m.title);canvas.width=width;canvas.height=height;
 const labelLines=labelsFor(m,width),visible=m.labels.map((_,i)=>i).filter(i=>!m.hidden.includes(i));
 // A bitmap mirror keeps canvas painting reliable in the script-free admin iframe.
 // The original canvas still receives pointer events and draws its tooltip.
 const mirror=node.ownerDocument.defaultView.frameElement?node.ownerDocument.createElement('img'):null;
 if(mirror){mirror.className='cms-chart-canvas-mirror';mirror.alt='';mirror.setAttribute('aria-hidden','true');node.append(mirror);}
 const drawing={id:'kaiLabels',afterDraw(chart){if(mirror)mirror.src=chart.canvas.toDataURL();},beforeDatasetsDraw(chart){
  if(!m.progress)return;const {ctx,chartArea}=chart;ctx.save();ctx.strokeStyle=theme.line;ctx.lineWidth=5;ctx.lineCap='round';chart.getDatasetMeta(0).data.forEach(mark=>{ctx.beginPath();ctx.moveTo(chartArea.left,mark.y);ctx.lineTo(chartArea.right,mark.y);ctx.stroke();});ctx.restore();
 },afterDatasetsDraw(chart){
  const {ctx,chartArea}=chart;ctx.save();ctx.font=`${theme.size}px ${theme.font}`;ctx.textAlign='center';ctx.textBaseline='middle';
  if(m.pie){const arcs=chart.getDatasetMeta(0).data;arcs.forEach((arc,j)=>{const index=visible[j],value=m.values[index];if(!value||!m.total)return;const pos=arc.tooltipPosition();ctx.fillStyle='#fff';segmentText(m,value).split('\n').filter(Boolean).forEach((text,k,lines)=>ctx.fillText(text,pos.x,pos.y+(k-(lines.length-1)/2)*14));});}
  else{
   if(m.s.segmentValues&&!m.progress)chart.data.datasets.forEach((set,j)=>chart.getDatasetMeta(j).data.forEach((mark,i)=>{const value=set.data[i];if(value===null)return;ctx.fillStyle=m.s.chartType==='line'?theme.ink:'#fff';ctx.fillText(chartFormat(value),m.horizontal?(mark.x+mark.base)/2:mark.x,m.horizontal?mark.y:m.s.chartType==='line'?mark.y-13:(mark.y+mark.base)/2);}));
   m.labels.forEach((label,i)=>{
    const marks=chart.data.datasets.map((_,j)=>chart.getDatasetMeta(j).data[i]).filter(Boolean);if(!marks.length)return;
    if(m.progress){const y=marks[0].y-18;ctx.textAlign='left';ctx.fillStyle=theme.muted;const text=progressLabel(m,i);let short=text;while(short.length&&ctx.measureText(short).width>chartArea.width-50)short=short.slice(0,-1);ctx.fillText(short===text?text:short+'…',chartArea.left,y);if(m.s.totalLabels){ctx.textAlign='right';ctx.fillStyle=theme.ink;ctx.fillText(chartFormat(m.totals[i]),chartArea.right,y);}}
    else if(m.s.totalLabels){ctx.fillStyle=theme.ink;ctx.textAlign=m.horizontal?'left':'center';ctx.fillText(chartFormat(m.totals[i]),m.horizontal?Math.max(...marks.map(mark=>mark.x),chartArea.left)+7:marks[0].x,m.horizontal?marks[0].y:Math.min(...marks.map(mark=>mark.y),chartArea.bottom)-13);}
   });
  }ctx.restore();
 }};
 const datasets=m.pie?[{data:visible.map(i=>m.values[i]),backgroundColor:visible.map(i=>m.colors[i%m.colors.length]),borderWidth:0}]:m.series.map(series=>({label:series.name,data:series.values,backgroundColor:series.color,borderColor:series.color,borderWidth:m.s.chartType==='line'?2:0,pointRadius:3,spanGaps:false,barThickness:m.progress?5:undefined,borderRadius:2}));
 const stacked=['stacked','horizontal','horizontalStacked','progress'].includes(m.s.chartType);
 const chart=new engine(canvas,{type:m.pie?m.s.chartType==='donut'?'doughnut':'pie':m.s.chartType==='line'?'line':'bar',data:{labels:m.pie?visible.map(i=>m.labels[i]):labelLines,datasets},plugins:[drawing],options:{responsive:false,animation:false,maintainAspectRatio:false,indexAxis:m.horizontal?'y':'x',cutout:m.s.chartType==='donut'?'56%':undefined,layout:{padding:m.pie?8:{top:m.progress?22:25,right:m.s.totalLabels?46:10,bottom:5,left:0}},plugins:{legend:{display:false},tooltip:{displayColors:false,callbacks:{title:items=>m.pie?m.labels[visible[items[0].dataIndex]]:m.labels[items[0].dataIndex],label:item=>m.pie?chartFormat(item.raw):`${item.dataset.label}: ${item.raw===null?'немає даних':chartFormat(item.raw)}`,footer:items=>m.s.tooltipTotal?'Разом: '+chartFormat(m.pie?m.total:m.totals[items[0].dataIndex]):''}}},scales:m.pie?{}:{x:{display:!m.progress,stacked,beginAtZero:true,grace:m.progress?0:m.horizontal?'15%':undefined,...(m.progress?{min:0,max:Math.max(1,...m.totals)}:{}),grid:{color:theme.line,display:m.horizontal},ticks:{color:theme.muted,font:{family:theme.font,size:theme.size},...(m.horizontal?{callback:chartFormat}:{})}},y:{display:!m.progress,stacked,beginAtZero:true,grace:!m.horizontal?'15%':undefined,grid:{color:theme.line,display:!m.horizontal},ticks:{color:theme.muted,font:{family:theme.font,size:theme.size},autoSkip:!m.horizontal,...(!m.horizontal?{callback:chartFormat}:{})}}}}});
 return {resize:(w,h)=>chart.resize(w,h),dispose:()=>chart.destroy()};
}
async function renderPlotly(engine,node,m,theme,width,height){
 // Plotly registers its CSS in the parent document; copy it into the admin frame.
 if(node.ownerDocument!==document)for(const sheet of document.querySelectorAll('style[id^="plotly.js-style"]')){if(!node.ownerDocument.getElementById(sheet.id)){const copy=node.ownerDocument.createElement('style');copy.id=sheet.id;copy.textContent=[...sheet.sheet.cssRules].map(rule=>rule.cssText).join('\n');node.ownerDocument.head.append(copy);}}

 const visible=m.labels.map((_,i)=>i).filter(i=>!m.hidden.includes(i)),labelLines=labelsFor(m,width),categories=m.labels.map((_,i)=>String(i)),escapedLabels=labelLines.map(lines=>lines.map(chartEscape).join('<br>'));
 const traces=m.pie?[{type:'pie',labels:visible.map(i=>chartEscape(m.labels[i])),values:visible.map(i=>m.values[i]),marker:{colors:visible.map(i=>m.colors[i%m.colors.length])},hole:m.s.chartType==='donut'?.56:0,sort:false,direction:'clockwise',text:visible.map(i=>segmentText(m,m.values[i]).replaceAll('\n','<br>')),textinfo:'text',textposition:'inside',insidetextfont:{color:'#fff'},hovertemplate:'%{label}: %{value}'+(m.s.tooltipTotal?'<br>Разом: '+chartFormat(m.total):'')+'<extra></extra>'}]:m.series.map(series=>({type:m.s.chartType==='line'?'scatter':'bar',mode:m.s.segmentValues?'lines+markers+text':'lines+markers',name:chartEscape(series.name),orientation:m.horizontal?'h':'v',x:m.horizontal?series.values:categories,y:m.horizontal?categories:series.values,marker:{color:series.color},line:{color:series.color},connectgaps:false,text:!m.progress&&m.s.segmentValues?series.values.map(value=>value===null?'':chartFormat(value)):undefined,textposition:m.s.chartType==='line'?'top center':'inside',textfont:{color:m.s.chartType==='line'?theme.ink:'#fff'},hovertext:m.labels.map((_,i)=>chartEscape(tipText(m,i)).replaceAll('\n','<br>')),hovertemplate:'%{hovertext}<extra></extra>',width:m.progress?.09:undefined}));
 const axis={gridcolor:theme.line,zerolinecolor:theme.line,tickfont:{color:theme.muted,size:theme.size},automargin:false,fixedrange:true},cat={...axis,type:'category',categoryorder:'array',categoryarray:categories,tickvals:categories,ticktext:escapedLabels,showgrid:false,autorange:m.horizontal?'reversed':true,visible:!m.progress};
 const annotations=[];
 if(!m.pie)m.labels.forEach((label,i)=>{
  if(m.progress){annotations.push({xref:'paper',yref:'y',x:0,y:String(i),xanchor:'left',yshift:20,text:chartEscape(progressLabel(m,i)),showarrow:false,font:{color:theme.muted,size:theme.size}},...(m.s.totalLabels?[{xref:'paper',yref:'y',x:1,y:String(i),xanchor:'right',yshift:20,text:chartFormat(m.totals[i]),showarrow:false,font:{color:theme.ink,size:theme.size}}]:[]));}
  else if(m.s.totalLabels){const high=m.s.chartType==='stacked'||m.horizontal?m.series.reduce((sum,series)=>sum+Math.max(0,series.values[i]||0),0):Math.max(0,...m.series.map(series=>series.values[i]||0));annotations.push({x:m.horizontal?high:String(i),y:m.horizontal?String(i):high,xanchor:m.horizontal?'left':'center',xshift:m.horizontal?7:0,yshift:m.horizontal?0:14,text:chartFormat(m.totals[i]),showarrow:false,font:{color:theme.ink,size:theme.size}});}
 });
 const layout={width,height,separators:', ',paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',font:{family:theme.font,size:theme.size,color:theme.muted},showlegend:false,barmode:['stacked','horizontal','horizontalStacked','progress'].includes(m.s.chartType)?'relative':'group',margin:m.pie?{l:8,r:8,t:8,b:8}:{l:m.horizontal&&!m.progress?Math.max(100,Math.min(260,width*.34)):m.progress?4:48,r:m.s.totalLabels?52:18,t:m.progress?30:28,b:m.progress?8:42},annotations,xaxis:m.horizontal?{...axis,visible:!m.progress,rangemode:'tozero'}:cat,yaxis:m.horizontal?cat:{...axis,rangemode:'tozero'}};
 await engine.newPlot(node,traces,layout,{displayModeBar:false,responsive:false,scrollZoom:false,showTips:false});return {resize:(w,h)=>engine.relayout(node,{width:w,height:h}),dispose:()=>engine.purge(node)};
}
export function createChartRenderer(){
 const entries=new Map(),documents=new Map();let queued=false;
 const invalidate=node=>{const entry=entries.get(node);if(!entry)return;entry.cancelled=true;entry.resize?.disconnect();entry.instance?.dispose();entries.delete(node);};
 const clean=()=>{for(const [node,entry]of entries){if(!node.isConnected||(entry.frame&&entry.frame.contentDocument!==node.ownerDocument)){entry.cancelled=true;entry.instance?.dispose();entry.resize?.disconnect();entries.delete(node);}}};
 async function mount(node){
  const payload=JSON.parse(node.dataset.libraryChart),m=chartModel(payload);m.hidden=payload.hidden||[];
  const fallback=node.innerHTML,entry={cancelled:false,frame:node.ownerDocument.defaultView?.frameElement};entries.set(node,entry);node.dataset.chartStatus='loading';
  try{
   const engine=await loadChartLibrary(m.s.chartLibrary);if(entry.cancelled||!node.isConnected)return;
   const host=node.ownerDocument.createElement('div');host.className='cms-library-host';host.setAttribute('role','img');host.setAttribute('aria-label',`${payload.title||'Діаграма'} — ${CHART_LIBRARIES[m.s.chartLibrary]}`);
   const width=Math.max(180,Math.round(node.getBoundingClientRect().width)),labelHeight=m.horizontal&&m.s.wrapLabels?Math.max(0,...labelsFor(m,width).map(lines=>lines.length))*16:0;
   const height=m.progress?Math.max(100,m.labels.length*56+38):m.horizontal?Math.max(m.s.height,m.labels.length*Math.max(30,labelHeight+10)+60):m.s.height;
   host.style.height=height+'px';const plot=node.ownerDocument.createElement('div');plot.className='cms-library-canvas';host.append(plot);node.replaceChildren(host);node.dataset.chartKind=m.s.chartType;
   if(m.horizontal&&!m.progress&&!m.s.showAll){node.style.maxHeight=m.s.height+'px';node.style.overflow='auto';}
   const theme=chartTheme(node),render=m.s.chartLibrary==='echarts'?renderECharts:m.s.chartLibrary==='chartjs'?renderChartJS:renderPlotly;
   entry.instance=await render(engine,plot,m,theme,width,height);
   if(entry.cancelled||!node.isConnected){entry.instance.dispose();return;}
   if((m.s.chartType==='donut'&&m.s.totalLabels)||(m.pie&&!m.total)){const total=node.ownerDocument.createElement('strong');total.className='cms-library-total'+(!m.total?' cms-library-empty':'');total.textContent=m.total?chartFormat(m.total):'Немає даних';host.append(total);}
   let lastWidth=width;entry.resize=new ResizeObserver(()=>{const next=Math.round(node.getBoundingClientRect().width);if(next>0&&Math.abs(next-lastWidth)>1){lastWidth=next;invalidate(node);schedule();}});entry.resize.observe(node);node.dataset.chartLibrary=m.s.chartLibrary;node.dataset.chartStatus='ready';
  }catch(error){if(entry.cancelled||!node.isConnected)return;node.innerHTML=fallback;const note=node.ownerDocument.createElement('p');note.className='cms-chart-library-error';note.textContent=error.message+' Показано резервну діаграму.';node.append(note);node.dataset.chartStatus='error';}
 }
 function scan(){queued=false;clean();for(const [root,info]of documents){if(info.frame&&info.frame.contentDocument!==root){info.observer.disconnect();info.themeObserver.disconnect();documents.delete(root);continue;}root.querySelectorAll('[data-library-chart]').forEach(node=>{if(!entries.has(node))mount(node);});}}
 function schedule(){if(!queued){queued=true;queueMicrotask(scan);}}
 function observe(root){if(documents.has(root)){schedule();return;}const observer=new MutationObserver(schedule);observer.observe(root.documentElement,{childList:true,subtree:true});const themeObserver=new MutationObserver(()=>{for(const node of [...entries.keys()])if(node.ownerDocument===root)invalidate(node);schedule();});themeObserver.observe(root.documentElement,{attributes:true,attributeFilter:['style','data-theme','data-site-style']});documents.set(root,{observer,themeObserver,frame:root.defaultView?.frameElement});schedule();}
 return {observe,refresh:schedule};
}
