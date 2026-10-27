'use strict';
function start(){updateSantaLabel();months.forEach((name,i)=>{$('month').insertAdjacentHTML('beforeend',`<option value="${i}">${name}</option>`)});$('month').value='11';$('year').value='2026';setDates();if(db.draft){$('month').value=String(db.draft.month);$('year').value=String(db.draft.year);$('santa').value=db.draft.santa?'1':'0';$('roomCount').value=db.draft.rooms||3;customDays={sundays:(db.draft.sundays||[]).filter(d=>new Date(db.draft.year,db.draft.month,d).getDay()!==0),tuesdays:(db.draft.tuesdays||[]).filter(d=>new Date(db.draft.year,db.draft.month,d).getDay()!==2)};setDates();for(let [id,arr] of [['sundays',db.draft.sundays],['tuesdays',db.draft.tuesdays]])for(let input of $(id).querySelectorAll('input'))input.checked=arr.includes(+input.value)}updateSantaLabel();render();renderTeam();renderHistory()}
for(let btn of document.querySelectorAll('.tab'))btn.addEventListener('click',()=>{for(let x of document.querySelectorAll('.tab'))x.classList.toggle('active',x===btn);for(let id of ['gerar','equipe','historico','config'])$(id).classList.toggle('hide',btn.dataset.tab!==id)});
$('roomCount').addEventListener('change',updateSantaLabel);for(let id of ['month','year'])$(id).addEventListener('change',()=>{customDays={sundays:[],tuesdays:[]};setDates(false)});$('resetDates').onclick=()=>{customDays={sundays:[],tuesdays:[]};setDates(false)};$('addExtraDate').onclick=()=>{let d=currentMonthDate($('extraCultDate').value);if(!d)return alert('Escolha uma data do mês selecionado.');let group=confirm('Adicionar como culto da escala de DOMINGO? Clique Cancelar para adicionar à escala de TERÇA.')?'sundays':'tuesdays';customDays[group].push(d);setDates();};$('generate').onclick=build;$('approve').onclick=saveApproved;$('validate').onclick=()=>{if(!db.draft)return show('Gere uma escala primeiro.','warn');let v=validation(db.draft);render();show(v.errors.length?v.errors.join(' | '):'Regras obrigatórias verificadas'+(v.warnings.length?' (há avisos).':'.'),v.errors.length?'error':v.warnings.length?'warn':'ok')};$('print').onclick=()=>{saveEventForm();window.print()};$('csv').onclick=csvExport;
$('gerar').addEventListener('change',e=>{if(e.target.dataset.lesson&&db.draft){db.draft.lessons=db.draft.lessons||{};db.draft.lessons[e.target.dataset.lesson]=e.target.value;persist();return;}let s=e.target.closest('select[data-section]');if(!s||!db.draft)return;let row=db.draft[s.dataset.section].find(x=>x.day===+s.dataset.day&&(s.dataset.room===undefined||x.room===+s.dataset.room));row[s.dataset.kind]=s.value||null;persist();render()});
$('addEvent').onclick=()=>{if(!db.draft)return show('Gere uma escala antes de adicionar eventos.','warn');db.draft.events=db.draft.events||[];db.draft.events.push({title:'',date:'',staff:[{teacher:null,room:null,helper:null,lesson:''}]});persist();renderEvents()};// Os formulários de eventos possuem salvamento independente do restante da escala.
// Nunca reconstruir o formulário ao digitar ou selecionar valores.
function captureEventForm(){
 if(!db.draft)return;
 for(const card of $('eventEditor').querySelectorAll('.event-card')){
  const first=card.querySelector('[data-event]');
  if(!first)continue;
  const idx=Number(first.dataset.event), ev=db.draft.events?.[idx];
  if(!ev)continue;
  for(const el of card.querySelectorAll('[data-field]'))ev[el.dataset.field]=el.value;
  for(const el of card.querySelectorAll('[data-staff][data-role]')){
   const staff=ev.staff?.[Number(el.dataset.staff)];
   if(!staff)continue;
   staff[el.dataset.role]=el.dataset.role==='room'?(el.value?Number(el.value):null):el.value||null;
  }
 }
}
function saveEventForm(){
 captureEventForm();
 persist();
 renderEventPrint();
 $('report').innerHTML=report(db.draft);
}
// Captura alterações sem alterar a estrutura HTML, preservando foco e seleção.
for(const eventName of ['input','change']){
 $('eventEditor').addEventListener(eventName,e=>{
  if(!e.target.closest('[data-event]'))return;
  e.stopPropagation();
  captureEventForm();
  const card=e.target.closest('.event-card');
  const status=card?.querySelector('[data-event-status]');
  if(status)status.textContent='Alterações pendentes — clique em Salvar evento.';
 },true);
}
$('eventEditor').addEventListener('click',e=>{
 const btn=e.target.closest('button');
 if(!btn||!db.draft)return;
 e.stopPropagation();
 captureEventForm();
 const arr=db.draft.events;
 if(btn.dataset.saveEvent!==undefined){
  saveEventForm();
  const status=btn.closest('.event-card')?.querySelector('[data-event-status]');
  if(status)status.textContent='✅ Evento salvo e prévia atualizada.';
  return;
 }
 if(btn.dataset.addStaff!==undefined)arr[Number(btn.dataset.addStaff)].staff.push({teacher:null,room:null,helper:null,lesson:''});
 if(btn.dataset.removeStaff!==undefined){let a=arr[Number(btn.dataset.removeStaff)].staff;if(a.length>1)a.splice(Number(btn.dataset.index),1)}
 if(btn.dataset.removeEvent!==undefined){if(!confirm('Excluir evento?'))return;arr.splice(Number(btn.dataset.removeEvent),1)}
 persist();renderEvents();$('report').innerHTML=report(db.draft);
});
$('equipe').addEventListener('change',e=>{let tr=e.target.closest('tr[data-type]');if(!tr)return;let p=db[tr.dataset.type][+tr.dataset.index],a=e.target;if(a.dataset.field==='name'){let other=[...db.teachers,...db.helpers].some(q=>q!==p&&q.name.toLowerCase()===a.value.trim().toLowerCase());if(!a.value.trim()||other){alert('Nome inválido ou já cadastrado.');renderTeam();return}p.name=a.value.trim()}if(a.dataset.field==='active')p.active=a.checked;if(a.dataset.pri!==undefined)p.p[+a.dataset.pri]=+a.value;if(a.dataset.day){p.days=(a.dataset.day==='D'?(a.checked?'D':'')+(p.days.includes('T')?'T':''):(p.days.includes('D')?'D':'')+(a.checked?'T':''))}persist();renderTeam()});
$('equipe').addEventListener('click',e=>{let tr=e.target.closest('tr[data-type]');if(!tr||!e.target.dataset.remove)return;let type=tr.dataset.type,i=+tr.dataset.index;if(!confirm('Excluir '+db[type][i].name+'? O histórico continuará armazenando a identificação antiga.'))return;db[type].splice(i,1);persist();renderTeam()});
for(let [id,type] of [['addTeacher','teachers'],['addHelper','helpers']])$(id).onclick=()=>{let name=prompt('Nome do novo voluntário:')?.trim();if(!name)return;if([...db.teachers,...db.helpers].some(p=>p.name.toLowerCase()===name.toLowerCase()))return alert('Nome já cadastrado');db[type].push({id:type[0]+'_'+Date.now(),name,p:[1,2,3,4],days:'D',active:true});persist();renderTeam()};
$('historico').addEventListener('click',e=>{let k=e.target.dataset.history||e.target.dataset.deleteHistory;if(!k)return;if(e.target.dataset.deleteHistory){if(confirm('Excluir o mês '+k+' do histórico?')){delete db.history[k];persist();renderHistory()}return}db.draft=structuredClone(db.history[k]);$('month').value=db.draft.month;$('year').value=db.draft.year;$('santa').value=db.draft.santa?'1':'0';$('roomCount').value=db.draft.rooms||3;customDays={sundays:(db.draft.sundays||[]).filter(d=>new Date(db.draft.year,db.draft.month,d).getDay()!==0),tuesdays:(db.draft.tuesdays||[]).filter(d=>new Date(db.draft.year,db.draft.month,d).getDay()!==2)};setDates();for(let [id,arr] of [['sundays',db.draft.sundays],['tuesdays',db.draft.tuesdays]])for(let input of $(id).querySelectorAll('input'))input.checked=arr.includes(+input.value);render();document.querySelector('[data-tab="gerar"]').click();persist()});
$('backup').onclick=()=>download(JSON.stringify(db,null,2),'backup-escala-kids-'+new Date().toISOString().slice(0,10)+'.json','application/json');$('restoreButton').onclick=()=>$('restore').click();$('restore').onchange=async e=>{let file=e.target.files[0];if(!file)return;try{let data=JSON.parse(await file.text());if(!Array.isArray(data.teachers)||!Array.isArray(data.helpers)||!data.history||typeof data.history!=='object')throw Error('Formato inválido');if(!confirm('Substituir todos os dados atuais pelo backup?'))return;db=normalizeDb(data);persist();location.reload()}catch(err){alert('Não foi possível restaurar: '+err.message)}};$('reset').onclick=()=>{if(!confirm('ATENÇÃO: apagar todos os dados e retornar à equipe inicial?'))return;db=initial();persist();location.reload()};
// A apresentação para impressão usa os nomes via CSS, sem duplicar controles.
let style=document.createElement('style');style.textContent='.printonly{display:none}@media print{.printonly{display:inline}.noprint{display:none!important}}';document.head.append(style);load();
