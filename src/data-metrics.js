import {isAffiliationColumn,affiliationMatches} from './data.js?v=table-zebra-20261117';
import {validateDataMetricCard,NOTE_SOURCES,defaultBlockSettings} from './cms-data.js?v=table-zebra-20261117';
import {resolveChartData,catalogTokens} from './catalog-view.js?v=table-zebra-20261117';
import {renderMetricTable} from './block-view.js?v=table-zebra-20261117';
export function dataMetricSource(card,context){return resolveChartData({binding:card.binding,columns:['Назва','Значення'],rows:[]},context,true);}
function metricFilterRows(filters){return table=>{
 const conditions=filters.map(f=>{const index=table.headers.indexOf(f.column);if(index<0)throw new Error(`Колонку умови «${f.column}» не знайдено.`);return {...f,index};});
 return table.rows.filter(row=>conditions.every(f=>{if(!f.values.length)return true;if(isAffiliationColumn(f.column))return f.values.some(value=>affiliationMatches(row[f.index],value));return f.match==='tokens'?catalogTokens(row[f.index]).some(token=>f.values.some(v=>catalogTokens(v).includes(token))):f.values.includes(String(row[f.index]??'').trim());}));
};}
function metricValue(card,context,filters=card.filters,binding=card.binding){const result=resolveChartData({binding,columns:['Назва','Значення'],rows:[]},{...context,scalar:true,filterRows:metricFilterRows(filters)});if(result.error)throw new Error(result.error);return result;}
function metricNoteCalculation(card,context,current){
 const calc=card.noteCalculation,fmt=value=>value===null?'—':new Intl.NumberFormat('uk-UA',{maximumFractionDigits:calc.decimals}).format(value);
 if(calc.mode==='manual')return {percent:'',previous:'',previousPeriod:'',numerator:'',denominator:'',calculationError:''};
 let numerator=null,denominator=null,previousPeriod='',error='';
 try{
  if(calc.mode==='delta'){
   const b=card.binding;if(b.periodMode==='all'||!current.period)throw new Error('Для динаміки оберіть рік або фіксований період.');
   const period=b.periodMode==='fixed'?b.period:String(context.year);previousPeriod=period.split('-').map(year=>Number(year)-1).join('-');
   const previous=metricValue(card,{...context,year:context.year-1},card.filters,{...b,period:previousPeriod});
   numerator=current.number;denominator=previous.number;
  }else{
   numerator=calc.useCardFilters?current.number:metricValue(card,context,calc.numeratorFilters).number;
   denominator=metricValue(card,context,calc.denominatorFilters).number;
  }
 }catch(e){error=e.message;}
 const raw=numerator===null||denominator===null||denominator===0?null:calc.mode==='delta'?(numerator-denominator)/Math.abs(denominator)*100:numerator/denominator*100;
 const percent=raw!==null&&Number.isFinite(raw)?raw:null,rounded=percent===null?null:Number(percent.toFixed(calc.decimals));
 return {percent:percent===null?'—':`${calc.mode==='delta'&&rounded>0?'+':''}${fmt(rounded)}%`,previous:fmt(denominator),previousPeriod:previousPeriod.replace('-','–'),numerator:fmt(numerator),denominator:fmt(denominator),percentage:percent,calculationError:error};
}
export function resolveDataMetrics(block,context){
 const headers=['label','value','unit','note','background','backgroundColor','icon'],results=[];
 for(const input of block.cards){
  if(input.visible===false)continue;
  try{
   const card=validateDataMetricCard(input),result=metricValue(card,context),calculation=metricNoteCalculation(card,context,result);
   const number=result.number,formatted=number===null?card.emptyText:new Intl.NumberFormat('uk-UA',{maximumFractionDigits:card.decimals}).format(number),source=card.binding.kind==='builtin'?NOTE_SOURCES[card.binding.source]:context.getBlock(card.binding.blockId)?.title||'Таблиця',tokens={value:formatted,period:result.period,unit:card.unit,source,...calculation},fill=text=>text.replace(/\{(value|period|unit|source|percent|previous|previousPeriod|numerator|denominator)\}/g,(_,key)=>tokens[key]);
   const note=fill(card.note),auto=card.noteCalculation.mode!=='manual'&&!card.note.includes('{percent}');
   results.push({card,number,value:formatted,label:fill(card.label),note:auto?`${calculation.percent}${note?' '+note:''}`:note,period:result.period,error:'',...calculation});
  }catch(error){results.push({card:input,number:null,value:input.emptyText||'—',label:input.label,note:error.message,period:'',error:error.message});}
 }
 const periods=[...new Set(results.map(r=>r.period).filter(Boolean))];
 return {results,period:periods.length>1?'Різні періоди':periods[0]||'',table:{headers,rows:results.map(r=>[r.label,r.value,r.card.unit,r.note,r.card.background,r.card.backgroundColor,r.card.icon])}};
}
export function renderDataMetrics(block,result){
 if(!result.results.length)return '<div class="empty"><p>Немає видимих карток.</p></div>';
 return renderMetricTable(result.table,{...defaultBlockSettings(),...block.settings});
}
