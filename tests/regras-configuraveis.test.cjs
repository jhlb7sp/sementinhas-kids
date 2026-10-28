const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({console});
const files=['core.js','regras.js','programacoes.js','validacao.js'];
for(const f of files)vm.runInContext(fs.readFileSync(path.join(root,'src/js',f),'utf8'),context,{filename:f});
vm.runInContext('globalThis.api={normalizeDb,rulesConfig,findVolunteer,canTakeAnother,collectUsage,assignSundayWithRules,planTuesday,buildConfiguredScale,validateConfiguredRules,monthlyLimit,isAbsent}',context);
function setup({teachers=[],helpers=[],rules=[],limits={},absences=[],sundays=[],tuesdays=[],events=[],programs=[],year=2026,month=11}={}){
 const draft={
  teachers:teachers.map((p,i)=>({id:p.id||'t_'+i,name:p.name||'Professor '+i,p:p.p||[1,2,3,4],days:p.days||'D',active:p.active!==false})),
  helpers:helpers.map((p,i)=>({id:p.id||'h_'+i,name:p.name||'Ajudante '+i,p:p.p||[1,2,3,4],days:p.days||'D',active:p.active!==false})),
  history:{},draft:null,
  rulesConfig:{version:1,rules,limits:{teachers:limits.teachers||0,helpers:limits.helpers||0,people:limits.people||{}},absences,
   preferredTuesdayHelper:{enabled:false,id:''}}
 };
 context.dbRecord=draft;
 const inputs={year:{value:String(year)},month:{value:String(month)},santa:{value:'0'},roomCount:{value:'3'},
  sundays:{querySelectorAll:()=>sundays.map(value=>({value}))},
  tuesdays:{querySelectorAll:()=>tuesdays.map(value=>({value}))}};
 context.document={getElementById:id=>inputs[id]};
 vm.runInContext('db=normalizeDb(dbRecord)',context);
 return draft;
}
const person=(name,id,p=[1,2,3,4],days='D')=>({name,id,p,days});
const helpers=Array.from({length:8},(_,i)=>person('Auxiliar '+i,'h'+i));
const teachers=[
 person('Jorge','j',[1,2,3,4]),
 person('Cinthia','c',[1,2,3,4]),
 person('Matheus','m',[1,2,3,4]),
 person('Jhenifer','jh',[1,2,3,4]),
 person('Ana','a',[1,2,3,4]),
 person('Vanessa','v',[1,0,0,0]),
 person('Naide','n',[2,1,3,4]),
 person('Thais','th',[3,1,2,4]),
 person('Sâmia','s',[2,3,1,4],'DT')
];
const linked=(a,b)=>({id:'link_'+a,type:'same_day',a,b,enabled:true});
test('regras existentes são migradas por ID e podem ser desativadas',()=>{
 const data={teachers:[person('Jorge','t1'),person('Cinthia','t2'),person('Michele','t3')],helpers:[person('Tita','h1'),person('Felipe','h2')],history:{},draft:null};
 vm.runInContext('globalThis.legacy=db=normalizeDb(legacyData)',Object.assign(context,{legacyData:data}));
 assert.equal(data.rulesConfig.rules.length,2);
 const a=data.rulesConfig.rules.find(r=>r.type==='same_day');
 assert.equal(a.a,'t1');a.enabled=false;
 context.legacyData=data;vm.runInContext('db=normalizeDb(legacyData)',context);
 assert.equal(data.rulesConfig.rules.length,2);
 assert.equal(data.rulesConfig.rules.find(r=>r.type==='same_day').enabled,false);
});
test('ausência impede participação somente na data informada',()=>{
 setup({teachers,helpers,absences:[{person:'v',date:'2026-12-06',id:'abs1'}]});
 const available=new Map();
 assert.equal(context.api.canTakeAnother('v',available,'2026-12-06'),false);
 assert.equal(context.api.canTakeAnother('v',available,'2026-12-13'),true);
});
test('limites padrão e individuais consideram dias diferentes',()=>{
 setup({teachers,helpers,limits:{teachers:2,helpers:1,people:{v:1}}});
 const usage=new Map([['v',new Set(['2026-12-06'])],['j',new Set(['2026-12-06'])]]);
 assert.equal(context.api.monthlyLimit('v'),1);
 assert.equal(context.api.monthlyLimit('j'),2);
 assert.equal(context.api.canTakeAnother('v',usage,'2026-12-13'),false);
 assert.equal(context.api.canTakeAnother('j',usage,'2026-12-13'),true);
});
test('dois pares de professores são escalados no mesmo domingo cada par',()=>{
 setup({teachers,helpers,rules:[linked('j','c'),linked('m','jh')],sundays:[6,13,20,27]});
 const draft=context.api.buildConfiguredScale();
 const same=(a,b)=>{
  const x=draft.sunday.filter(s=>s.teacher===a).map(s=>s.day),y=draft.sunday.filter(s=>s.teacher===b).map(s=>s.day);
  assert.ok(x.length>0);assert.deepEqual(x,y);
  for(const day of x)assert.notEqual(draft.sunday.find(s=>s.teacher===a&&s.day===day).room,draft.sunday.find(s=>s.teacher===b&&s.day===day).room);
 };
 same('j','c');same('m','jh');
});
test('professor sem alternativas de sala só entra na sala autorizada',()=>{
 setup({teachers,helpers,sundays:[6,13,20,27]});
 const draft=context.api.buildConfiguredScale();
 assert.ok(draft.sunday.filter(s=>s.teacher==='v').every(s=>s.room===1));
});
test('ausência no domingo é respeitada automaticamente pelo gerador',()=>{
 setup({teachers,helpers,sundays:[6,13,20,27],absences:[{id:'a1',person:'j',date:'2026-12-06'}],rules:[linked('j','c')]});
 const draft=context.api.buildConfiguredScale();
 assert.ok(!draft.sunday.some(s=>s.teacher==='j'&&s.day===6));
});
test('limites inviáveis devem produzir erro sem inventar nomes',()=>{
 setup({teachers,helpers,sundays:[6,13,20,27],limits:{teachers:1}});
 assert.equal(context.api.assignSundayWithRules(
  [6,13,20,27].flatMap(day=>[1,2,3].map(room=>({day,room}))),
  context.dbRecord.teachers,new Map(),{},2026,11,true),null);
});
test('terça com acompanhante habilitado exige dupla, e desabilitado não obriga',()=>{
 const a=person('Michele','mi',[1,2,3,4],'DT'),b=person('Tita','ti',[1,2,3,4],'T');
 const rule={id:'r1',type:'helper_pair',a:'mi',b:'ti',enabled:true};
 setup({teachers:[a],helpers:[b],tuesdays:[1],rules:[rule]});
 const draft=context.api.buildConfiguredScale();
 assert.equal(draft.tuesday[0].teacher,'mi');assert.equal(draft.tuesday[0].helper,'ti');
 assert.deepEqual(Array.from(context.api.validateConfiguredRules(draft)),[]);
 rule.enabled=false;
 const newDraft=context.api.buildConfiguredScale();
 assert.equal(newDraft.tuesday[0].helper,null);
});
test('validação identifica ausência em evento especial e limite excedido',()=>{
 setup({teachers,helpers,limits:{teachers:1},absences:[{id:'abs1',person:'v',date:'2026-12-20'}]});
 const draft={key:'2026-12',year:2026,month:11,sunday:[{day:6,room:1,teacher:'v',helper:'h0'}],tuesday:[],sundays:[6],tuesdays:[],events:[{title:'Encontro',date:'2026-12-20',staff:[{teacher:'v',helper:'h1',room:1}]}],programs:[]};
 const errors=Array.from(context.api.validateConfiguredRules(draft));
 assert.ok(errors.some(e=>e.includes('ausente')));
 assert.ok(errors.some(e=>e.includes('excedeu limite')));
});

