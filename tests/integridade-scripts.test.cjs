const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'..');
test('todos os JavaScripts da aplicação têm sintaxe válida',()=>{
  const folder=path.join(base,'src/js');
  for(const file of fs.readdirSync(folder).filter(f=>f.endsWith('.js'))){
    const code=fs.readFileSync(path.join(folder,file),'utf8');
    assert.doesNotThrow(()=>new vm.Script(code,{filename:file}),file);
  }
});
test('todos os scripts estão referenciados e na ordem necessária',()=>{
  const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
  const names=[...html.matchAll(/<script defer src="(src\/js\/[^"]+\.js)"><\/script>/g)].map(m=>m[1]);
  for(const name of names)assert.ok(fs.existsSync(path.join(base,name)),name);
  assert.ok(names.indexOf('src/js/regras.js')>names.indexOf('src/js/core.js'));
  assert.ok(names.indexOf('src/js/regras.js')<names.indexOf('src/js/escala.js'));
  assert.ok(names.indexOf('src/js/regras-ui.js')<names.indexOf('src/js/app.js'));
});
test('a aba de backup contém o editor de regras',()=>{
  const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
  assert.match(html,/id="rulesPanel"/);
  const code=fs.readFileSync(path.join(base,'src/js/regras-ui.js'),'utf8');
  for(const field of ['newRuleType','addRule','addAbsence','limitTeachers','limitHelpers','absencePerson','absenceDate'])
    assert.ok(code.includes(field),field);
});
