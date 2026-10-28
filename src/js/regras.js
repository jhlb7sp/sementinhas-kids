'use strict';
// Regras configuráveis: ausência, limite mensal e vínculos entre voluntários.
// O limite mensal conta dias distintos de participação, inclusive eventos.
function freshRulesConfig(){return {version:1,rules:[],limits:{teachers:0,helpers:0,people:{}},absences:[],preferredTuesdayHelper:{enabled:false,id:''}};}
function normalizeRulesConfig(data){
  const old=!data.rulesConfig;
  const rc=data.rulesConfig&&typeof data.rulesConfig==='object'?data.rulesConfig:freshRulesConfig();
  rc.version=1;
  rc.rules=Array.isArray(rc.rules)?rc.rules:[];
  rc.limits=rc.limits&&typeof rc.limits==='object'?rc.limits:{teachers:0,helpers:0,people:{}};
  rc.limits.people=rc.limits.people&&typeof rc.limits.people==='object'?rc.limits.people:{};
  rc.limits.teachers=Math.max(0,Number(rc.limits.teachers)||0);
  rc.limits.helpers=Math.max(0,Number(rc.limits.helpers)||0);
  rc.absences=Array.isArray(rc.absences)?rc.absences:[];
  rc.preferredTuesdayHelper=rc.preferredTuesdayHelper||{enabled:false,id:''};
  if(old){
    const named=(group,name)=>(data[group]||[]).find(p=>p.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))?.id;
    const j=named('teachers','Jorge'),c=named('teachers','Cinthia');
    const m=named('teachers','Michele'),t=named('helpers','Tita');
    const f=named('helpers','Felipe');
    if(j&&c)rc.rules.push({id:'legacy-jorge-cinthia',type:'same_day',a:j,b:c,enabled:true});
    if(m&&t)rc.rules.push({id:'legacy-michele-tita',type:'helper_pair',a:m,b:t,enabled:true});
    if(f)rc.preferredTuesdayHelper={enabled:true,id:f};
  }
  data.rulesConfig=rc;
  return data;
}
function rulesConfig(){if(!db.rulesConfig)normalizeRulesConfig(db);return db.rulesConfig;}
function findVolunteer(id){return [...db.teachers,...db.helpers].find(p=>p.id===id)}
function validIsoDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
  const [y,m,d]=value.split('-').map(Number),dt=new Date(y,m-1,d);
  return dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d;
}
function isoMonth(year,month,day){return year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0')}
function isAbsent(personId,date){return rulesConfig().absences.some(a=>a.person===personId&&a.date===date)}
function monthlyLimit(personId){
  const rc=rulesConfig(),individual=rc.limits.people[personId];
  const p=findVolunteer(personId),group=db.teachers.some(t=>t.id===personId)?'teachers':'helpers';
  if(!p)return 0;
  return individual!==undefined&&individual!==''?Math.max(0,Number(individual)||0):Math.max(0,Number(rc.limits[group])||0);
}
function canTakeAnother(personId,dates,date){
  const p=findVolunteer(personId),limit=monthlyLimit(personId);
  if(!p||!p.active||!validIsoDate(date)||isAbsent(personId,date))return false;
  const existing=dates.get(personId)||new Set();
  if(existing.has(date))return false; // Evita dois compromissos no mesmo dia.
  return !limit||existing.size<limit;
}
function copyUsage(usage){
  const result=new Map();
  for(const [id,dates] of usage)result.set(id,new Set(dates));
  return result;
}
function markUsage(usage,id,date){if(!id)return;let dates=usage.get(id);if(!dates){dates=new Set();usage.set(id,dates)}dates.add(date)}
function collectUsage(draft,{onlyExtras=false,includeOtherMonths=false}={}){
  const result=new Map(),year=draft.year,month=draft.month,prefix=year+'-'+String(month+1).padStart(2,'0')+'-';
  if(!onlyExtras){
    for(const slot of draft.sunday||[])for(const id of [slot.teacher,slot.helper])markUsage(result,id,isoMonth(year,month,slot.day));
    for(const slot of draft.tuesday||[])for(const id of [slot.teacher,slot.helper])markUsage(result,id,isoMonth(year,month,slot.day));
  }
  for(const event of draft.events||[])if(event.date&&(includeOtherMonths||event.date.startsWith(prefix)))for(const entry of event.staff||[])for(const id of [entry.teacher,entry.helper])markUsage(result,id,event.date);
  for(const pr of draft.programs||[])for(const day of pr.days||[])if(day.date&&(includeOtherMonths||day.date.startsWith(prefix)))for(const slot of day.slots||[])for(const id of [...(slot.teachers||[]),...(slot.helpers||[])])markUsage(result,id,day.date);
  return result;
}
function enabledRules(type){return rulesConfig().rules.filter(r=>r.enabled&&r.type===type)}
function pairsForSundays(available){
  const pairs=enabledRules('same_day'),members=new Map(),peopleById=new Map(available.map(p=>[p.id,p]));
  for(const r of pairs){
    if(!peopleById.has(r.a)||!peopleById.has(r.b)||r.a===r.b)throw Error('Regra de mesmo domingo com professor ausente, inativo ou repetido: '+(findVolunteer(r.a)?.name||r.a)+' / '+(findVolunteer(r.b)?.name||r.b));
    members.set(r.a,r.a);members.set(r.b,r.b);
  }
  function root(id){let p=members.get(id);while(members.get(p)!==p)p=members.get(p);return p}
  for(const r of pairs){const a=root(r.a),b=root(r.b);if(a!==b)members.set(b,a)}
  const groups=new Map();
  for(const id of members.keys()){const k=root(id);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(id)}
  return [...groups.values()].filter(g=>g.length>1);
}
function minCostAssign(slots,available,used,stats,year,month,forbidden=new Set()){
  if(!slots.length)return {assign:[],cost:0};
  const usable=available.filter(p=>!forbidden.has(p.id));
  const graph=[[]],source=0;
  function node(){graph.push([]);return graph.length-1}
  function edge(u,v,cap,cost){const a={to:v,rev:graph[v].length,cap,cost},b={to:u,rev:graph[u].length,cap:0,cost:-cost};graph[u].push(a);graph[v].push(b);return a}
  const personNodes=new Map(),dayNodes=new Map(),slotNodes=slots.map(()=>node()),sink=node(),slotEdges=[];
  for(let i=0;i<slots.length;i++)edge(slotNodes[i],sink,1,0);
  for(const p of usable){
    const count=used.get(p.id)?.size||0,limit=monthlyLimit(p.id);
    const availableCapacity=limit?Math.max(0,limit-count):slots.length;
    if(!availableCapacity)continue;
    const pn=node();personNodes.set(p.id,pn);
    for(let n=0;n<Math.min(availableCapacity,slots.length);n++)edge(source,pn,1,Math.max(0,count+n)*80);
    for(const day of [...new Set(slots.map(s=>s.day))]){
      const date=isoMonth(year,month,day);
      if(!canTakeAnother(p.id,used,date))continue;
      const dn=node();dayNodes.set(p.id+':'+day,dn);edge(pn,dn,1,0);
      for(let i=0;i<slots.length;i++){
        const slot=slots[i];if(slot.day!==day||!canServeRoom(p,slot.room))continue;
        const priority=p.p.indexOf(slot.room),cost=priority*22+(stats[p.id]||0)*8;
        const e=edge(dn,slotNodes[i],1,cost);
        slotEdges.push({index:i,id:p.id,e});
      }
    }
  }
  let flow=0,total=0;
  while(flow<slots.length){
    const dist=Array(graph.length).fill(Infinity),prev=Array(graph.length).fill(null),queue=[source],inQueue=new Set([source]);dist[source]=0;
    for(let qi=0;qi<queue.length;qi++){
      const u=queue[qi];inQueue.delete(u);
      for(let i=0;i<graph[u].length;i++){const e=graph[u][i];if(e.cap<=0||dist[u]+e.cost>=dist[e.to])continue;dist[e.to]=dist[u]+e.cost;prev[e.to]=[u,i];if(!inQueue.has(e.to)){queue.push(e.to);inQueue.add(e.to)}}
    }
    if(!Number.isFinite(dist[sink]))return null;
    for(let v=sink;v!==source;){const [u,i]=prev[v],e=graph[u][i];e.cap-=1;graph[v][e.rev].cap+=1;v=u}
    total+=dist[sink];flow++;
  }
  const assigned=Array(slots.length).fill(null);
  for(const {index,id,e} of slotEdges)if(e.cap===0)assigned[index]=id;
  return assigned.every(Boolean)?{assign:assigned,cost:total}:null;
}
function assignSundayWithRules(slots,available,used,stats,year,month,asTeachers=false){
  if(!slots.length)return [];
  const groups=asTeachers?pairsForSundays(available):[];
  const groupIds=new Set(groups.flat()),dateCandidates=[...new Set(slots.map(s=>s.day))];
  const candidatesFor=group=>{const list=[];
    for(const day of dateCandidates){
      const daySlots=slots.map((s,i)=>({...s,i})).filter(s=>s.day===day);
      function choose(i,occupied,assign,cost){
        if(i===group.length){list.push({forced:assign,cost});return}
        const id=group[i],p=available.find(a=>a.id===id),date=isoMonth(year,month,day);
        if(!canTakeAnother(id,used,date))return;
        for(const slot of daySlots){
          if(occupied.has(slot.i)||!canServeRoom(p,slot.room))continue;
          const next=new Map(assign);next.set(slot.i,id);
          choose(i+1,new Set([...occupied,slot.i]),next,cost+p.p.indexOf(slot.room)*22+(stats[id]||0)*8);
        }
      }
      choose(0,new Set(),new Map(),0);
    }
    return list.sort((a,b)=>a.cost-b.cost).slice(0,32);
  };
  const alternatives=groups.map(candidatesFor);
  if(alternatives.some(a=>!a.length))return null;
  let best=null,attempts=0;
  function evaluate(forced,forcedCost){
    const locked=new Set(forced.values()),reserve=copyUsage(used),remaining=[];
    for(const [i,id] of forced)markUsage(reserve,id,isoMonth(year,month,slots[i].day));
    const positions=[];slots.forEach((slot,i)=>{if(!forced.has(i)){positions.push(i);remaining.push(slot)}});
    const solved=minCostAssign(remaining,available,reserve,stats,year,month,new Set([...groupIds,...locked]));
    if(!solved)return;
    const full=slots.map((_,i)=>forced.get(i)||null);
    positions.forEach((idx,i)=>full[idx]=solved.assign[i]);
    const total=forcedCost+solved.cost;
    if(!best||total<best.cost)best={assign:full,cost:total};
  }
  function search(i,forced,cost){
    if(attempts>3000)return;
    if(i===groups.length){attempts++;evaluate(forced,cost);return}
    for(const choice of alternatives[i]){
      if([...choice.forced.keys()].some(k=>forced.has(k)))continue;
      const next=new Map(forced);for(const [k,id] of choice.forced)next.set(k,id);
      search(i+1,next,cost+choice.cost);
    }
  }
  search(0,new Map(),0);
  return best?.assign||null;
}
function planTuesday(dayNumbers,usage,year,month){
  const out=[],teachers=db.teachers.filter(p=>p.active&&p.days.includes('T')),helpers=db.helpers.filter(p=>p.active&&p.days.includes('T')),teacherStats=priorStats('teachers'),helperStats=priorStats('helpers');
  const pairs=enabledRules('helper_pair');
  const preferred=rulesConfig().preferredTuesdayHelper;
  for(const day of dayNumbers){
    const date=isoMonth(year,month,day);
    const candidates=[];
    for(const teacher of teachers){
      if(!canTakeAnother(teacher.id,usage,date))continue;
      const partnerRules=pairs.filter(r=>r.a===teacher.id),required=partnerRules.map(r=>helpers.find(h=>h.id===r.b));
      if(required.length>1||required.length===1&&(!required[0]||!canTakeAnother(required[0].id,usage,date)))continue;
      const partner=required[0]||null;
      const current=usage.get(teacher.id)?.size||0;
      const score=current*85+(teacherStats[teacher.id]||0)*9;
      candidates.push({teacher,partner,score});
    }
    candidates.sort((a,b)=>a.score-b.score||a.teacher.name.localeCompare(b.teacher.name,'pt-BR'));
    const chosen=candidates[0];
    if(!chosen)throw Error('Não há professor disponível na terça '+date+' respeitando ausências, vínculos e limites mensais.');
    let helper=chosen.partner;
    if(!helper&&preferred?.enabled&&preferred.id&&!out.some(s=>s.helper===preferred.id)){
      const preferredPerson=helpers.find(h=>h.id===preferred.id);
      if(preferredPerson&&canTakeAnother(preferredPerson.id,usage,date)&&!pairs.some(r=>r.b===preferredPerson.id&&r.a!==chosen.teacher.id))helper=preferredPerson;
    }
    if(!helper){
      // Quando não é obrigatória uma dupla, a aula pode ocorrer apenas com o professor.
      helper=null;
    }
    out.push({day,teacher:chosen.teacher.id,helper:helper?.id||null});
    markUsage(usage,chosen.teacher.id,date);if(helper)markUsage(usage,helper.id,date);
  }
  return out;
}
function buildConfiguredScale(){
  const year=Number($('year').value),month=Number($('month').value),ss=selected('sundays'),tt=selected('tuesdays'),santa=$('santa').value==='1',availableRooms=roomList();
  if(!ss.length&&!tt.length)throw Error('Selecione pelo menos um culto.');
  const old=db.draft?.key===key()?db.draft:null;
  const draft={key:key(),year,month,santa,rooms:availableRooms.length,sundays:ss,tuesdays:tt,sunday:[],tuesday:[],lessons:old?.lessons||{},events:old?.events||[],programs:old?.programs||[]};
  const already=collectUsage(draft,{onlyExtras:true});
  // Terças são preenchidas primeiro porque poucos professores atendem nesses dias.
  draft.tuesday=planTuesday(tt,already,year,month);
  const closedDay=santa?daysOf(0)[1]:null;
  const slots=ss.flatMap(day=>availableRooms.filter(room=>day!==closedDay||room!==availableRooms.length).map(room=>({day,room})));
  if(slots.length){
    const teachers=db.teachers.filter(p=>p.active&&p.days.includes('D')),helpers=db.helpers.filter(p=>p.active&&p.days.includes('D'));
    if(teachers.length<Math.max(...ss.map(d=>slots.filter(s=>s.day===d).length)))throw Error('Professores insuficientes para as salas abertas.');
    if(helpers.length<Math.max(...ss.map(d=>slots.filter(s=>s.day===d).length)))throw Error('Ajudantes insuficientes para as salas abertas.');
    const ts=assignSundayWithRules(slots,teachers,already,priorStats('teachers'),year,month,true);
    if(!ts)throw Error('Sem combinação válida para professores. Confira regras de mesmo domingo, preferências de sala, ausências e limites.');
    const hs=assignSundayWithRules(slots,helpers,already,priorStats('helpers'),year,month,false);
    if(!hs)throw Error('Sem combinação válida para ajudantes. Confira salas permitidas, ausências e limites mensais.');
    draft.sunday=slots.map((slot,i)=>({...slot,teacher:ts[i],helper:hs[i]}));
  }
  const check=validateConfiguredRules(draft);
  if(check.length)throw Error('A sugestão gerada apresenta conflito: '+check.join(' | '));
  return draft;
}
function validateConfiguredRules(draft){
  const errors=[],rc=rulesConfig(),usage=collectUsage(draft,{includeOtherMonths:true});
  for(const r of rc.rules.filter(r=>r.enabled)){
    const a=findVolunteer(r.a),b=findVolunteer(r.b);
    if(!a||!b||!a.active||!b.active){errors.push('Regra ativa com voluntário afastado/excluído: '+(a?.name||r.a)+' / '+(b?.name||r.b));continue}
    if(r.type==='same_day'&&draft.sundays?.length){
      const aDates=new Set(draft.sunday.filter(s=>s.teacher===r.a).map(s=>s.day));
      const bDates=new Set(draft.sunday.filter(s=>s.teacher===r.b).map(s=>s.day));
      if(!aDates.size||aDates.size!==bDates.size||[...aDates].some(d=>!bDates.has(d)))errors.push('Professores devem atuar nos mesmos domingos: '+a.name+' e '+b.name);
    }
    if(r.type==='helper_pair'){
      for(const t of draft.tuesday||[])if((t.teacher===r.a)!==(t.helper===r.b))errors.push('Dupla obrigatória na terça '+isoMonth(draft.year,draft.month,t.day)+': '+a.name+' / '+b.name);
    }
  }
  for(const [id,dates] of usage){
    const p=findVolunteer(id);
    const cap=monthlyLimit(id),byMonth=new Map();
    for(const date of dates)if(validIsoDate(date))byMonth.set(date.slice(0,7),(byMonth.get(date.slice(0,7))||0)+1);
    for(const [month,count] of byMonth)if(cap&&count>cap)errors.push((p?.name||id)+' excedeu limite em '+month+': '+count+' de '+cap+' participações.');
    for(const date of dates)if(isAbsent(id,date))errors.push((p?.name||id)+' está ausente em '+date+'.');
  }
  return errors;
}
