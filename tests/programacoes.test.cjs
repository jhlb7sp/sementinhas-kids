const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync(require('node:path').join(__dirname,'../src/js/programacoes.js'),'utf8');
const ctx=vm.createContext({});vm.runInContext(code,ctx);
function sample(){return [{title:'Encontro com Deus',days:[{date:'2026-09-19',slots:[{start:'08:30',end:'10:30',topic:'Aula',kind:'atividade',teachers:['t1','t2'],helpers:['h1','h2','h3']},{start:'10:30',end:'10:50',topic:'Lanchinho',kind:'intervalo',teachers:[],helpers:[]}]},{date:'2026-09-20',slots:[{start:'09:00',end:'10:30',topic:'Segunda aula',kind:'atividade',teachers:['t1'],helpers:['h2']}]}]}]}
const teachers=[{id:'t1',name:'Professor A',active:true},{id:'t2',name:'Professor B',active:true}];
const helpers=[{id:'h1',name:'Auxiliar A',active:true},{id:'h2',name:'Auxiliar B',active:true},{id:'h3',name:'Auxiliar C',active:true}];
test('dois dias, dois professores e três ajudantes são válidos',()=>{assert.deepEqual(Array.from(ctx.validatePrograms(sample(),teachers,helpers)),[])});
test('horários sobrepostos para o mesmo professor são identificados',()=>{const pr=sample();pr[0].days[0].slots.push({start:'09:00',end:'11:00',topic:'Conflito',kind:'atividade',teachers:['t1'],helpers:[]});assert.match(ctx.validatePrograms(pr,teachers,helpers).join(' '),/sobrepostos/)});
test('participação em várias sessões do mesmo dia conta uma vez',()=>{const pr=sample();pr[0].days[0].slots[1].teachers=['t1'];const p=Array.from(ctx.programParticipation(pr));assert.equal(p.filter(x=>x.id==='t1').length,2)});
test('intervalo e troca têm tipos próprios',()=>{const p=sample();p[0].days[0].slots[1].kind='troca';assert.deepEqual(Array.from(ctx.validatePrograms(p,teachers,helpers)),[])});
test('horário final deve ser posterior ao inicial',()=>{const p=sample();p[0].days[0].slots[0].end='08:00';assert.match(ctx.validatePrograms(p,teachers,helpers).join(' '),/horário inválido/)});
