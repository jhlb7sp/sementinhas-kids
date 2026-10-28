'use strict';
function build(){
  try{
    const draft=buildConfiguredScale();
    const checked=validation(draft);
    if(checked.errors.length)throw Error(checked.errors.join(' | '));
    db.draft=draft;
    persist();render();
    show('Escala gerada respeitando vínculos, ausências, limites e preferências. Revise antes de aprovar.','ok');
  }catch(error){show('Não foi possível gerar: '+error.message,'error')}
}
