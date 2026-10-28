'use strict';
// Importação local do CSV exportado pelo Google Forms/Planilhas.
// Não consulta serviços externos: funciona inclusive abrindo index.html sem internet.
let formsImportState=null;
function formsNormalizeName(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('pt-BR').trim().replace(/\s+/g,' ');
}
function formsValidDate(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return false;
  const parts=iso.split('-').map(Number);
  const dt=new Date(parts[0],parts[1]-1,parts[2]);
  return dt.getFullYear()===parts[0]&&dt.getMonth()===parts[1]-1&&dt.getDate()===parts[2];
}
function formsDetectDelimiter(text){
  const counts={',':0,';':0};
  let quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted&&text[i+1]==='"'){i++;continue}
      quoted=!quoted;continue;
    }
    if(!quoted&&(c==='\n'||c==='\r'))break;
    if(!quoted&&(c===','||c===';'))counts[c]++;
  }
  return counts[';']>counts[',']?';':',';
}
function formsCsvRows(text){
  if(typeof text!=='string'||!text.trim())throw Error('O arquivo CSV está vazio.');
  if(text.length>2000000)throw Error('CSV muito grande (limite: 2 MB).');
  const source=text.replace(/^\uFEFF/,'');
  const delimiter=formsDetectDelimiter(source);
  const rows=[];
  let row=[],field='',quoted=false;
  function pushRow(){
    row.push(field);
    if(row.some(value=>value.trim()))rows.push(row);
    if(rows.length>5001)throw Error('CSV com mais de 5.000 respostas; divida o arquivo.');
    row=[];field='';
  }
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(c==='"'){
      if(quoted&&source[i+1]==='"'){field+='"';i++;continue}
      if(quoted){quoted=false;continue}
      if(field===''){quoted=true;continue}
      field+='"';continue;
    }
    if(!quoted&&c===delimiter){row.push(field);field='';continue}
    if(!quoted&&(c==='\n'||c==='\r')){
      if(c==='\r'&&source[i+1]==='\n')i++;
      pushRow();continue;
    }
    field+=c;
  }
  if(quoted)throw Error('O CSV contém aspas não fechadas. Exporte novamente pelo Google Planilhas.');
  if(row.length||field)pushRow();
  return rows;
}
function formsParseResponses(text){
  const rows=formsCsvRows(text);
  if(rows.length<2)throw Error('O CSV não contém respostas para importar.');
  const headers=rows[0].map(formsNormalizeName);
  const nameCol=headers.findIndex(s=>s.includes('nome'));
  const datesCol=headers.findIndex(s=>s.includes('quais dias')||
    s.includes('nao podera')||s.includes('nao pode')||
    s.includes('datas de ausencia')||s.includes('dias de ausencia')||
    s.includes('dias indisponiveis'));
  if(nameCol<0||datesCol<0||nameCol===datesCol)
    throw Error('CSV não reconhecido. É necessário ter as colunas de nome e de dias em que NÃO poderá servir.');
  const groups=new Map(),issues=[];
  let dateMentions=0;
  for(let i=1;i<rows.length;i++){
    const row=rows[i],line=i+1;
    const name=String(row[nameCol]||'').trim(),rawDates=String(row[datesCol]||'').trim();
    if(!name){issues.push('Linha '+line+': nome do voluntário em branco.');continue}
    if(!rawDates){issues.push('Linha '+line+': nenhuma data foi informada por '+name+'.');continue}
    const matches=[...rawDates.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)];
    if(!matches.length){issues.push('Linha '+line+': nenhuma data reconhecida para '+name+'.');continue}
    const nameKey=formsNormalizeName(name);
    if(!nameKey){issues.push('Linha '+line+': nome inválido.');continue}
    if(!groups.has(nameKey))groups.set(nameKey,{key:nameKey,name,dates:new Set(),responses:0});
    const group=groups.get(nameKey);
    group.responses++;
    for(const m of matches){
      const iso=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
      if(!formsValidDate(iso)){
        issues.push('Linha '+line+': data inválida ('+m[0]+') para '+name+'.');continue;
      }
      group.dates.add(iso);dateMentions++;
    }
  }
  const ordered=[...groups.values()].map(g=>({key:g.key,name:g.name,dates:[...g.dates].sort(),responses:g.responses}))
    .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const uniqueCount=ordered.reduce((sum,g)=>sum+g.dates.length,0);
  return {totalResponses:rows.length-1,groups:ordered,issues,
    duplicatesInCsv:dateMentions-uniqueCount,uniqueCount};
}
function formsMakePlan(parsed,people,absences,overrides={}){
  const current=new Set((absences||[]).map(a=>a.person+'|'+a.date));
  const emitted=new Set();
  const newItems=[];
  let alreadyCount=0,missing=0;
  const groups=parsed.groups.map(g=>{
    const exact=people.filter(p=>formsNormalizeName(p.name)===g.key);
    const chosen=Object.prototype.hasOwnProperty.call(overrides,g.key)?overrides[g.key]:exact.length===1?exact[0].id:'';
    const selected=people.find(p=>p.id===chosen);
    const id=selected?chosen:'';
    if(!id)missing++;
    let fresh=0,existing=0;
    for(const date of g.dates){
      if(!id)continue;
      const key=id+'|'+date;
      if(current.has(key)||emitted.has(key)){existing++;alreadyCount++;continue}
      emitted.add(key);
      newItems.push({person:id,date,note:'Google Forms (CSV)'});
      fresh++;
    }
    return {...g,id,active:selected?selected.active:null,fresh,existing};
  });
  return {groups,newItems,alreadyCount,missing,issues:parsed.issues};
}
function formsDateLabel(iso){return iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4)}
function renderFormsImport(){
  const panel=$('formsImportPanel');if(!panel)return;
  panel.innerHTML=
    '<div class="panel forms-import-panel">'+
      '<h2>📥 Importar ausências do Google Forms</h2>'+
      '<p>Envie para o Google Forms apenas as datas em que o voluntário <b>não poderá servir</b>. '+
      'Quem não respondeu continua disponível. Esta importação funciona <b>offline</b>.</p>'+
      '<p class="mini">No Google Planilhas: <b>Arquivo → Fazer download → Valores separados por vírgulas (.csv)</b>. '+
      'Aqui, selecione esse arquivo. É possível enviar várias respostas por voluntário e várias datas na mesma resposta.</p>'+
      '<div class="forms-upload-row"><label for="formsImportCsv"><b>Arquivo CSV das respostas</b></label>'+
        '<input type="file" id="formsImportCsv" accept=".csv,text/csv,text/plain">'+
      '</div>'+
      '<div id="formsImportStatus" class="info" aria-live="polite">Selecione o CSV para conferir a prévia antes de importar.</div>'+
      '<div id="formsImportPreview"></div>'+
    '</div>';
}
function renderFormsImportPreview(){
  const target=$('formsImportPreview');
  if(!target)return;
  if(!formsImportState){target.innerHTML='';return}
  const people=[...db.teachers,...db.helpers];
  const plan=formsMakePlan(formsImportState.parsed,people,rulesConfig().absences,formsImportState.overrides);
  const currentData=formsImportState.parsed;
  const selectedCount=plan.groups.reduce((n,g)=>n+g.dates.length,0);
  const opts=[...people].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(p=>
    '<option value="'+esc(p.id)+'">'+esc(p.name)+' — '+(db.teachers.some(t=>t.id===p.id)?'Professor':'Ajudante')+
    (p.active?'':' (afastado)')+'</option>').join('');
  let output=
    '<h3>Prévia da importação</h3>'+
    '<div class="forms-import-summary">'+
      '<div><strong>'+currentData.totalResponses+'</strong><span>Respostas</span></div>'+
      '<div><strong>'+plan.groups.length+'</strong><span>Voluntários</span></div>'+
      '<div><strong>'+selectedCount+'</strong><span>Ausências únicas no CSV</span></div>'+
      '<div><strong>'+plan.newItems.length+'</strong><span>Novas ausências</span></div>'+
      '<div><strong>'+plan.alreadyCount+'</strong><span>Já cadastradas</span></div>'+
    '</div>';
  if(currentData.duplicatesInCsv)
    output+='<p class="mini">♻️ '+currentData.duplicatesInCsv+' data(s) repetida(s) no CSV foram agrupadas automaticamente.</p>';
  if(plan.issues.length)
    output+='<div class="info error"><b>Corrija o CSV antes de importar:</b><ul>'+
      plan.issues.slice(0,12).map(s=>'<li>'+esc(s)+'</li>').join('')+
      (plan.issues.length>12?'<li>… e mais '+(plan.issues.length-12)+' linha(s).</li>':'')+
      '</ul></div>';
  if(!people.length)
    output+='<div class="info warn">Nenhum voluntário cadastrado neste navegador. Cadastre a equipe ou restaure o backup JSON primeiro.</div>';
  output+='<div class="tablewrap"><table class="forms-import-table"><thead><tr>'+
    '<th>Nome no formulário</th><th>Correspondência no cadastro</th><th>Datas informadas</th><th>Novas</th>'+
    '</tr></thead><tbody>';
  for(const [i,g] of plan.groups.entries()){
    output+='<tr><td><strong>'+esc(g.name)+'</strong>'+
      (g.responses>1?'<br><small>'+g.responses+' respostas reunidas</small>':'')+'</td>'+
      '<td><select data-forms-map="'+i+'" aria-label="Relacionar '+esc(g.name)+' ao cadastro">'+
      '<option value="">— Selecione o voluntário —</option>'+
      opts.replace(/<option value="([^"]+)"/g,(all,id)=>'<option value="'+id+'"'+(id===g.id?' selected':'') )+
      '</select>'+
      (!g.id?'<small class="forms-unmatched">⚠️ Nome ainda não vinculado ao cadastro</small>':
        !g.active?'<small class="forms-unmatched">Voluntário afastado</small>':
        '<small class="forms-matched">✓ Cadastro identificado</small>')+'</td>'+
      '<td>'+g.dates.map(d=>'<span class="forms-date">'+esc(formsDateLabel(d))+'</span>').join(' ')+'</td>'+
      '<td>'+(g.id?g.fresh+' nova(s)'+(g.existing?' · '+g.existing+' já cadastrada(s)':''):'—')+'</td></tr>';
  }
  output+='</tbody></table></div>';
  if(plan.missing)
    output+='<div class="info warn">Selecione o cadastro correto para '+plan.missing+' voluntário(s) antes de importar. Não é feita associação aproximada de nomes.</div>';
  if(!plan.issues.length&&!plan.missing&&!plan.newItems.length)
    output+='<div class="info">Todas as ausências deste CSV já estão cadastradas. Nenhum registro será duplicado.</div>';
  output+='<p class="mini">A importação <b>adiciona</b> novas datas, sem apagar ausências manuais ou alterar as já cadastradas. '+
    'Se uma resposta for corrigida depois, remova manualmente a data antiga na lista de ausências.</p>'+
    '<button type="button" id="formsImportApply" class="primary"'+
    (plan.issues.length||plan.missing||!plan.newItems.length?' disabled':'')+
    '>✓ Confirmar importação de '+plan.newItems.length+' ausência(s)</button>';
  target.innerHTML=output;
}
function formsImportMessage(msg,type='ok'){
  const el=$('formsImportStatus');if(!el)return;
  el.className='info '+(type==='error'?'error':type==='warn'?'warn':'');
  el.textContent=msg;
}
function initFormsImport(){
  const panel=$('formsImportPanel');if(!panel)return;
  renderFormsImport();
  panel.addEventListener('change',async event=>{
    const input=event.target;
    if(input.id==='formsImportCsv'){
      const file=input.files&&input.files[0];
      formsImportState=null;renderFormsImportPreview();
      if(!file)return;
      if(file.size>2000000){formsImportMessage('Arquivo maior que 2 MB.','error');return}
      try{
        const parsed=formsParseResponses(await file.text());
        formsImportState={parsed,overrides:{}};
        formsImportMessage('CSV lido. Confira a prévia e os nomes antes de confirmar.');
        renderFormsImportPreview();
      }catch(err){formsImportMessage('Não foi possível ler o CSV: '+err.message,'error')}
      return;
    }
    if(input.dataset&&input.dataset.formsMap!==undefined&&formsImportState){
      const group=formsImportState.parsed.groups[Number(input.dataset.formsMap)];
      if(!group)return;
      formsImportState.overrides[group.key]=input.value;
      renderFormsImportPreview();
    }
  });
  panel.addEventListener('click',event=>{
    if(event.target.id!=='formsImportApply'||!formsImportState)return;
    const plan=formsMakePlan(formsImportState.parsed,[...db.teachers,...db.helpers],
      rulesConfig().absences,formsImportState.overrides);
    if(plan.issues.length||plan.missing||!plan.newItems.length){
      formsImportMessage('Existem problemas na prévia ou nenhuma ausência nova para importar.','warn');
      return;
    }
    if(!confirm('Importar '+plan.newItems.length+' nova(s) ausência(s)? As ausências já existentes serão preservadas.'))return;
    const rc=rulesConfig();
    let added=0;
    for(const entry of plan.newItems){
      if(rc.absences.some(a=>a.person===entry.person&&a.date===entry.date))continue;
      rc.absences.push({...entry,id:'forms-'+Date.now()+'-'+Math.random().toString(36).slice(2,9)});
      added++;
    }
    persist();renderRuleUi();
    formsImportState=null;
    $('formsImportCsv').value='';
    renderFormsImportPreview();
    formsImportMessage('✓ '+added+' ausência(s) importada(s) com sucesso! '+
      'As datas já cadastradas foram preservadas. Confira a lista acima.');
  });
}
