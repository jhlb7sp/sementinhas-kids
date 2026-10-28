const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'src/js/core.js'), 'utf8');
const validation = fs.readFileSync(path.join(root, 'src/js/validacao.js'), 'utf8');
const configuredRules = fs.readFileSync(path.join(root, 'src/js/regras.js'), 'utf8');
const blockingConflicts = fs.readFileSync(path.join(root, 'src/js/conflitos.js'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(core + '\n' + configuredRules + '\n' + blockingConflicts + '\nglobalThis.rules={normalizePerson,canServeRoom,match,matchFlexible,cost};',ctx);
const {normalizePerson,canServeRoom,match,matchFlexible,cost}=ctx.rules;
const mk=(id,p)=>({id,name:id,p,active:true,days:'D'});

test('prioridades em branco permanecem em branco após carregar cadastro',()=>{
  const p=normalizePerson(mk('Vanessa',[1,0,0,0]));
  assert.deepEqual(Array.from(p.p),[1,0,0,0]);
  assert.deepEqual(Array.from(normalizePerson(mk('Maria',[1])).p),[1,0,0,0]);
  assert.deepEqual(Array.from(normalizePerson(mk('Ana',[1,2,3])).p),[1,2,3,0]);
});
test('somente as salas informadas são permitidas',()=>{
  const vanessa=mk('Vanessa',[1,0,0,0]);
  assert.equal(canServeRoom(vanessa,1),true);
  for(const room of [2,3,4])assert.equal(canServeRoom(vanessa,room),false);
  assert.equal(cost(vanessa,2,{}),Infinity);
});
test('gerador respeita restrição mesmo quando pessoa é preferida em outro contexto',()=>{
  const slots=[{day:6,room:1},{day:6,room:2}];
  const people=[mk('Vanessa',[1,0,0,0]),mk('Ana',[2,0,0,0])];
  assert.deepEqual(Array.from(match(slots,people,{}).ids),['Vanessa','Ana']);
});
test('sem voluntário autorizado para a sala, algoritmo não inventa uma escala',()=>{
  const slots=[{day:6,room:2}];
  assert.equal(match(slots,[mk('Vanessa',[1,0,0,0])],{}),null);
  assert.equal(matchFlexible(slots,[mk('Vanessa',[1,0,0,0])],{}),null);
});
test('restrição também se aplica a atribuição forçada',()=>{
  const slots=[{day:6,room:2}];
  assert.equal(match(slots,[mk('Vanessa',[1,0,0,0])],{},{0:'Vanessa'}),null);
});
test('uma pessoa pode repetir em domingos diferentes apenas nas suas salas permitidas',()=>{
  const slots=[{day:6,room:1},{day:6,room:2},{day:13,room:1},{day:13,room:2}];
  const people=[mk('Vanessa',[1,0,0,0]),mk('Ana',[2,0,0,0])];
  assert.deepEqual(Array.from(matchFlexible(slots,people,{}).ids),['Vanessa','Ana','Vanessa','Ana']);
});
test('proibição de todas as salas significa indisponível para domingos',()=>{
  assert.equal(match([{day:6,room:1}],[mk('Sem sala',[0,0,0,0])],{}),null);
});
test('validação avisa sobre escolha manual em sala não autorizada',()=>{
  vm.runInContext(validation+'\nglobalThis.check=validation;',ctx);
  vm.runInContext("db.teachers=[{id:'t_v',name:'Vanessa',p:[1,0,0,0],active:true,days:'D'}];db.helpers=[{id:'h_x',name:'Auxiliar',p:[2,0,0,0],active:true,days:'D'}];",ctx);
  vm.runInContext('function validatePrograms(){return []}',ctx);
  const draft={year:2026,month:11,rooms:3,santa:false,sundays:[6],tuesdays:[],
    sunday:[{day:6,room:2,teacher:'t_v',helper:'h_x'}],tuesday:[],events:[],programs:[]};
  const out=ctx.check(draft);
  assert.ok(Array.from(out.warnings).some(e=>e.includes('Vanessa não pode atuar no Kids 2')));
});
test('escolha manual fora das preferências também gera aviso no evento',()=>{
  const draft={year:2026,month:11,rooms:3,santa:false,sundays:[],tuesdays:[],sunday:[],tuesday:[],programs:[],
    events:[{title:'Teste',date:'2026-12-10',staff:[{teacher:'t_v',helper:'h_x',room:2,lesson:''}]}]};
  assert.ok(Array.from(ctx.check(draft).warnings).some(e=>e.includes('Vanessa não pode atuar no Kids 2')));
});
