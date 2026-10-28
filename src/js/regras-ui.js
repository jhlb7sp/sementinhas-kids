'use strict';
// Interface das regras fica na aba Dados e backup. Não gera nomes fixos no código.
function configPersonOptions(kind,selected=''){
  const persons=kind==='teachers'?db.teachers:kind==='helpers'?db.helpers:[...db.teachers,...db.helpers];
  return '<option value="">— Selecione —</option>'+persons.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>${esc(p.name)}${p.active?'':' (afastado)'}</option>`).join('');
}
function renderRuleUi(){
  const panel=$('rulesPanel');if(!panel)return;
  const rc=rulesConfig();
  const rulesHtml=rc.rules.length?rc.rules.map((r,i)=>{
    const first=findVolunteer(r.a),second=findVolunteer(r.b);
    const description=r.type==='same_day'?'Mesmo domingo (salas diferentes)':'Professor com ajudante na terça';
    return `<div class="rule-line"><label class="checkrow"><input type="checkbox" data-rule-toggle="${esc(r.id)}" ${r.enabled?'checked':''}><span>${esc(first?.name||'Voluntário removido')} + ${esc(second?.name||'Voluntário removido')}</span></label><span class="mini">${description}</span><button type="button" class="danger" data-rule-delete="${esc(r.id)}">Excluir</button></div>`;
  }).join(''):'<p class="muted">Nenhuma regra de vínculo configurada.</p>';
  const people=[...db.teachers,...db.helpers];
  const individual=people.map(p=>{
    const value=rc.limits.people[p.id];
    return `<tr><td>${esc(p.name)}</td><td>${db.teachers.some(t=>t.id===p.id)?'Professor':'Ajudante'}</td><td><input type="number" min="0" max="60" step="1" data-person-cap="${esc(p.id)}" placeholder="Padrão" value="${value===undefined?'':esc(value)}" style="max-width:110px"></td></tr>`;
  }).join('');
  panel.innerHTML=`
    <div class="panel">
      <h2>⚙️ Regras de escala e disponibilidade</h2>
      <p>Ative ou desative regras sem alterar o código. Uma regra obrigatória tem prioridade sobre as preferências de sala. Se não houver combinação possível, a geração informará o conflito.</p>
      <h3>Vínculos entre voluntários</h3>
      <div id="activeRules">${rulesHtml}</div>
      <div class="fields">
        <div><label>Tipo de regra</label><select id="newRuleType"><option value="same_day">Dois professores no mesmo domingo</option><option value="helper_pair">Professor e ajudante juntos na terça</option></select></div>
        <div><label>Professor 1</label><select id="newRuleA">${configPersonOptions('teachers')}</select></div>
        <div><label id="newRuleBLabel">Professor 2</label><select id="newRuleB">${configPersonOptions('teachers')}</select></div>
      </div>
      <div class="actions"><button id="addRule" class="primary" type="button">+ Adicionar vínculo</button></div>
      <h3>Limites mensais de participações</h3>
      <p class="mini">O valor <b>0</b> significa sem limite. Uma pessoa escalada várias vezes no mesmo dia conta uma participação; sábado e domingo contam separadamente. Os limites somam cultos e eventos do mês.</p>
      <div class="fields">
        <div><label>Máximo padrão — professores</label><input id="limitTeachers" type="number" min="0" max="60" value="${rc.limits.teachers}"></div>
        <div><label>Máximo padrão — ajudantes</label><input id="limitHelpers" type="number" min="0" max="60" value="${rc.limits.helpers}"></div>
        <div><label>Ajudante preferencial de terça</label><select id="preferredTuesdayHelper">${configPersonOptions('helpers',rc.preferredTuesdayHelper.id)}</select><label class="checkrow" style="margin-top:6px"><input id="preferTuesdayEnabled" type="checkbox" ${rc.preferredTuesdayHelper.enabled?'checked':''}> Ativar preferência</label></div>
      </div>
      <p class="mini">Para definir um limite individual, informe um número. Deixe vazio para usar o limite padrão da função.</p>
      <div class="tablewrap rules-person-scroll"><table><thead><tr><th>Voluntário</th><th>Função</th><th>Máximo individual por mês</th></tr></thead><tbody>${individual}</tbody></table></div>
      <h3>📅 Ausências em datas específicas</h3>
      <p class="mini">Ausência por dia não afasta o voluntário do mês inteiro. Inclui domingos, terças e eventos especiais.</p>
      <div class="fields">
        <div><label>Voluntário</label><select id="absencePerson">${configPersonOptions('all')}</select></div>
        <div><label>Data em que não pode servir</label><input id="absenceDate" type="date"></div>
        <div><label>Observação (opcional)</label><input id="absenceNote" placeholder="Viagem, compromisso..."></div>
      </div>
      <button id="addAbsence" type="button" class="primary">+ Registrar ausência</button>
      <div class="tablewrap" style="margin-top:12px"><table><thead><tr><th>Data</th><th>Voluntário</th><th>Observação</th><th></th></tr></thead><tbody>${rc.absences.length?rc.absences.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(a=>`<tr><td>${esc(a.date.split('-').reverse().join('/'))}</td><td>${esc(findVolunteer(a.person)?.name||'Voluntário excluído')}</td><td>${esc(a.note||'—')}</td><td><button type="button" class="danger" data-absence-delete="${esc(a.id)}">Remover</button></td></tr>`).join(''):'<tr><td colspan="4" class="muted">Nenhuma ausência cadastrada.</td></tr>'}</tbody></table></div>
      <div id="rulesFeedback" class="info">Alterações salvas automaticamente no armazenamento local.</div>
    </div>`;
}
function ruleMessage(message,type='ok'){
  const el=$('rulesFeedback');if(!el)return;el.className='info '+(type==='error'?'error':type==='warn'?'warn':'');el.textContent=message;
}
function initRuleUi(){
  const root=$('rulesPanel');if(!root)return;
  root.addEventListener('change',e=>{
    const el=e.target,rc=rulesConfig();
    if(el.id==='newRuleType'){
      const nextKind=el.value==='helper_pair'?'helpers':'teachers';
      $('newRuleBLabel').textContent=nextKind==='teachers'?'Professor 2':'Ajudante';
      $('newRuleB').innerHTML=configPersonOptions(nextKind);return;
    }
    if(el.dataset.ruleToggle!==undefined){
      const rule=rc.rules.find(r=>r.id===el.dataset.ruleToggle);if(rule){rule.enabled=el.checked;persist();}return;
    }
    if(el.id==='limitTeachers'||el.id==='limitHelpers'){
      if(el.value===''||!Number.isInteger(+el.value)||+el.value<0||+el.value>60){ruleMessage('Informe um limite entre 0 e 60.','error');return}
      rc.limits[el.id==='limitTeachers'?'teachers':'helpers']=+el.value;persist();ruleMessage('Limites atualizados.');return;
    }
    if(el.dataset.personCap!==undefined){
      if(el.value==='')delete rc.limits.people[el.dataset.personCap];
      else if(!Number.isInteger(+el.value)||+el.value<0||+el.value>60){ruleMessage('Limite individual deve ficar entre 0 e 60.','error');return}
      else rc.limits.people[el.dataset.personCap]=+el.value;
      persist();ruleMessage('Limite individual atualizado.');return;
    }
    if(el.id==='preferTuesdayEnabled'||el.id==='preferredTuesdayHelper'){
      rc.preferredTuesdayHelper={enabled:$('preferTuesdayEnabled').checked,id:$('preferredTuesdayHelper').value};
      persist();ruleMessage('Preferência das terças atualizada.');
    }
  });
  root.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    const rc=rulesConfig();
    if(b.id==='addRule'){
      const type=$('newRuleType').value,a=$('newRuleA').value,b=$('newRuleB').value;
      if(!a||!b||a===b)return ruleMessage('Escolha duas pessoas diferentes.','error');
      if(rc.rules.some(r=>r.type===type&&r.a===a&&r.b===b))return ruleMessage('Essa regra já foi cadastrada; use o botão de ativar/desativar.','warn');
      rc.rules.push({id:'link-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),type,a,b,enabled:true});
      persist();renderRuleUi();ruleMessage('Nova regra cadastrada e ativada.');return;
    }
    if(b.dataset.ruleDelete!==undefined){
      if(!confirm('Excluir essa regra?'))return;
      rc.rules=rc.rules.filter(r=>r.id!==b.dataset.ruleDelete);
      persist();renderRuleUi();ruleMessage('Regra excluída.');return;
    }
    if(b.id==='addAbsence'){
      const personId=$('absencePerson').value,date=$('absenceDate').value,note=$('absenceNote').value.trim();
      if(!personId||!validIsoDate(date))return ruleMessage('Selecione voluntário e uma data válida.','error');
      if(rc.absences.some(a=>a.person===personId&&a.date===date))return ruleMessage('Essa ausência já existe.','warn');
      rc.absences.push({id:'absence-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),person:personId,date,note});
      persist();renderRuleUi();ruleMessage('Ausência salva. A pessoa não será escalada nessa data.');return;
    }
    if(b.dataset.absenceDelete!==undefined){
      rc.absences=rc.absences.filter(a=>a.id!==b.dataset.absenceDelete);
      persist();renderRuleUi();ruleMessage('Ausência removida.');
    }
  });
  renderRuleUi();
}
