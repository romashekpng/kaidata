export const STYLE_FIELDS = {
 bodySize:{label:'Основний текст',min:12,max:24,step:1,unit:'px',value:16},
 headingSize:{label:'Заголовок сторінки',min:24,max:64,step:1,unit:'px',value:38},
 sectionSize:{label:'Заголовки блоків',min:16,max:36,step:1,unit:'px',value:21},
 valueSize:{label:'Числа в картках показників',min:24,max:64,step:1,unit:'px',value:36},
 menuSize:{label:'Пункти меню',min:12,max:24,step:1,unit:'px',value:16},
 controlsSize:{label:'Кнопки та поля введення',min:12,max:22,step:1,unit:'px',value:16},
 tableSize:{label:'Таблиці та списки',min:12,max:22,step:1,unit:'px',value:14},
 chartSize:{label:'Підписи графіків і легенди',min:10,max:20,step:1,unit:'px',value:12},
 smallSize:{label:'Примітки та допоміжний текст',min:11,max:20,step:1,unit:'px',value:13},
 lineHeight:{label:'Міжрядковий інтервал',min:1.1,max:2,step:.05,unit:'',value:1.55},
 paragraphGap:{label:'Відступ між абзацами',min:0,max:32,step:1,unit:'px',value:16},
 blockGap:{label:'Відступ між блоками',min:8,max:40,step:1,unit:'px',value:24},
 blockPadding:{label:'Внутрішні відступи блоків',min:8,max:40,step:1,unit:'px',value:22},
 rowPadding:{label:'Вертикальні відступи клітинок таблиць',min:4,max:24,step:1,unit:'px',value:12},
 radius:{label:'Заокруглення кутів блоків',min:0,max:28,step:1,unit:'px',value:14}
};
export function defaultSiteStyles(){
 const standard=Object.fromEntries(Object.entries(STYLE_FIELDS).map(([key,f])=>[key,f.value]));
 return {version:1,defaultPreset:'standard',presets:[
  {id:'standard',name:'Стандартний',values:standard},
  {id:'compact',name:'Компактний',values:{...standard,bodySize:14,headingSize:32,sectionSize:19,valueSize:30,menuSize:14,controlsSize:14,tableSize:13,chartSize:11,smallSize:12,lineHeight:1.25,paragraphGap:8,blockGap:12,blockPadding:14,rowPadding:6,radius:10}},
  {id:'comfortable',name:'Комфортний',values:{...standard,bodySize:18,headingSize:44,sectionSize:24,valueSize:42,menuSize:18,controlsSize:18,tableSize:16,chartSize:14,smallSize:15,lineHeight:1.75,paragraphGap:20,blockGap:28,blockPadding:26,rowPadding:16}}
 ]};
}
export function validateSiteStyles(input){
 if(!input||input.version!==1||!Array.isArray(input.presets)||!input.presets.length||input.presets.length>20)throw new Error('Стилі: потрібно від 1 до 20 пресетів та version: 1.');
 const ids=new Set();
 const presets=input.presets.map(p=>{
  if(!p||typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)||ids.has(p.id))throw new Error('Стилі: пресети повинні мати унікальні ID.');ids.add(p.id);
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>80)throw new Error('Назва пресета: від 1 до 80 символів.');
  if(!p.values||typeof p.values!=='object'||Array.isArray(p.values))throw new Error('Відсутні параметри пресета.');
  const values=Object.fromEntries(Object.entries(STYLE_FIELDS).map(([key,f])=>{
   const v=p.values[key];if(typeof v!=='number'||!Number.isFinite(v)||v<f.min||v>f.max||Math.abs((v-f.min)/f.step-Math.round((v-f.min)/f.step))>1e-7)throw new Error(`${f.label}: від ${f.min} до ${f.max}${f.unit?' '+f.unit:''}.`);
   return [key,v];
  }));
  return {id:p.id,name:p.name.trim(),values};
 });
 if(!ids.has(input.defaultPreset))throw new Error('Виберіть наявний пресет за замовчуванням.');
 return {version:1,defaultPreset:input.defaultPreset,presets};
}
export function siteStyleVariables(input){
 const styles=validateSiteStyles(input),values=styles.presets.find(p=>p.id===styles.defaultPreset).values;
 return Object.fromEntries(Object.entries(STYLE_FIELDS).map(([key,f])=>['--site-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),`${values[key]}${f.unit}`]));
}
