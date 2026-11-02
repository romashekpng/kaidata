import { currentReportingYear, reportDate, updateProjectReports, validateBundle } from './data.js?v=sidebar-text-20261102';
import { icon } from './icons.js?v=sidebar-text-20261102';
const reportEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createProjectReportsEditor(options){
 let dialog,projects=[],selected='',drafts=new Map();
 const e=reportEscape;
 function capture(){
  const rows=[...dialog.querySelectorAll('[data-report-year]')].map(row=>({year:+row.dataset.reportYear,amount:row.querySelector('[data-report-amount]').value,percent:row.querySelector('[data-report-progress]').value}));
  if(selected)drafts.set(selected,rows);
 }
 function render(){
  const project=projects.find(p=>p.id===selected),last=currentReportingYear(),rows=[];
  if(project)for(let year=+project.startDate.slice(0,4);year<=Math.min(+project.endDate.slice(0,4),last);year++)rows.push({year,amount:project.funding.find(f=>f.year===year)?.amountThousandUAH??'',percent:project.progressByYear?.find(r=>r.year===year)?.percent??''});
  const values=drafts.get(selected)||rows;
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="project-reports-title">Надходження грантів за роками</h2><button type="button" class="button secondary small" data-reports-close aria-label="Закрити">×</button></div><div class="dialog-body"><p class="report-help">Вносьте фактичні надходження університету у тис. грн за кожен рік. Загальна сума не розподіляється автоматично. Ці дані використовують картки проєктів, показники грантів та «Кошти за програмами».</p><form id="project-reports-form"><label class="report-project-label">Проєкт<select id="report-project" ${projects.length?'':'disabled'}>${projects.map(p=>`<option value="${e(p.id)}" ${p.id===selected?'selected':''}>${e(p.title)} · ${e(p.program)}</option>`).join('')}</select></label>${project?`<p class="report-help">${e(project.startDate)} — ${e(project.endDate)} · ${e(project.program)}</p>`:''}<div class="report-year-list">${values.length?values.map(row=>`<div class="report-year-row" data-report-year="${row.year}"><strong>${row.year}</strong><label>Фактичні надходження, тис. грн<input type="text" inputmode="decimal" data-report-amount aria-label="Надходження ${row.year}, тис. грн" placeholder="Не вказано" value="${e(row.amount)}"></label><label>Фактичне виконання, %<input type="number" min="0" max="100" step="5" data-report-progress aria-label="Виконання ${row.year}" placeholder="За датами" value="${e(row.percent)}"></label></div>`).join(''):`<p class="muted">${project?'Для цього проєкту звітні роки ще не настали.':'Спочатку імпортуйте перелік проєктів через «Керування даними».'}</p>`}</div><p class="report-help">Порожня сума — дані не вказано; 0 — підтверджена відсутність надходжень. Відсоток необов’язковий, із кроком 5%; без нього прогрес розраховується за датами станом на вибраний звітний рік. У блоках оберіть джерело даних «Аналітика сайта», щоб вони оновлювалися разом.</p><div class="form-error" id="project-reports-error" role="alert"></div><div class="dialog-actions"><button type="button" class="button secondary" data-reports-close>Скасувати</button><button type="submit" class="button primary" ${projects.length?'':'disabled'}>${icon('check')} Зберегти зміни</button></div></form></div>`;
 }
 function open(){
  projects=structuredClone(options.getData().projects);drafts=new Map();selected=projects[0]?.id||'';
  if(!dialog){dialog=document.createElement('dialog');dialog.id='project-reports-dialog';dialog.setAttribute('aria-labelledby','project-reports-title');document.body.append(dialog);
   dialog.addEventListener('change',event=>{if(event.target.id==='report-project'){capture();selected=event.target.value;render();dialog.querySelector('#report-project').focus();}});
   dialog.addEventListener('click',event=>{if(event.target.closest('[data-reports-close]'))dialog.close();});
   dialog.addEventListener('submit',event=>{if(event.target.id!=='project-reports-form')return;event.preventDefault();try{
    capture();const current=options.getData(),next=current.projects.map(p=>drafts.has(p.id)?updateProjectReports(p,drafts.get(p.id)):p);
    options.save(validateBundle({...current,updatedAt:reportDate(currentReportingYear()),projects:next}));dialog.close();options.notify('Річні надходження та виконання збережено. Пов’язані блоки оновлено.');
   }catch(error){dialog.querySelector('#project-reports-error').textContent=error.message;}});
  }
  render();dialog.showModal();
 }
 return {open};
}
