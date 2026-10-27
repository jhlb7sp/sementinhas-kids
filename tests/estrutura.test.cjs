const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = path.resolve(__dirname, '..');
test('arquivos principais existem', () => {
  for (const name of ['index.html','src/css/style.css','src/js/core.js',
    'src/js/escala.js','src/js/interface.js','src/js/validacao.js',
    'src/js/equipe.js','src/js/exportacao.js','src/js/app.js']) {
    assert.ok(fs.existsSync(path.join(base,name)), name);
  }
});
test('não duplica botões exportadores', () => {
  const html = fs.readFileSync(path.join(base,'index.html'),'utf8');
  assert.equal((html.match(/id="print"/g)||[]).length, 1);
  assert.equal((html.match(/id="csv"/g)||[]).length, 1);
});
test('formulário de eventos contém campos de sala e lição', () => {
  const content = fs.readFileSync(path.join(base,'src/js/interface.js'),'utf8');
  assert.match(content,/data-role="room"/);
  assert.match(content,/data-role="lesson"/);
});
