import test from 'node:test';import assert from 'node:assert/strict';
import{progressLabelLayout,wrapChartTooltip}from'../src/chart-runtime.js';
const measure=text=>[...text].reduce((n,c)=>n+(c===' '?3:/[ШЩМW]/.test(c)?10:6),0);
const labels=['Факультет транспорту, менеджменту і логістики','Факультет аеронавігації, електроніки та телекомунікацій','А'.repeat(100)];
test('progress captions retain complete names and leave space for numbering, totals and bars on narrow screens',()=>{
 for(const width of[180,250,300,360,800]){const layout=progressLabelLayout(labels,[15,15,1234],width,measure,18);assert(layout.labelWidth>0);for(const[i,lines]of layout.lines.entries()){assert.equal(lines.join('').replace(/\s/g,''),labels[i].replace(/\s/g,''));assert(lines.every(line=>measure(line)<=layout.labelWidth));assert(!lines.join('').includes('…'));const captionTop=layout.top+layout.rowHeight/2-9-lines.length*layout.lineHeight;assert(captionTop>=3);assert(layout.rowHeight>lines.length*layout.lineHeight);}}
 const small=progressLabelLayout(labels,[15,15,1234],250,measure),wide=progressLabelLayout(labels,[15,15,1234],800,measure);assert(small.rowHeight>wide.rowHeight);
 const plain=progressLabelLayout(labels,[15,15,1234],250,measure,18,{numbering:false,totalLabels:false});assert(plain.labelWidth>small.labelWidth);
});
test('tooltip wrapping preserves the full title, values and totals, including long words',()=>{
 const text=labels[0]+'\nКількість: 15\nРазом: 15';for(const width of[80,180,280]){const lines=wrapChartTooltip(text,width,measure);assert(lines.every(line=>measure(line)<=width));assert.equal(lines.join('').replace(/\s/g,''),text.replace(/\s/g,''));assert(!lines.join('').includes('…'));}
 const unbroken='Д'.repeat(150);assert.equal(wrapChartTooltip(unbroken,80,measure).join(''),unbroken);
});
