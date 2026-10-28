'use strict';
const K='escala_kids_v1',rooms=[1,2,3,4],week=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const t=(name,p,days='D',active=true)=>({id:'t_'+name.toLowerCase().replace(/\W/g,''),name,p,days,active});
const h=(name,p,days='D',active=true)=>({id:'h_'+name.toLowerCase().replace(/\W/g,''),name,p,days,active});
const initial=()=>({teachers:[],helpers:[],history:{},draft:null});
let db=initial(),storage='browser';const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function normalizePerson(p){
  // 0 significa ausência deliberada de autorização para a sala.
  // Não completar preferências vazias com Kids 2/3/4 durante a leitura do backup.
  const saved=Array.isArray(p.p)?p.p.slice(0,4):[];
  p.p=Array.from({length:4},(_,i)=>[1,2,3,4].includes(Number(saved[i]))?Number(saved[i]):0);
  return p;
}
function normalizeDb(data){for(let group of ['teachers','helpers']){(data[group]||[]).forEach(normalizePerson)}return normalizeRulesConfig(data)}
async function load(){try{if(window.escalaDesktop){let d=await window.escalaDesktop.load();if(d&&d.teachers)db=normalizeDb(d);storage='pendrive'}else{let s=localStorage.getItem(K);if(s){let d=JSON.parse(s);if(d.teachers)db=normalizeDb(d);}}}catch(e){alert('Não foi possível carregar os dados: '+e.message)}db=normalizeDb(db);$('mode').textContent=storage==='pendrive'?'● Dados no pendrive':'● Versão navegador';$('storageNotice').textContent=storage==='pendrive'?'Os dados são gravados automaticamente no arquivo dados/escala-kids.json, ao lado do aplicativo portátil. Faça backup periodicamente.':'ATENÇÃO: No navegador, o salvamento automático fica neste computador e navegador, NÃO no pendrive. Use “Salvar backup JSON” e “Restaurar backup” ao trocar de computador. Para persistência diretamente no pendrive, utilize o executável Electron.';start();}
let saving=Promise.resolve();function persist(){const snapshot=JSON.stringify(db);if(window.escalaDesktop){saving=saving.then(()=>window.escalaDesktop.save(JSON.parse(snapshot))).catch(e=>alert('Falha ao salvar no pendrive: '+e.message));}else try{localStorage.setItem(K,snapshot)}catch(e){alert('Falha de armazenamento: '+e.message)}}
let customDays={sundays:[],tuesdays:[]};function roomList(){return Array.from({length:+$('roomCount').value},(_,i)=>i+1)}
function updateSantaLabel(){let count=+$('roomCount').value; $('santa').options[0].textContent='Santa Ceia — Kids '+count+' fica no culto';$('santa').options[1].textContent='Aula normal nas '+count+' salas'}
function allDates(id){const normal=daysOf(id==='sundays'?0:2);return [...new Set([...normal,...(customDays[id]||[])])].sort((a,b)=>a-b)}
function dateISO(d){return `${$('year').value}-${String(+$('month').value+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function firstLabels(){return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']}
function dateFull(d){return dateISO(d).slice(8)+'/'+dateISO(d).slice(5,7)}
function currentMonthDate(date){if(!date)return null;const [y,m,d]=date.split('-').map(Number);if(y!==+$('year').value||m!==+$('month').value+1)return null;return d}
function key(){return $('year').value+'-'+String(+$('month').value+1).padStart(2,'0')}
function daysOf(w){let y=+$('year').value,m=+$('month').value,out=[];for(let d=1;d<=new Date(y,m+1,0).getDate();d++)if(new Date(y,m,d).getDay()===w)out.push(d);return out}
function setDates(preserve=true){for(let [id,w] of [['sundays',0],['tuesdays',2]]){let previous=[...$(id).querySelectorAll('input:checked')].map(e=>+e.value);let oldDays=[...$(id).querySelectorAll('input')].map(e=>+e.value);let oldCount=oldDays.length;$(id).classList.add('date-list');$(id).innerHTML=allDates(id).map(d=>`<label class="checkrow"><input type="checkbox" value="${d}" ${!preserve||!oldCount||previous.includes(d)||!oldDays.includes(d)?'checked':''}> ${dateFull(d)} (${week[new Date(+$('year').value,+$('month').value,d).getDay()]})</label>`).join('')}}
function selected(id){return [...$(id).querySelectorAll('input:checked')].map(e=>+e.value)}
function dateLabel(d){return String(d).padStart(2,'0')+'/'+String(+$('month').value+1).padStart(2,'0')}
function getPeople(type){return db[type].filter(p=>p.active)}
function priorStats(type){let counts={};for(let item of db[type])counts[item.id]=0;let entries=Object.values(db.history).sort((a,b)=>b.key.localeCompare(a.key)).slice(0,3);for(let [idx,H] of entries.entries()){let weight=3-idx;for(let participation of programParticipation(H.programs))if(counts[participation.id]!==undefined)counts[participation.id]+=weight;for(let slot of [...H.sunday,...H.tuesday,...(H.events||[]).flatMap(e=>e.staff||[])]){let id=type==='teachers'?slot.teacher:slot.helper;if(id&&counts[id]!==undefined)counts[id]+=weight}}return counts}
function canServeRoom(p,room){return !!p&&Array.isArray(p.p)&&p.p.includes(Number(room))}
function cost(p,room,stats){if(!canServeRoom(p,room))return Infinity;let pri=p.p.indexOf(Number(room));return pri*22+(stats[p.id]||0)*9+(p.name.length%4)*.002}
// Busca exata via programação dinâmica: ninguém duas vezes no mesmo mês aos domingos.
function match(slots,people,stats,forced={}){const fixed=Object.entries(forced);if(new Set(fixed.map(([,id])=>id)).size!==fixed.length)return null;if(fixed.some(([i,id])=>!canServeRoom(people.find(p=>p.id===id),slots[+i]?.room)))return null;let targets=slots.map((s,i)=>({...s,index:i})).filter(s=>!(s.index in forced));let eligible=people.filter(p=>!fixed.some(([,id])=>p.id===id));if(eligible.length<targets.length)return null;let memo=new Map();function solve(i,mask){if(i===targets.length)return{value:0,assign:[]};let mk=i+':'+mask;if(memo.has(mk))return memo.get(mk);let best=null;for(let j=0;j<eligible.length;j++){if(mask&(1<<j))continue;let p=eligible[j];if(!canServeRoom(p,targets[i].room))continue;let next=solve(i+1,mask|(1<<j));if(!next)continue;let val=cost(p,targets[i].room,stats)+next.value;if(!best||val<best.value)best={value:val,assign:[p.id,...next.assign]}}memo.set(mk,best);return best}let res=solve(0,0);if(!res)return null;let ids=slots.map((_,i)=>forced[i]||null);targets.forEach((s,i)=>ids[s.index]=res.assign[i]);return{ids,value:res.value+fixed.reduce((v,[i,id])=>v+cost(people.find(p=>p.id===id),slots[+i].room,stats),0)}}
// Para quatro salas, admite repetição ENTRE cultos, nunca no mesmo culto.
function matchFlexible(slots,people,stats,forced={}){if(people.length>=slots.length)return match(slots,people,stats,forced);let ids=slots.map(()=>null),total=0,usedCount={};for(let day of [...new Set(slots.map(s=>s.day))]){let ix=slots.map((s,i)=>s.day===day?i:-1).filter(i=>i>=0),sub=ix.map(i=>slots[i]),local={};ix.forEach((i,j)=>{if(forced[i])local[j]=forced[i]});let weighted={};for(let p of people)weighted[p.id]=(stats[p.id]||0)+(usedCount[p.id]||0)*9;let candidate=people;let r=match(sub,candidate,weighted,local);if(!r)return null;ix.forEach((i,j)=>{ids[i]=r.ids[j];usedCount[r.ids[j]]=(usedCount[r.ids[j]]||0)+1});total+=r.value}return{ids,value:total}}
