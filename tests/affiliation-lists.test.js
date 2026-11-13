import test from 'node:test';
import assert from 'node:assert/strict';
import {affiliationValues,affiliationMatches,groupCount} from '../src/data.js';
import {catalogFieldValues,resolveChartData} from '../src/catalog-view.js';
import {defaultCMSBlock,defaultChartBinding} from '../src/cms-data.js';
import {resolveDataMetrics} from '../src/data-metrics.js';
const faculty='Факультет авіації, електроніки';
const table={headers:['Рік','Факультет','Кафедра','Сума'],rows:[['2026',`${faculty}; Інший; ${faculty}`, 'Кафедра А; Кафедра Б; Кафедра А','10'],['2026',faculty,'Кафедра Б','20'],['2025','Інший','Кафедра А','5']]};
const context={year:2026,years:[2025,2026],getTable:()=>structuredClone(table)};
const chart=(extra={})=>({binding:{...defaultChartBinding(),kind:'builtin',source:'publications',periodMode:'year',groupColumn:'Факультет',operation:'count',...extra}});
test('affiliations split only at semicolons and deduplicate memberships',()=>{
 assert.deepEqual(affiliationValues(` ${faculty}; Інший; ${faculty}; `),[faculty,'Інший']);
 assert(affiliationMatches(`${faculty}; Інший`,faculty));assert(!affiliationMatches(faculty,'електроніки'));
 for(const field of ['faculty','department','Факультет','Кафедра'])assert.deepEqual(catalogFieldValues(`${faculty}; Інший`,field,true),[faculty,'Інший']);
 assert.deepEqual(groupCount([{faculty:'A; B; A'},{faculty:'A'}],'faculty'),[['A',2],['B',1]]);
 assert.deepEqual(groupCount([{department:'A; B; A'}],'department'),[['A',1],['B',1]]);
 assert.deepEqual(groupCount([{title:'A; B'}],'title'),[['A; B',1]]);
});
test('charts count each faculty and department once per record within selected period',()=>{
 assert.deepEqual(resolveChartData(chart(),context).table.rows,[[faculty,'2'],['Інший','1']]);
 assert.deepEqual(resolveChartData(chart({groupColumn:'Кафедра'}),context).table.rows,[['Кафедра А','1'],['Кафедра Б','2']]);
 assert.deepEqual(resolveChartData(chart({operation:'sum',valueColumns:['Сума']}),context).table.rows,[[faculty,'30'],['Інший','10']]);
 assert.deepEqual(resolveChartData(chart({periodMode:'all'}),context).table.rows,[[faculty,'2'],['Інший','2']]);
});
test('automatic and custom affiliation series use membership without duplicate counting',()=>{
 assert.deepEqual(resolveChartData(chart({groupColumn:'Рік',seriesColumn:'Факультет'}),context).table.rows,[['2026','2','1']]);
 const same=resolveChartData(chart({seriesColumn:'Факультет'}),context).table;
 assert.deepEqual(same.rows,[[faculty,'2',''],['Інший','','1']]);
 const rules=[{name:'Вибрані',column:'Факультет',values:[faculty,'Інший'],visible:true}];
 assert.deepEqual(resolveChartData(chart({groupColumn:'Рік',seriesRules:rules}),context).table.rows,[['2026','2']]);
});
test('metric filters match individual affiliations while total records remain unique',()=>{
 const b=defaultCMSBlock('dataMetrics');assert.equal(resolveDataMetrics(b,context).results[0].number,2);
 for(const match of ['exact','tokens']){
 b.cards[0].filters=[{column:'Факультет',match,values:[faculty,'Інший']}];assert.equal(resolveDataMetrics(b,context).results[0].number,2);
 b.cards[0].filters=[{column:'Кафедра',match,values:['Кафедра А']}];assert.equal(resolveDataMetrics(b,context).results[0].number,1);
 }
 assert.equal(table.rows[0][1],`${faculty}; Інший; ${faculty}`);
});
