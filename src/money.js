export const MONEY_UNIT='тис. грн';
const moneyFormatter=new Intl.NumberFormat('uk-UA',{maximumFractionDigits:5});
export function formatMoney(value){return value==null?'—':moneyFormatter.format(value);}
// Shift decimal exponents to avoid artefacts such as 9.29 * 1000 = 9289.999… .
export function scaleMoney(value,power){const [mantissa,exponent='0']=String(value).split('e');return Number(`${mantissa}e${Number(exponent)+power}`);}
export function moneyUnitPower(label){
 const text=String(label||'');
 if(/тис\.?\s*(?:грн\.?|₴|uah)/iu.test(text))return 0;
 if(/млн\.?\s*(?:грн\.?|₴|uah)/iu.test(text))return 3;
 if(/(?:\bUAH\b|₴|грн\.?)/iu.test(text))return -3;
 return null;
}
function moneyLabel(text){return String(text).replace(/(?:тис\.?\s*|млн\.?\s*)?(?:грн\.?|₴|\bUAH\b)/giu,MONEY_UNIT);}
function numericMoney(value){
 const text=String(value??'').trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
 return /^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(text)&&Number.isFinite(Number(text))?Number(text):null;
}
function moneyCell(value,power,formatted=false){
 if(power===null||power===0)return value;
 const number=numericMoney(value);if(number===null)return value;
 const scaled=scaleMoney(number,power);return formatted?formatMoney(scaled):String(scaled);
}
export function convertMoneyText(value){
 if(typeof value!=='string')return value;
 return value.replace(/([-+]?\d+(?:[ \u00a0\u202f]\d{3})*(?:[.,]\d+)?)\s*((?:млн\.?|тис\.?)\s*(?:грн\.?|₴|uah)|грн\.?|₴|\bUAH\b)/giu,(_,number,unit)=>`${formatMoney(scaleMoney(numericMoney(number),moneyUnitPower(unit)))} ${MONEY_UNIT}`);
}
export function convertMoneyTable(table,{source='',unitKnown=false,context=''}={}){
 if(!Array.isArray(table?.headers)||!Array.isArray(table?.rows))return table;
 if(!source&&/^Джерело/iu.test(table.headers[0])&&table.headers.slice(1).length&&table.headers.slice(1).every(h=>/^\d{4}$/.test(h))&&/надходжен|фінансуван/iu.test(context))source='fundingTable';
 const headers=[...table.headers],rows=table.rows.map(row=>Array.isArray(row)?[...row]:row),unit=headers.indexOf('unit'),value=headers.indexOf('value');
 if(unit>=0&&value>=0){
  for(const row of rows)if(Array.isArray(row)){const power=moneyUnitPower(row[unit]);if(power!==null){row[value]=moneyCell(row[value],power,true);row[unit]=MONEY_UNIT;}}
  return {headers,rows};
 }
 const explicit=headers.map(moneyUnitPower),hasExplicit=explicit.some(power=>power!==null),contextPower=moneyUnitPower(context),financial=['funding','programs','fundingSources','fundingTable','projects'].includes(source);
 const fallback=explicit.includes(0)||unitKnown?0:contextPower??(financial?(source==='fundingTable'||source==='projects'?-3:3):null);
 const hasMoney=financial||contextPower!==null||explicit.some(power=>power!==null);
 if(!hasMoney)return table;
 for(let c=0;c<headers.length;c++){
  const header=headers[c],nonMoney=/%|^(рік|year|дата|date|початок|завершення|роль|програма|назва|посилання|міжнародний|кількість|проєктів|публікацій)$/iu.test(String(header).trim());
  const inferred=!nonMoney&&(source==='fundingTable'&&c>0||!hasExplicit&&(source==='projects'?c===5:c>0)||contextPower!==null&&source!=='projects'&&c>0);
  const power=explicit[c]??(inferred?fallback:null);
  if(power!==null)for(const row of rows)if(Array.isArray(row))row[c]=moneyCell(row[c],power);
  if(explicit[c]!==null)headers[c]=moneyLabel(header);
  else if(power!==null&&source!=='fundingTable'&&financial)headers[c]=`${header}, ${MONEY_UNIT}`;
 }
 if(source==='fundingTable'&&moneyUnitPower(headers[0])===null)headers[0]=`${headers[0]}, ${MONEY_UNIT}`;
 return {headers,rows};
}
export function convertMoneyBlock(input){
 if(!input||typeof input!=='object')return input;
 const out={...input},source=input.type==='analytics'?input.source:'',context=[input.title,input.subtitle,input.caption].filter(Boolean).join(' · ');
 const financial=['funding','programs','fundingSources','fundingTable','projects','stats','fundingStats','revenueNotice'].includes(source);
 if(input.moneyUnit!==undefined&&input.moneyUnit!=='thousandUAH')throw new Error('Грошові одиниці блока: очікується thousandUAH.');
 const config={source,unitKnown:input.moneyUnit==='thousandUAH',context};
 if(input.dataTable)out.dataTable=convertMoneyTable(input.dataTable,config);
 if(input.metricManualBackup?.dataTable)out.metricManualBackup={...input.metricManualBackup,dataTable:convertMoneyTable(input.metricManualBackup.dataTable,config)};
 if(['chart','table'].includes(input.type)){
  const table=convertMoneyTable({headers:input.columns,rows:input.rows},config);out.columns=table.headers;out.rows=table.rows;
 }
 if(input.type==='metrics'&&Array.isArray(input.items))out.items=input.items.map(item=>{const power=moneyUnitPower(item?.unit);return power===null?item:{...item,value:moneyCell(item.value,power,true),unit:MONEY_UNIT};});
 for(const key of ['title','subtitle','caption'])if(typeof input[key]==='string')out[key]=moneyUnitPower(input[key])===null?input[key]:moneyLabel(convertMoneyText(input[key]));
 for(const key of ['text'])if(typeof input[key]==='string')out[key]=convertMoneyText(input[key]);
 if(financial||input.moneyUnit!==undefined||JSON.stringify(out)!==JSON.stringify(input))out.moneyUnit='thousandUAH';
 return out;
}
