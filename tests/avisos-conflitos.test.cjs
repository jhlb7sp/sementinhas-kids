const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ctx=vm.createContext({console});
for(const name of ['core.js','regras.js','conflitos.js','programacoes.js','validacao.js']){
  const code=fs.readFileSync(path.join(__dirname,'../src/js',name),'utf8');
  vm.runInContext(code,ctx,{filename:name});
}
vm.runInContext('globalThis.api={blockingRoomConflicts,validation,approveWithWarnings,saveApproved};',ctx);
const get=()=>ctx.api;
const volunteer=(id,name)=>({id,name,active:true,days:'DT',p:[1,2,3,4]});
function prepare(){
  const data={
    teachers:[volunteer('j','Jorge'),volunteer('c','Cinthia'),volunteer('v','Vanessa'),volunteer('a','Ana')],
    helpers:[volunteer('h1','Ajudante 1'),volunteer('h2','Ajudante 2'),volunteer('h3','Ajudante 3')],
    history:{},draft:null,
    rulesConfig:{rules:[{id:'jc',type:'same_day',a:'j',b:'c',enabled:true}],
      limits:{teachers:0,helpers:0,people:{}},absences:[],preferredTuesdayHelper:{enabled:false,id:''}}
  };
  ctx.inputData=data;
  vm.runInContext('db=normalizeDb(inputData)',ctx);
  ctx.structuredClone=structuredClone;
  ctx.captureEventForm=()=>{};
  ctx.persist=()=>{};
  ctx.renderHistory=()=>{};
  ctx.show=(message,type)=>{ctx.lastMessage=message;ctx.lastType=type};
  ctx.alert=message=>{ctx.lastAlert=message};
  ctx.confirm=message=>{ctx.lastConfirmation=message;return ctx.reply};
  ctx.reply=true;ctx.lastConfirmation=null;ctx.lastAlert=null;
  return data;
}
function draft(){
  return {year:2026,month:11,key:'2026-12',rooms:3,santa:false,
    sundays:[6],tuesdays:[],sunday:[
      {day:6,room:1,teacher:'j',helper:'h1'},
      {day:6,room:2,teacher:'v',helper:'h2'},
      {day:6,room:3,teacher:'a',helper:'h3'}
    ],tuesday:[],events:[],programs:[],lessons:{}};
}
test('um voluntário em Kids 1 e Kids 2 no mesmo domingo gera conflito com campos identificáveis',()=>{
  prepare();const x=draft();x.sunday[1].teacher='j';
  const conflicts=Array.from(get().blockingRoomConflicts(x));
  assert.equal(conflicts.length,1);
  assert.equal(conflicts[0].id,'j');
  assert.deepEqual(Array.from(conflicts[0].rooms),[1,2]);
  assert.deepEqual(Array.from(conflicts[0].entries).map(e=>e.kind),['teacher','teacher']);
  assert.match(conflicts[0].message,/Jorge.*Kids 1 e Kids 2.*domingo 06\/12/);
  assert.equal(get().validation(x).errors.length,1);
});
test('um mesmo voluntário em duas salas, mesmo alternando função, bloqueia',()=>{
  prepare();const x=draft();x.sunday[1].helper='j';
  assert.equal(get().validation(x).errors.length,1);
});
test('voluntário repetido na mesma sala não é confundido com duas salas',()=>{
  prepare();const x=draft();x.sunday[0].helper='j';
  assert.equal(get().validation(x).errors.length,0);
});
test('mesmo voluntário em salas diferentes de um evento é conflito impeditivo',()=>{
  prepare();const x=draft();x.events=[{title:'Culto especial',date:'2026-12-10',staff:[
    {room:1,teacher:'v',helper:'h1',lesson:''},
    {room:3,teacher:'v',helper:'h2',lesson:''}
  ]}];
  const blocks=Array.from(get().blockingRoomConflicts(x));
  assert.equal(blocks.length,1);
  assert.equal(blocks[0].type,'event');
  assert.equal(blocks[0].eventIndex,0);
  assert.deepEqual(Array.from(blocks[0].entries).map(x=>x.staffIndex),[0,1]);
});
test('Jorge e Cinthia em dias diferentes é aviso confirmável, não bloqueio',()=>{
  const data=prepare(),x=draft();
  x.sundays=[6,13];x.sunday.push({day:13,room:1,teacher:'c',helper:'h1'});
  const v=get().validation(x);
  assert.deepEqual(Array.from(v.errors),[]);
  assert.ok(v.warnings.some(s=>s.includes('Jorge')&&s.includes('Cinthia')));
  data.draft=x;
  assert.equal(get().approveWithWarnings('gerar o PDF'),true);
  assert.match(ctx.lastConfirmation,/Jorge.*Cinthia[\s\S]*Deseja gerar o PDF mesmo assim/);
});
test('liderança pode cancelar ou aceitar avisos sem conflito impeditivo',()=>{
  const data=prepare(),x=draft();data.draft=x;
  ctx.reply=false;
  assert.equal(get().approveWithWarnings('salvar'),false);
  assert.match(ctx.lastMessage,/cancelada/i);
  ctx.reply=true;
  assert.equal(get().approveWithWarnings('salvar'),true);
});
test('duas salas impedem salvar, mesmo se confirm responder sim',()=>{
  const data=prepare(),x=draft();x.sunday[1].teacher='j';data.draft=x;
  ctx.reply=true;
  assert.equal(get().approveWithWarnings('salvar'),false);
  assert.match(ctx.lastAlert,/Ação bloqueada/);
  assert.equal(ctx.lastConfirmation,null);
});
test('ausência e limite mensal são avisos confirmáveis',()=>{
  const data=prepare(),x=draft();
  data.rulesConfig.absences=[{id:'a1',person:'j',date:'2026-12-06'}];
  data.rulesConfig.limits.people.j=1;
  x.sundays=[6,13];x.sunday.push({day:13,room:1,teacher:'j',helper:'h1'});
  const result=get().validation(x);
  assert.equal(result.errors.length,0);
  assert.ok(result.warnings.some(s=>s.includes('ausente')));
  assert.ok(result.warnings.some(s=>s.includes('limite')));
});
test('salvar escala aceita aviso com confirmação e mantém histórico',()=>{
  const data=prepare(),x=draft();data.draft=x;
  assert.equal(get().saveApproved(),undefined);
  assert.ok(data.history['2026-12']);
  assert.match(ctx.lastConfirmation,/Deseja salvar esta escala/);
});

