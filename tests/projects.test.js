import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {projectProgress,projectsFromTable,filterProjects,renderProjectTable,renderProjectCard} from '../src/block-view.js';
import {defaultBlockSettings,validateCMSBlock} from '../src/cms-data.js';
import {cmsBlockCSV,importCMSBlockCSV,cmsBlockXLSX,importCMSBlockXLSX,readCMSJSON} from '../src/cms-io.js';
const table={headers:['Назва','Програма','Початок','Завершення','Роль','Надходження, грн','Посилання','Міжнародний'],rows:[
 ['Авіація','Horizon Europe','2026-01-01','2026-12-31','Партнер','1000000','https://example.com','true'],
 ['Екологія','МОН України','2026-01-01','2026-12-31','Координатор','500000','','false'],
 ['Авіаційні матеріали','Госпдоговори','2026-01-01','2026-12-31','Партнер','200000','','false'],
 ['Освіта','Horizon Europe','2026-01-01','2026-12-31','Координатор','750000','','true']
]};
test('часовий прогрес коректний до початку, в середині, після завершення та при одноденному строку',()=>{
 assert.deepEqual(projectProgress('2026-01-01','2026-01-11','2026-01-06'),{percent:50,status:'active',asOf:'2026-01-06'});
 assert.equal(projectProgress('2026-01-01','2026-01-11','2025-12-31').percent,0);
 assert.equal(projectProgress('2026-01-01','2026-01-11','2026-01-12').status,'completed');
 assert.equal(projectProgress('2026-01-01','2026-01-01','2026-01-01').percent,100);
 assert.equal(projectProgress('01.01.2026','11.01.2026','2026-01-06').percent,50);
 for(const [start,end]of [['bad','2026-01-01'],['2026-02-30','2026-03-31'],['2026-02-01','2026-01-01']])assert.equal(projectProgress(start,end,'2026-01-01'),null);
});
test('прогрес має крок 5%, округлюється до найближчого кроку та збігається в картках і таблиці',()=>{
 const start='2026-01-01',end='2026-04-11';
 for(const [day,expected]of [[0,0],[2,0],[3,5],[24,25],[61,60],[97,95],[98,100],[100,100]]){
  const date=new Date(Date.parse(start)+day*86400000).toISOString().slice(0,10);
  assert.equal(projectProgress(start,end,date).percent,expected);
 }
 const date='2026-01-25',project={...projectsFromTable(table)[0],startDate:start,endDate:end};
 const card=renderProjectCard(project,{},date),records=renderProjectTable({headers:table.headers,rows:[[project.title,project.program,start,end,project.role,project.revenue,project.url,'true']]},{},{view:'table'},'test',date);
 for(const html of [card,records]){assert(html.includes('aria-valuenow="25"'));assert(html.includes('width:25%'));assert(html.includes('25%'));}
});
test('програми беруться з даних, пошук, програма та роль поєднуються і не змінюють вихідний набір',()=>{
 const projects=projectsFromTable(table);assert.deepEqual(filterProjects(projects).programs,['Horizon Europe','МОН України','Госпдоговори']);
 assert.equal(filterProjects(projects,{query:'АВІАЦ'}).rows.length,2);
 assert.equal(filterProjects(projects,{program:'Horizon Europe',role:'Координатор'}).rows[0].title,'Освіта');
 assert.equal(filterProjects(projects,{query:'Авіація',program:'МОН України'}).rows.length,0);
 assert.equal(filterProjects(projects,{program:'відсутня'}).rows.length,4);assert.equal(projects.length,4);
});
test('позначення визначаються явним типом, вимикаються незалежно; старі таблиці не отримують хибного прапора',()=>{
 const settings=defaultBlockSettings('projects');let html=renderProjectTable(table,settings,{},'projects','2026-05-01');
 assert.equal((html.match(/aria-label="Міжнародний проєкт"/g)||[]).length,2);assert.equal((html.match(/aria-label="Український проєкт"/g)||[]).length,2);
 html=renderProjectTable(table,{...settings,showProjectGlobe:false,showProjectFlag:false});assert(!html.includes('class="project-origin'));
 const legacy={headers:table.headers.slice(0,-1),rows:table.rows.map(r=>r.slice(0,-1))};assert(projectsFromTable(legacy).every(p=>p.international===null));assert(!renderProjectTable(legacy,settings).includes('class="project-origin'));
 const reordered={headers:[table.headers[7],...table.headers.slice(0,7)],rows:table.rows.map(r=>[r[7],...r.slice(0,7)])};assert.deepEqual(projectsFromTable(reordered),projectsFromTable(table));
 const hostile=renderProjectCard({...projectsFromTable(table)[0],title:'<img src=x onerror=1>',url:'javascript:alert(1)'},settings);assert(!hostile.includes('<img'));assert(!hostile.includes('javascript:'));
});
test('ручні проєкти, ознака міжнародності та налаштування іконок зберігаються через JSON, CSV та XLSX',async()=>{
 const block=validateCMSBlock({id:'projects-test',type:'analytics',source:'projects',title:'Грантові проєкти',visible:true,dataMode:'manual',dataTable:table,settings:{...defaultBlockSettings('projects'),showProjectFlag:false}});
 assert.deepEqual(readCMSJSON(JSON.stringify({blockVersion:1,block}),'block',block),block);assert.deepEqual(importCMSBlockCSV(cmsBlockCSV(block),block),block);assert.deepEqual(await importCMSBlockXLSX(await cmsBlockXLSX(block,ExcelJS),block,ExcelJS),block);
 assert.throws(()=>validateCMSBlock({...block,settings:{...block.settings,showProjectGlobe:'false'}}));
});
test('табличний вигляд використовує відфільтровані записи, безпечно показує посилання й довільний текст',()=>{
 const input=structuredClone(table);input.rows[0][0]='<img src=x onerror=alert(1)>';input.rows[0][6]='javascript:alert(1)';input.rows[3][6]='https://example.com/project';
 const html=renderProjectTable(input,defaultBlockSettings('projects'),{view:'table',program:'Horizon Europe',role:'Координатор'},'projects','2026-05-01');
 assert(html.includes('https://example.com/project'));assert(!html.includes('Авіаційні матеріали'));assert(!html.includes('class="project-card"'));assert(html.includes('aria-valuenow="35"'));
 const hostile=renderProjectTable(input,{showProjectGlobe:false,showProjectFlag:false},{view:'table'},'projects','2026-05-01');assert(!hostile.includes('<img'));assert(!hostile.includes('javascript:'));assert(hostile.includes('&lt;img'));assert(!hostile.includes('class="project-origin'));
});
