const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const code=fs.readFileSync(path.join(__dirname,'../src/js/forms-import.js'),'utf8');
function setup(){
  const context=vm.createContext({console,Date,Math});
  vm.runInContext(code,context,{filename:'forms-import.js'});
  vm.runInContext(
    'globalThis.api={formsCsvRows,formsParseResponses,formsMakePlan,formsNormalizeName,formsValidDate,initFormsImport};',
    context
  );
  return context;
}
const header='Carimbo de data/hora,Pergunta 1 — Qual é o seu nome?,Pergunta 2 — Quais dias você NÃO poderá servir?';
const sample=[
  header,
  '28/10/2026 17:54:00,Sâmia,Domingo — 27/12/2026',
  '28/10/2026 17:58:47,Jorge,Domingo — 13/12/2026',
  '28/10/2026 17:59:14,Cinthia,Domingo — 27/12/2026',
  '28/10/2026 18:03:48,Catarina,"Domingo — 06/12/2026, Domingo — 20/12/2026"',
  '28/10/2026 18:08:01,Jorge,Domingo — 20/12/2026'
].join('\r\n');
const people=[
  {id:'t1',name:'Jorge',active:true},
  {id:'t2',name:'Cinthia',active:true},
  {id:'t3',name:'Sâmia',active:true},
  {id:'h1',name:'Catarina',active:true}
];
test('CSV realista do Forms: 5 respostas viram 4 voluntários e 6 ausências',()=>{
  const api=setup().api;
  const parsed=api.formsParseResponses('\uFEFF'+sample);
  assert.equal(parsed.totalResponses,5);
  assert.equal(parsed.groups.length,4);
  assert.equal(parsed.uniqueCount,6);
  assert.equal(parsed.issues.length,0);
  const plan=api.formsMakePlan(parsed,people,[]);
  assert.equal(plan.newItems.length,6);
  assert.equal(plan.missing,0);
  assert.equal(plan.alreadyCount,0);
});
test('Jorge envia duas respostas: ambas datas permanecem na importação',()=>{
  const api=setup().api;
  const parsed=api.formsParseResponses(sample);
  const j=parsed.groups.find(g=>g.name==='Jorge');
  assert.equal(j.responses,2);
  assert.deepEqual(Array.from(j.dates),['2026-12-13','2026-12-20']);
});
test('Catarina marca duas datas na mesma célula entre aspas',()=>{
  const api=setup().api;
  const p=api.formsParseResponses(sample);
  assert.deepEqual(Array.from(p.groups.find(g=>g.name==='Catarina').dates),['2026-12-06','2026-12-20']);
});
test('resposta repetida com a mesma pessoa/data é deduplicada',()=>{
  const api=setup().api;
  const csv=sample+'\r\n28/10/2026 18:09:11,Jorge,Domingo — 20/12/2026';
  const p=api.formsParseResponses(csv);
  assert.equal(p.duplicatesInCsv,1);
  assert.equal(api.formsMakePlan(p,people,[]).newItems.length,6);
});
test('ausências já cadastradas não são modificadas nem geradas duas vezes',()=>{
  const api=setup().api;
  const old=[{id:'manual',person:'t1',date:'2026-12-13',note:'Compromisso pessoal'},
    {id:'old-csv',person:'h1',date:'2026-12-20',note:'Google Forms (CSV)'}];
  const p=api.formsMakePlan(api.formsParseResponses(sample),people,old);
  assert.equal(p.newItems.length,4);
  assert.equal(p.alreadyCount,2);
  assert.deepEqual(old.map(a=>a.note),['Compromisso pessoal','Google Forms (CSV)']);
});
test('nome com acento e caixa diferentes localiza a pessoa corretamente',()=>{
  const api=setup().api;
  const p=api.formsMakePlan(api.formsParseResponses(sample),[
    {id:'a',name:'SÂMIA',active:true},
    ...people.filter(x=>x.name!=='Sâmia')
  ],[]);
  assert.equal(p.missing,0);
  assert.equal(p.groups.find(g=>g.name==='Sâmia').id,'a');
});
test('voluntário desconhecido exige associação explícita',()=>{
  const api=setup().api;
  const csv=header+'\n01/11/2026 12:00:00,Nome novo,Terça — 01/12/2026';
  const parsed=api.formsParseResponses(csv);
  const noMap=api.formsMakePlan(parsed,people,[]);
  assert.equal(noMap.missing,1);
  assert.equal(noMap.newItems.length,0);
  const mapped=api.formsMakePlan(parsed,people,[],{'nome novo':'t1'});
  assert.equal(mapped.missing,0);
  assert.equal(mapped.newItems[0].person,'t1');
});
test('duas grafias vinculadas ao mesmo cadastro não duplicam ausências',()=>{
  const api=setup().api;
  const csv=header+'\n01/11/2026 12:00:00,Jorge,Domingo — 13/12/2026\n'+
    '01/11/2026 12:00:00,Jo Jorge,Domingo — 13/12/2026';
  const parsed=api.formsParseResponses(csv);
  const plan=api.formsMakePlan(parsed,people,[],{'jo jorge':'t1'});
  assert.equal(plan.newItems.length,1);
  assert.equal(plan.alreadyCount,1);
});
test('aceita arquivo com separação por ponto e vírgula',()=>{
  const api=setup().api;
  const csv=header.replaceAll(',',';')+'\n'+
    '01/11/2026 12:00:00;Jorge;"Terça — 01/12/2026, Domingo — 06/12/2026"';
  const parsed=api.formsParseResponses(csv);
  assert.equal(parsed.uniqueCount,2);
  assert.equal(parsed.issues.length,0);
});
test('detecta data impossível em vez de criar uma ausência inválida',()=>{
  const api=setup().api;
  const csv=header+'\n01/11/2026 12:00:00;Jorge;Domingo — 31/11/2026'.replaceAll(';',',');
  const p=api.formsParseResponses(csv);
  assert.equal(p.issues.length,1);
  assert.equal(api.formsMakePlan(p,people,[]).newItems.length,0);
});
test('identifica data em branco e cabeçalhos de outro CSV',()=>{
  const api=setup().api;
  const p=api.formsParseResponses(header+'\n01/11/2026 12:00:00,Jorge,');
  assert.equal(p.issues.length,1);
  assert.throws(()=>api.formsParseResponses('Nome,Email\nAna,ana@x'),/CSV não reconhecido/);
});
test('aspas duplas e quebras de linha entre aspas são aceitas pelo leitor CSV',()=>{
  const api=setup().api;
  const csv=header+'\n"28/10/2026 12:00:00","Jorge","Terça — 01/12/2026, \nDomingo — 06/12/2026"';
  const p=api.formsParseResponses(csv);
  assert.equal(p.uniqueCount,2);
  assert.equal(p.issues.length,0);
});
test('CSV vazio ou malformado não é interpretado silenciosamente',()=>{
  const api=setup().api;
  assert.throws(()=>api.formsCsvRows(''),/vazio/);
  assert.throws(()=>api.formsCsvRows('nome,"data'),/aspas não fechadas/);
});
test('sem respostas o voluntário continua disponível; importação só cria ausências explícitas',()=>{
  const api=setup().api;
  const p=api.formsMakePlan(api.formsParseResponses(sample),
    [...people,{id:'t4',name:'Sem resposta',active:true}],[]);
  assert.equal(p.newItems.filter(i=>i.person==='t4').length,0);
});
test('interface importa somente após confirmação e preserva ausência manual (teste de fluxo)',async()=>{
  const context=setup();
  const elements={};
  const events={};
  for(const id of ['formsImportPanel','formsImportCsv','formsImportStatus','formsImportPreview'])
    elements[id]={innerHTML:'',className:'',textContent:'',value:'',files:[],
      addEventListener(name,cb){events[name]=cb}};
  const state={
    teachers:people.slice(0,3),
    helpers:people.slice(3),
    rulesConfig:{absences:[{id:'manual',person:'t1',date:'2026-12-13',note:'Compromisso pessoal'}]}
  };
  let saved=0,refreshed=0,confirmed=false;
  context.db=state;
  context.$=id=>elements[id];
  context.document={getElementById:id=>elements[id]};
  context.rulesConfig=()=>state.rulesConfig;
  context.persist=()=>{saved++};
  context.renderRuleUi=()=>{refreshed++};
  context.esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  context.confirm=()=>confirmed;
  context.api.initFormsImport();
  elements.formsImportCsv.files=[{size:sample.length,text:async()=>sample}];
  await events.change({target:elements.formsImportCsv});
  assert.match(elements.formsImportPreview.innerHTML,/Confirmar importação de 5 ausência/);
  events.click({target:{id:'formsImportApply'}});
  assert.equal(state.rulesConfig.absences.length,1);
  confirmed=true;
  events.click({target:{id:'formsImportApply'}});
  assert.equal(state.rulesConfig.absences.length,6);
  assert.equal(state.rulesConfig.absences[0].note,'Compromisso pessoal');
  assert.equal(saved,1);
  assert.equal(refreshed,1);
  assert.match(elements.formsImportStatus.textContent,/5 ausência/);
});
