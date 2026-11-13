import {isAffiliationColumn,affiliationMatches} from './data.js?v=catalog-italic-20261113';
import {validateDataMetricCard,NOTE_SOURCES,defaultBlockSettings} from './cms-data.js?v=catalog-italic-20261113';
import {resolveChartData,catalogTokens} from './catalog-view.js?v=catalog-italic-20261113';
import {renderMetricTable} from './block-view.js?v=catalog-italic-20261113';
export function dataMetricSource(card,context){return resolveChartData({binding:card.binding,columns:['Назва','Значення'],rows:[]},context,true);}
export function resolveDataMetrics(block,context){
 const headers=['label','value','unit','note','background','backgroundColor','icon'],results=[];
 for(const input of block.cards){
  if(input.visible===false)continue;
  try{
   const card=validateDataMetricCard(input),filterRows=table=>{
    const conditions=card.filters.map(f=>{const index=table.headers.indexOf(f.column);if(index<0)throw new Error(`Колонку умови «${f.column}» не знайдено.`);return {...f,index};});
    return table.rows.filter(row=>conditions.every(f=>{if(!f.values.length)return true;if(isAffiliationColumn(f.column))return f.values.some(value=>affiliationMatches(row[f.index],value));return f.match==='tokens'?catalogTokens(row[f.index]).some(token=>f.values.some(v=>catalogTokens(v).includes(token))):f.values.includes(String(row[f.index]??'').trim());}));
   };
   const result=resolveChartData({binding:card.binding,columns:['Назва','Значення'],rows:[]},{...context,scalar:true,filterRows});
   if(result.error)throw new Error(result.error);
   const number=result.number,formatted=number===null?card.emptyText:new Intl.NumberFormat('uk-UA',{maximumFractionDigits:card.decimals}).format(number),source=card.binding.kind==='builtin'?NOTE_SOURCES[card.binding.source]:context.getBlock(card.binding.blockId)?.title||'Таблиця',tokens={value:formatted,period:result.period,unit:card.unit,source},fill=text=>text.replace(/\{(value|period|unit|source)\}/g,(_,key)=>tokens[key]);
   results.push({card,number,value:formatted,label:fill(card.label),note:fill(card.note),period:result.period,error:''});
  }catch(error){results.push({card:input,number:null,value:input.emptyText||'—',label:input.label,note:error.message,period:'',error:error.message});}
 }
 const periods=[...new Set(results.map(r=>r.period).filter(Boolean))];
 return {results,period:periods.length>1?'Різні періоди':periods[0]||'',table:{headers,rows:results.map(r=>[r.label,r.value,r.card.unit,r.note,r.card.background,r.card.backgroundColor,r.card.icon])}};
}
export function renderDataMetrics(block,result){
 if(!result.results.length)return '<div class="empty"><p>Немає видимих карток.</p></div>';
 return renderMetricTable(result.table,{...defaultBlockSettings(),...block.settings});
}
