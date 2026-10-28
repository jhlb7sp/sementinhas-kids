'use strict';
// Uma pessoa não pode assumir duas salas diferentes no mesmo culto ou evento.
// As demais regras são avisos confirmáveis pela liderança.
function blockingRoomConflicts(draft){
  const conflicts=[];
  function inspect(entries,context){
    const byPerson=new Map();
    for(const entry of entries){
      if(!entry.id||!Number.isInteger(+entry.room)||+entry.room<1||+entry.room>4)continue;
      const rows=byPerson.get(entry.id)||[];
      rows.push({...entry,room:+entry.room});
      byPerson.set(entry.id,rows);
    }
    for(const [id,rows] of byPerson){
      const rooms=[...new Set(rows.map(r=>r.room))].sort((a,b)=>a-b);
      if(rooms.length<2)continue;
      conflicts.push({
        ...context,id,rooms,entries:rows,
        message:(typeof person==='function'?person(id):id)+' está em '+rooms.map(r=>'Kids '+r).join(' e ')+
          ' no mesmo '+(context.type==='sunday'?'domingo '+String(context.day).padStart(2,'0')+'/'+String(draft.month+1).padStart(2,'0'):'evento '+context.title+(context.date?' ('+context.date.split('-').reverse().join('/')+')':''))+'.'
      });
    }
  }
  const sundays=new Set((draft.sunday||[]).map(s=>s.day));
  for(const day of sundays){
    const entries=[];
    for(const slot of draft.sunday||[])if(slot.day===day){
      entries.push({id:slot.teacher,kind:'teacher',room:slot.room});
      entries.push({id:slot.helper,kind:'helper',room:slot.room});
    }
    inspect(entries,{type:'sunday',day});
  }
  for(const [eventIndex,ev] of (draft.events||[]).entries()){
    const entries=[];
    for(const [staffIndex,slot] of (ev.staff||[]).entries()){
      entries.push({id:slot.teacher,kind:'teacher',room:slot.room,staffIndex});
      entries.push({id:slot.helper,kind:'helper',room:slot.room,staffIndex});
    }
    inspect(entries,{type:'event',eventIndex,title:ev.title||'sem título',date:ev.date||''});
  }
  return conflicts;
}
function markBlockingFields(){
  if(typeof document==='undefined')return;
  document.querySelectorAll('.schedule-blocking').forEach(el=>{
    el.classList.remove('schedule-blocking');
    el.removeAttribute('aria-invalid');
    el.removeAttribute('data-conflict-title');
    if(el.dataset.originalTitle!==undefined){el.title=el.dataset.originalTitle;delete el.dataset.originalTitle}
    else el.removeAttribute('title');
  });
  document.querySelectorAll('.conflict-cell,.conflict-row').forEach(el=>el.classList.remove('conflict-cell','conflict-row'));
  document.querySelectorAll('.conflict-marker').forEach(el=>el.remove());
  if(!db.draft)return;
  const conflicts=blockingRoomConflicts(db.draft),marked=new Map();
  for(const conflict of conflicts)for(const entry of conflict.entries){
    let select;
    if(conflict.type==='sunday')
      select=document.querySelector(`select[data-section="sunday"][data-day="${conflict.day}"][data-room="${entry.room}"][data-kind="${entry.kind}"]`);
    else
      select=document.querySelector(`#eventEditor select[data-event="${conflict.eventIndex}"][data-staff="${entry.staffIndex}"][data-role="${entry.kind}"]`);
    if(!select||select.value!==conflict.id)continue;
    select.classList.add('schedule-blocking');
    select.setAttribute('aria-invalid','true');
    if(select.dataset.originalTitle===undefined)select.dataset.originalTitle=select.title||'';
    select.title=conflict.message+' Corrija um dos campos destacados em vermelho.';
    let area;
    if(conflict.type==='sunday'){
      area=select.closest('td');
      area?.classList.add('conflict-cell');
    }else{
      area=select.closest('.event-people');
      area?.classList.add('conflict-row');
      const roomSelect=area?.querySelector('select[data-role="room"]');
      if(roomSelect)roomSelect.classList.add('schedule-blocking');
    }
    if(area&&!marked.has(area))marked.set(area,new Set());
    if(area)marked.get(area).add(conflict.message);
  }
  for(const [area,messages] of marked){
    const note=document.createElement('div');
    note.className='conflict-marker noprint';
    note.textContent='⚠️ '+[...messages].join(' ');
    note.setAttribute('role','alert');
    area.appendChild(note);
  }
}
function approveWithWarnings(action){
  captureEventForm();
  if(!db.draft){alert('Crie uma escala ou programação antes de continuar.');return false}
  const v=validation(db.draft);
  markBlockingFields();
  if(v.errors.length){
    const msg='Ação bloqueada: há voluntários em salas diferentes no mesmo culto.\n\n'+v.errors.join('\n')+'\n\nOs campos em conflito estão destacados em vermelho.';
    show(v.errors.join(' | '),'error');
    alert(msg);
    const first=typeof document==='undefined'?null:document.querySelector('.schedule-blocking');
    first?.scrollIntoView?.({block:'center',behavior:'smooth'});
    return false;
  }
  if(v.warnings.length){
    const unique=[...new Set(v.warnings)];
    const preview=unique.slice(0,10).map(s=>'• '+s).join('\n');
    const more=unique.length>10?'\n… e mais '+(unique.length-10)+' aviso(s). Consulte a validação para ver todos.':'';
    const proceed=confirm('ATENÇÃO: algumas regras não foram cumpridas.\n\n'+preview+more+'\n\nDeseja '+action+' mesmo assim?');
    if(!proceed){show('Operação cancelada: existem regras que exigem revisão.','warn');return false}
    show('Avisos reconhecidos. Você autorizou '+action+' mesmo com as regras pendentes.','warn');
  }
  persist();
  return true;
}
