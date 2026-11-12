import { formatSegmentPercentage, isHorizontalChartType, CHART_LIBRARIES, BLOCK_PALETTES, chartSettingsForLibrary } from './cms-data.js?v=shared-period-20261112';
const chartLoads=new Map();
const chartVendor={echarts:['echarts.min.js','echarts'],chartjs:['chart.min.js','Chart'],plotly:['plotly.min.js','Plotly']};
const chartEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chartNumber=value=>value===''?null:Number(String(value).replace(',','.'));
const chartFormat=value=>new Intl.NumberFormat('uk-UA',{maximumFractionDigits:5}).format(value);
export async function loadChartLibrary(library){
 if(!Object.hasOwn(CHART_LIBRARIES,library))throw new Error('Невідома бібліотека для діаграм.');
 const [file,name]=chartVendor[library];if(globalThis[name])return globalThis[name];
 if(!chartLoads.has(library))chartLoads.set(library,new Promise((resolve,reject)=>{
  const script=document.createElement('script'),asset='src/vendor/'+file;
  const complete=()=>{if(globalThis[name])resolve(globalThis[name]);else reject(new Error(`Не вдалося запустити ${CHART_LIBRARIES[library]}.`));};
  script.onerror=()=>{script.remove();reject(new Error(`Не вдалося завантажити ${CHART_LIBRARIES[library]}. Перевірте файли бібліотеки.`));};
  if(globalThis.KAI_PUBLIC_ASSETS?.[asset]){script.textContent=globalThis.KAI_PUBLIC_ASSETS[asset];document.head.append(script);complete();}
  else{script.src=new URL(asset,document.baseURI).href+'?v=shared-period-20261112';script.onload=complete;document.head.append(script);}
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
export function wrapChartLabel(value,maxWidth=26,measure=text=>text.length){
 const words=String(value).trim().split(/\s+/).filter(Boolean),tokens=[],lines=[];let line='';
 // Keep short Ukrainian conjunctions/prepositions with the following word when
 // the pair fits. Width comes from actual font metrics in the browser.
 for(let i=0;i<words.length;i++){
  const pair=words[i]+' '+(words[i+1]||'');
  if(/^(та|і|й|з|із|зі|у|в|до|на)$/iu.test(words[i])&&words[i+1]&&measure(pair)<=maxWidth){tokens.push(pair);i++;}else tokens.push(words[i]);
 }
 const push=()=>{if(line){lines.push(line);line='';}};
 for(const token of tokens){
  if(measure(line?line+' '+token:token)<=maxWidth){line+=(line?' ':'')+token;continue;}
  push();
  if(measure(token)<=maxWidth){line=token;continue;}
  for(const character of token){if(line&&measure(line+character)>maxWidth)push();line+=character;}
 }
 push();return lines.length?lines:[''];
}
export function horizontalLabelLayout(labels,width,measure,lineHeight=16,wrap=true){
 const padding=8,gap=10,left=Math.round(Math.max(104,Math.min(280,width*.36))),labelWidth=Math.max(1,left-padding-gap);
 const truncate=label=>{if(measure(label)<=labelWidth)return label;let text='';for(const character of label){if(measure(text+character+'…')>labelWidth)break;text+=character;}return text+'…';};
 const lines=labels.map(label=>wrap?wrapChartLabel(label,labelWidth,measure):[truncate(label)]);
 return {padding,gap,left,width:labelWidth,lines,lineHeight};
}
export function progressLabelLayout(labels,totals,width,measure,lineHeight=18,{numbering=true,totalLabels=true}={}){
 const numberWidth=numbering?measure(String(labels.length).padStart(2,'0')):0,totalWidth=totalLabels?Math.max(0,...totals.map(value=>measure(chartFormat(value)))):0;
 const labelWidth=Math.max(1,width-12-(numbering?numberWidth+8:0)-(totalLabels?totalWidth+8:0));
 const lines=labels.map(label=>wrapChartLabel(label,labelWidth,measure)),labelHeight=Math.max(1,...lines.map(row=>row.length))*lineHeight;
 const rowHeight=Math.max(56,labelHeight+32),top=Math.max(30,Math.ceil(labelHeight+9-rowHeight/2+4));
 return {lines,lineHeight,rowHeight,top,bottom:8,numberWidth,totalWidth,labelWidth};
}
export function wrapChartTooltip(text,width,measure){return String(text).split('\n').flatMap(line=>wrapChartLabel(line,Math.max(1,width),measure));}
function measureChartText(node,theme){
 const canvas=node.ownerDocument.createElement('canvas'),ctx=canvas.getContext('2d'),cache=new Map();ctx.font=`${theme.size}px ${theme.font}`;
 return text=>{if(!cache.has(text))cache.set(text,ctx.measureText(text).width);return cache.get(text);};
}
function horizontalLabels(node,m,bounds){
 const layout=m.labelLayout,layer=node.ownerDocument.createElement('div');layer.className='cms-horizontal-labels';layer.setAttribute('aria-hidden','true');
 Object.assign(layer.style,{left:layout.padding+'px',width:layout.width+'px',top:bounds.top+'px',bottom:bounds.bottom+'px',fontFamily:m.labelTheme.font,fontSize:m.labelTheme.size+'px',lineHeight:layout.lineHeight+'px'});
 m.labels.forEach((label,i)=>{const row=node.ownerDocument.createElement('div'),text=node.ownerDocument.createElement('span');row.className='cms-horizontal-label-item';text.textContent=layout.lines[i].join('\n');text.title=label;row.append(text);layer.append(row);});node.append(layer);
}
function progressLabels(node,m,bounds,theme){
 const layout=m.progressLayout,doc=node.ownerDocument,layer=doc.createElement('div');layer.className='cms-progress-labels';
 Object.assign(layer.style,{top:bounds.top+'px',bottom:bounds.bottom+'px',gridTemplateRows:`repeat(${m.labels.length},minmax(0,1fr))`,fontFamily:theme.font,fontSize:theme.size+'px',lineHeight:layout.lineHeight+'px'});
 m.labels.forEach((label,i)=>{const row=doc.createElement('div'),caption=doc.createElement('div'),name=doc.createElement('span');row.className='cms-progress-label-row';caption.className='cms-progress-label-caption';name.className='cms-progress-label-name';name.textContent=layout.lines[i].join('\n');
  if(m.s.numbering){const number=doc.createElement('span');number.className='cms-progress-label-number';number.textContent=String(i+1).padStart(2,'0');number.style.width=layout.numberWidth+'px';caption.append(number);}
  caption.append(name);if(m.s.totalLabels){const value=doc.createElement('strong');value.className='cms-progress-label-value';value.textContent=chartFormat(m.totals[i]);caption.append(value);}row.append(caption);layer.append(row);
 });node.append(layer);
}
function chartTheme(node){
 const css=node.ownerDocument.defaultView.getComputedStyle(node),get=(key,fallback)=>css.getPropertyValue(key).trim()||fallback;
 return {ink:get('--ink','#18324d'),muted:get('--muted','#52687c'),line:get('--line','#e3e9ef'),surface:get('--surface','#fff'),font:css.fontFamily,size:parseFloat(get('--site-chart-size','12'))||12};
}
function segmentText(m,value){const parts=[];if(m.s.segmentValues)parts.push(chartFormat(value));if(m.pie&&m.s.segmentPercentages)parts.push(formatSegmentPercentage(value,m.total,m.s));return parts.join('\n');}
export function chartTooltipText(m,index){return `${m.labels[index]}\n${m.series.filter(series=>Number.isFinite(series.values[index])).map(series=>`${series.name}: ${chartFormat(series.values[index])}`).join('\n')}${m.s.tooltipTotal?'\nРазом: '+chartFormat(m.totals[index]):''}`;}
function labelsFor(m,width){return m.labelLayout?.lines||m.labels.map(label=>[label.length>34?label.slice(0,32)+'…':label]);}
function renderECharts(engine,node,m,theme,width,height){
 // Use measured dimensions across documents, including the sandboxed admin frame.
 const chart=engine.init(node,null,{renderer:'svg',width,height}),labelLines=labelsFor(m,width),category=m.horizontal?'yAxis':'xAxis',valueAxis=m.horizontal?'xAxis':'yAxis';
 const option={animation:false,textStyle:{fontFamily:theme.font,fontSize:theme.size,color:theme.muted},color:m.colors,tooltip:{confine:true,className:'cms-library-tooltip',extraCssText:`max-width:${m.tooltipWidth}px;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;line-height:1.35;`,trigger:m.pie?'item':'axis',formatter:params=>{
  if(m.pie){const p=params;return chartEscape(m.labels[p.dataIndex])+': '+chartFormat(m.values[p.dataIndex])+(m.s.tooltipTotal?'<br>Разом: '+chartFormat(m.total):'');}
  const index=params[0]?.dataIndex??0;return chartEscape(chartTooltipText(m,index)).replaceAll('\n','<br>');
 }},series:[]};
 if(m.pie){option.series=[{type:'pie',stillShowZeroSum:false,radius:m.s.chartType==='donut'?['56%','90%']:'90%',center:['50%','50%'],label:{show:m.s.segmentValues||m.s.segmentPercentages,position:'inside',color:'#fff',fontSize:theme.size,formatter:p=>segmentText(m,p.value)},labelLine:{show:false},data:m.labels.map((name,i)=>({name,value:m.values[i],itemStyle:{color:m.colors[i%m.colors.length],opacity:(new Set(m.hidden)).has(i)?0:1}})).filter((_,i)=>!m.hidden.includes(i))}];}
 else{
  option.grid={left:m.horizontal&&!m.progress?m.labelLayout.left:m.progress?4:48,right:m.s.totalLabels?52:18,top:m.progress?m.progressLayout.top:28,bottom:m.progress?m.progressLayout.bottom:42,containLabel:false};
  option[category]={type:'category',data:m.labels,inverse:m.horizontal,axisTick:{show:false},axisLine:{show:!m.progress,lineStyle:{color:theme.line}},axisLabel:{show:!m.horizontal,color:theme.muted,fontSize:theme.size,interval:0,width:m.horizontal?Math.max(88,Math.min(240,width*.32)):undefined,overflow:m.s.wrapLabels?'break':'truncate',formatter:(_,i)=>labelLines[i].join('\n')}};
  option[valueAxis]={type:'value',show:!m.progress,axisLabel:{color:theme.muted,fontSize:theme.size,formatter:chartFormat},splitLine:{lineStyle:{color:theme.line,type:'dashed'}},...(m.progress?{min:0,max:Math.max(1,...m.totals)}:{})};
  option.series=m.series.map(series=>({name:series.name,type:m.s.chartType==='line'?'line':'bar',stack:['stacked','horizontal','horizontalStacked','progress'].includes(m.s.chartType)?'values':undefined,connectNulls:false,symbolSize:7,barMaxWidth:m.progress?5:60,showBackground:m.progress,backgroundStyle:{color:theme.line},itemStyle:{color:series.color,borderRadius:m.progress?3:2},label:{show:!m.progress&&m.s.segmentValues,position:m.s.chartType==='line'?'top':'inside',color:m.s.chartType==='line'?theme.ink:'#fff',formatter:p=>chartFormat(p.value)},data:series.values}));
  if(m.s.totalLabels&&!m.progress)option.series.push({name:'',type:'scatter',symbolSize:0,tooltip:{show:false},label:{show:true,position:m.horizontal?'right':'top',color:theme.ink,formatter:p=>chartFormat(m.totals[p.dataIndex])},data:m.labels.map((label,i)=>{const high=m.s.chartType==='stacked'||m.horizontal?m.series.reduce((sum,series)=>sum+Math.max(0,series.values[i]||0),0):Math.max(0,...m.series.map(series=>series.values[i]||0));return m.horizontal?[high,label]:[label,high];})});
 }
 // Hidden pie rows are removed, so use the original index stored with each slice.
 if(m.pie)option.series[0].data=m.labels.flatMap((name,i)=>m.hidden.includes(i)?[]:[{name,value:m.values[i],itemStyle:{color:m.colors[i%m.colors.length]},originalIndex:i}]);
 if(m.pie)option.tooltip.formatter=p=>chartEscape(p.name)+': '+chartFormat(p.value)+(m.s.tooltipTotal?'<br>Разом: '+chartFormat(m.total):'');
 chart.setOption(option);return {bounds:m.horizontal?{top:option.grid.top,bottom:option.grid.bottom}:null,resize:(width,height)=>chart.resize({width,height}),dispose:()=>chart.dispose()};
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
    if(m.progress)return;
    else if(m.s.totalLabels){ctx.fillStyle=theme.ink;ctx.textAlign=m.horizontal?'left':'center';ctx.fillText(chartFormat(m.totals[i]),m.horizontal?Math.max(...marks.map(mark=>mark.x),chartArea.left)+7:marks[0].x,m.horizontal?marks[0].y:Math.min(...marks.map(mark=>mark.y),chartArea.bottom)-13);}
   });
  }ctx.restore();
 }};
 const datasets=m.pie?[{data:visible.map(i=>m.values[i]),backgroundColor:visible.map(i=>m.colors[i%m.colors.length]),borderWidth:0}]:m.series.map(series=>({label:series.name,data:series.values,backgroundColor:series.color,borderColor:series.color,borderWidth:m.s.chartType==='line'?2:0,pointRadius:3,spanGaps:false,barThickness:m.progress?5:undefined,borderRadius:2}));
 const stacked=['stacked','horizontal','horizontalStacked','progress'].includes(m.s.chartType);
 const chart=new engine(canvas,{type:m.pie?m.s.chartType==='donut'?'doughnut':'pie':m.s.chartType==='line'?'line':'bar',data:{labels:m.pie?visible.map(i=>m.labels[i]):labelLines,datasets},plugins:[drawing],options:{responsive:false,animation:false,maintainAspectRatio:false,indexAxis:m.horizontal?'y':'x',cutout:m.s.chartType==='donut'?'56%':undefined,layout:{padding:m.pie?8:{top:m.progress?m.progressLayout.top:25,right:m.s.totalLabels?46:10,bottom:5,left:0}},plugins:{legend:{display:false},tooltip:{filter:item=>Number.isFinite(item.raw),displayColors:false,padding:10,titleFont:{family:theme.font,size:theme.size,weight:'normal'},bodyFont:{family:theme.font,size:theme.size},footerFont:{family:theme.font,size:theme.size},callbacks:{title:items=>wrapChartTooltip(m.pie?m.labels[visible[items[0].dataIndex]]:m.labels[items[0].dataIndex],m.tooltipWidth-24,m.measure),label:item=>wrapChartTooltip(m.pie?chartFormat(item.raw):`${item.dataset.label}: ${chartFormat(item.raw)}`,m.tooltipWidth-24,m.measure),footer:items=>m.s.tooltipTotal?'Разом: '+chartFormat(m.pie?m.total:m.totals[items[0].dataIndex]):''}}},scales:m.pie?{}:{x:{display:!m.progress,stacked,beginAtZero:true,grace:m.progress?0:m.horizontal?'15%':undefined,...(m.progress?{min:0,max:Math.max(1,...m.totals)}:{}),grid:{color:theme.line,display:m.horizontal},ticks:{color:theme.muted,font:{family:theme.font,size:theme.size},...(m.horizontal?{callback:chartFormat}:{})}},y:{display:!m.progress,...(m.horizontal&&!m.progress?{afterFit:axis=>{axis.width=m.labelLayout.left;},border:{display:false}}:{}),stacked,beginAtZero:true,grace:!m.horizontal?'15%':undefined,grid:{color:theme.line,display:!m.horizontal},ticks:{display:!m.horizontal,color:theme.muted,font:{family:theme.font,size:theme.size},autoSkip:!m.horizontal,...(!m.horizontal?{callback:chartFormat}:{})}}}}});
 return {bounds:{top:chart.chartArea.top,bottom:height-chart.chartArea.bottom},resize:(w,h)=>chart.resize(w,h),dispose:()=>chart.destroy()};
}
async function renderPlotly(engine,node,m,theme,width,height){
 // Plotly registers its CSS in the parent document; copy it into the admin frame.
 if(node.ownerDocument!==document)for(const sheet of document.querySelectorAll('style[id^="plotly.js-style"]')){if(!node.ownerDocument.getElementById(sheet.id)){const copy=node.ownerDocument.createElement('style');copy.id=sheet.id;copy.textContent=[...sheet.sheet.cssRules].map(rule=>rule.cssText).join('\n');node.ownerDocument.head.append(copy);}}

 const tooltipText=index=>wrapChartTooltip(m.pie?m.labels[index]+': '+chartFormat(m.values[index])+(m.s.tooltipTotal?'\nРазом: '+chartFormat(m.total):''):chartTooltipText(m,index),m.tooltipWidth-24,m.measure).map(chartEscape).join('<br>');
 const visible=m.labels.map((_,i)=>i).filter(i=>!m.hidden.includes(i)),labelLines=labelsFor(m,width),categories=m.labels.map((_,i)=>String(i)),escapedLabels=labelLines.map(lines=>lines.map(chartEscape).join('<br>'));
 const traces=m.pie?[{type:'pie',labels:visible.map(i=>chartEscape(m.labels[i])),values:visible.map(i=>m.values[i]),marker:{colors:visible.map(i=>m.colors[i%m.colors.length])},hole:m.s.chartType==='donut'?.56:0,sort:false,direction:'clockwise',text:visible.map(i=>segmentText(m,m.values[i]).replaceAll('\n','<br>')),textinfo:'text',textposition:'inside',insidetextfont:{color:'#fff'},hovertext:visible.map(tooltipText),hovertemplate:'%{hovertext}<extra></extra>'}]:m.series.map(series=>({type:m.s.chartType==='line'?'scatter':'bar',mode:m.s.segmentValues?'lines+markers+text':'lines+markers',name:chartEscape(series.name),orientation:m.horizontal?'h':'v',x:m.horizontal?series.values:categories,y:m.horizontal?categories:series.values,marker:{color:series.color},line:{color:series.color},connectgaps:false,text:!m.progress&&m.s.segmentValues?series.values.map(value=>value===null?'':chartFormat(value)):undefined,textposition:m.s.chartType==='line'?'top center':'inside',textfont:{color:m.s.chartType==='line'?theme.ink:'#fff'},hovertext:m.labels.map((_,i)=>tooltipText(i)),hovertemplate:'%{hovertext}<extra></extra>',width:m.progress?.09:undefined}));
 const axis={gridcolor:theme.line,zerolinecolor:theme.line,tickfont:{color:theme.muted,size:theme.size},automargin:false,fixedrange:true},cat={...axis,type:'category',categoryorder:'array',categoryarray:categories,tickvals:categories,ticktext:escapedLabels,showgrid:false,showticklabels:!m.horizontal,autorange:m.horizontal?false:true,...(m.horizontal?{range:[m.labels.length-.5,-.5]}:{}),visible:!m.progress};
 const annotations=[];
 if(!m.pie)m.labels.forEach((label,i)=>{
  if(!m.progress&&m.s.totalLabels){const high=m.s.chartType==='stacked'||m.horizontal?m.series.reduce((sum,series)=>sum+Math.max(0,series.values[i]||0),0):Math.max(0,...m.series.map(series=>series.values[i]||0));annotations.push({x:m.horizontal?high:String(i),y:m.horizontal?String(i):high,xanchor:m.horizontal?'left':'center',xshift:m.horizontal?7:0,yshift:m.horizontal?0:14,text:chartFormat(m.totals[i]),showarrow:false,font:{color:theme.ink,size:theme.size}});}
 });
 const layout={width,height,separators:', ',paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',font:{family:theme.font,size:theme.size,color:theme.muted},showlegend:false,hoverlabel:{font:{family:theme.font,size:theme.size},namelength:-1,align:'left'},barmode:['stacked','horizontal','horizontalStacked','progress'].includes(m.s.chartType)?'relative':'group',margin:m.pie?{l:8,r:8,t:8,b:8}:{l:m.horizontal&&!m.progress?m.labelLayout.left:m.progress?4:48,r:m.s.totalLabels?52:18,t:m.progress?m.progressLayout.top:28,b:m.progress?m.progressLayout.bottom:42},annotations,xaxis:m.horizontal?{...axis,visible:!m.progress,rangemode:'tozero'}:cat,yaxis:m.horizontal?cat:{...axis,rangemode:'tozero'}};
 await engine.newPlot(node,traces,layout,{displayModeBar:false,responsive:false,scrollZoom:false,showTips:false});return {bounds:{top:layout.margin.t,bottom:layout.margin.b},resize:(w,h)=>engine.relayout(node,{width:w,height:h}),dispose:()=>engine.purge(node)};
}
export function createChartRenderer(afterRender=()=>{}){
 const entries=new Map(),documents=new Map();let queued=false;
 const invalidate=node=>{const entry=entries.get(node);if(!entry)return;entry.cancelled=true;entry.resize?.disconnect();entry.instance?.dispose();entries.delete(node);};
 const clean=()=>{for(const [node,entry]of entries){if(!node.isConnected||(entry.frame&&entry.frame.contentDocument!==node.ownerDocument)){entry.cancelled=true;entry.instance?.dispose();entry.resize?.disconnect();entries.delete(node);}}};
 async function mount(node){
  const payload=JSON.parse(node.dataset.libraryChart),m=chartModel(payload);m.hidden=payload.hidden||[];
  const fallback=node.innerHTML,entry={cancelled:false,frame:node.ownerDocument.defaultView?.frameElement};entries.set(node,entry);node.dataset.chartStatus='loading';
  try{
   const engine=await loadChartLibrary(m.s.chartLibrary);if(entry.cancelled||!node.isConnected)return;
   const host=node.ownerDocument.createElement('div');host.className='cms-library-host';host.setAttribute('role','img');host.setAttribute('aria-label',`${payload.title||'Діаграма'} — ${CHART_LIBRARIES[m.s.chartLibrary]}`);
   if(m.horizontal&&!m.progress&&!m.s.showAll)Object.assign(node.style,{maxHeight:m.s.height+'px',overflowX:'hidden',overflowY:'auto',scrollbarGutter:'stable'});
   const width=Math.max(180,node.clientWidth),theme=chartTheme(node);m.measure=measureChartText(node,theme);m.tooltipWidth=Math.max(80,Math.min(width-16,node.ownerDocument.defaultView.innerWidth-24));
   if(m.progress)m.progressLayout=progressLabelLayout(m.labels,m.totals,width,m.measure,Math.ceil(theme.size*1.35),m.s);
   if(m.horizontal&&!m.progress){m.labelTheme=theme;m.labelLayout=horizontalLabelLayout(m.labels,width,m.measure,Math.ceil(theme.size*1.35),m.s.wrapLabels||node.ownerDocument.defaultView.matchMedia('(max-width:720px)').matches);}
   const labelHeight=m.labelLayout?Math.max(0,...m.labelLayout.lines.map(lines=>lines.length))*m.labelLayout.lineHeight:0;
   const height=m.progress?Math.max(100,m.labels.length*m.progressLayout.rowHeight+m.progressLayout.top+m.progressLayout.bottom):m.horizontal?Math.max(m.s.height,m.labels.length*Math.max(30,labelHeight+10)+60):m.s.height;
   host.style.height=height+'px';const plot=node.ownerDocument.createElement('div');plot.className='cms-library-canvas';host.append(plot);node.replaceChildren(host);node.dataset.chartKind=m.s.chartType;
   const render=m.s.chartLibrary==='echarts'?renderECharts:m.s.chartLibrary==='chartjs'?renderChartJS:renderPlotly;
   entry.instance=await render(engine,plot,m,theme,width,height);
   if(entry.cancelled||!node.isConnected){entry.instance.dispose();return;}
   if(m.labelLayout)horizontalLabels(host,m,entry.instance.bounds);
   if(m.progress)progressLabels(host,m,entry.instance.bounds,theme);
   if((m.s.chartType==='donut'&&m.s.totalLabels)||(m.pie&&!m.total)){const total=node.ownerDocument.createElement('strong');total.className='cms-library-total'+(!m.total?' cms-library-empty':'');total.textContent=m.total?chartFormat(m.total):'Немає даних';host.append(total);}
   let lastWidth=width;entry.resize=new ResizeObserver(()=>{const next=node.clientWidth;if(next>0&&Math.abs(next-lastWidth)>1){lastWidth=next;invalidate(node);schedule();}});entry.resize.observe(node);node.dataset.chartLibrary=m.s.chartLibrary;node.dataset.chartStatus='ready';afterRender();
  }catch(error){if(entry.cancelled||!node.isConnected)return;node.innerHTML=fallback;const note=node.ownerDocument.createElement('p');note.className='cms-chart-library-error';note.textContent=error.message+' Показано резервну діаграму.';node.append(note);node.dataset.chartStatus='error';afterRender();}
 }
 function scan(){queued=false;clean();for(const [root,info]of documents){if(info.frame&&info.frame.contentDocument!==root){info.observer.disconnect();info.themeObserver.disconnect();documents.delete(root);continue;}root.querySelectorAll('[data-library-chart]').forEach(node=>{if(!entries.has(node))mount(node);});}}
 function schedule(){if(!queued){queued=true;queueMicrotask(scan);}}
 function observe(root){if(documents.has(root)){schedule();return;}const observer=new MutationObserver(schedule);observer.observe(root.documentElement,{childList:true,subtree:true});const themeObserver=new MutationObserver(()=>{for(const node of [...entries.keys()])if(node.ownerDocument===root)invalidate(node);schedule();});themeObserver.observe(root.documentElement,{attributes:true,attributeFilter:['style','data-theme','data-site-style']});documents.set(root,{observer,themeObserver,frame:root.defaultView?.frameElement});schedule();}
 return {observe,refresh:schedule};
}