test('ajudante preferencial participa em uma terça, não em todas',()=>{
 const teacher=person('Michele','mi',[1,2,3,4],'T');
 const felipe=person('Felipe','fe',[1,2,3,4],'T');
 setup({teachers:[teacher],helpers:[felipe],tuesdays:[1,8,15]});
 vm.runInContext("rulesConfig().preferredTuesdayHelper={enabled:true,id:'fe'}",context);
 const draft=context.api.buildConfiguredScale();
 assert.equal(draft.tuesday.filter(s=>s.helper==='fe').length,1);
});
test('ausência em evento de outro mês é detectada',()=>{
 setup({teachers,helpers,absences:[{id:'out',person:'v',date:'2027-01-02'}]});
 const draft={key:'2026-12',year:2026,month:11,sunday:[],tuesday:[],events:[{title:'Retiro',date:'2027-01-02',staff:[{teacher:'v',helper:null,room:1}]}],programs:[]};
 assert.ok(Array.from(context.api.validateConfiguredRules(draft)).some(e=>e.includes('2027-01-02')));
});
test('duas atividades no mesmo dia contam uma participação para limites mensais',()=>{
 setup({teachers,helpers,limits:{teachers:1}});
 const draft={key:'2026-12',year:2026,month:11,sunday:[],tuesday:[],events:[],programs:[{days:[{date:'2026-12-06',slots:[{teachers:['j'],helpers:[]},{teachers:['j'],helpers:[]}]}]}]};
 assert.equal(context.api.collectUsage(draft).get('j').size,1);
 assert.deepEqual(Array.from(context.api.validateConfiguredRules(draft)),[]);
 draft.programs[0].days.push({date:'2026-12-07',slots:[{teachers:['j'],helpers:[]}]});
 assert.ok(Array.from(context.api.validateConfiguredRules(draft)).some(e=>e.includes('excedeu limite')));
});