test('duplicidade entre culto de domingo e evento na mesma data é impeditiva',()=>{
  prepare();const x=draft();
  x.events=[{title:'Evento especial',date:'2026-12-06',staff:[{room:2,teacher:'j',helper:null}]}];
  const blocks=Array.from(get().blockingRoomConflicts(x));
  assert.equal(blocks.length,1);
  assert.equal(blocks[0].type,'mixed');
  assert.match(blocks[0].message,/Jorge.*Kids 1 e Kids 2.*06\/12\/2026/);
  assert.equal(get().validation(x).errors.length,1);
});
test('destaque vermelho aparece nos campos duplicados e desaparece depois da correção',()=>{
  const data=prepare(),x=draft();x.sunday[1].teacher='j';data.draft=x;
  const makeClassList=()=>{const values=new Set();return {
    add:(...v)=>v.forEach(x=>values.add(x)),
    remove:(...v)=>v.forEach(x=>values.delete(x)),
    contains:v=>values.has(v)
  }};
  const areas=Array.from({length:2},()=>({classList:makeClassList(),children:[],
    appendChild(el){this.children.push(el);el.parent=this}}));
  const selects=[0,1].map((i)=>({
    value:'j',title:'',dataset:{},classList:makeClassList(),attributes:{},
    setAttribute(key,val){this.attributes[key]=val},
    removeAttribute(key){delete this.attributes[key]},
    closest(tag){return tag==='td'?areas[i]:null}
  }));
  const selector1='select[data-section="sunday"][data-day="6"][data-room="1"][data-kind="teacher"]';
  const selector2='select[data-section="sunday"][data-day="6"][data-room="2"][data-kind="teacher"]';
  const selectors={[selector1]:selects[0],[selector2]:selects[1]};
  ctx.document={
    querySelector:selector=>selectors[selector]||null,
    querySelectorAll:selector=>{
      if(selector==='.schedule-blocking')return selects.filter(el=>el.classList.contains('schedule-blocking'));
      if(selector==='.conflict-cell,.conflict-row')return areas.filter(el=>el.classList.contains('conflict-cell'));
      if(selector==='.conflict-marker')return areas.flatMap(area=>area.children.filter(el=>el.className.includes('conflict-marker')));
      return [];
    },
    createElement:()=>({className:'',textContent:'',setAttribute(){},remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}})
  };
  vm.runInContext('markBlockingFields()',ctx);
  assert.ok(selects.every(el=>el.classList.contains('schedule-blocking')));
  assert.ok(areas.every(el=>el.classList.contains('conflict-cell')));
  assert.ok(areas.every(el=>el.children.some(n=>n.textContent.includes('Kids 1 e Kids 2'))));
  x.sunday[1].teacher='v';selects[1].value='v';
  vm.runInContext('markBlockingFields()',ctx);
  assert.ok(selects.every(el=>!el.classList.contains('schedule-blocking')));
  assert.ok(areas.every(el=>!el.classList.contains('conflict-cell')&&el.children.length===0));
  delete ctx.document;
});
