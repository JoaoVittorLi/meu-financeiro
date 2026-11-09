(function () {
  'use strict';
  const select = document.getElementById('financeAppearance');
  if (select) {
    select.value = window.MFAppearance.get();
    select.addEventListener('change', () => window.MFAppearance.set(select.value));
  }
  const settingsTheme = document.getElementById('financeSettingsAppearance');
  if(settingsTheme){settingsTheme.value=window.MFAppearance.get();settingsTheme.addEventListener('change',()=>window.MFAppearance.set(settingsTheme.value));}
  let draft = '';
  const labels = { overview:'Visão geral', transactions:'Movimentações', planning:'Planejamento', budgets:'Orçamentos', simulate:'Simular compra', accounts:'Minhas contas', intelligence:'Inteligência',settings:'Configurações' };
  const prompts = {
    overview:['Como interpretar o resultado deste período?','Qual a diferença entre saldo e resultado?'],
    transactions:['Como revisar as categorias dos lançamentos?','Como identificar uma transferência entre minhas contas?'],
    planning:['Como organizar os próximos vencimentos?','Qual a diferença entre receita confirmada e estimada?'],
    budgets:['Como interpretar restante e excesso?','Como escolher limites por categoria?'],
    simulate:['Quais premissas mudam esta simulação?','Como comparar o custo total das parcelas?'],
    accounts:['Como saber se um saldo está atualizado?','O que significa saldo indisponível?'],
    intelligence:['O que está disponível nesta etapa?'],
    settings:['Como escolher o tema deste dispositivo?','Onde criar uma cópia completa dos meus dados?']
  };
  const launcher = document.createElement('button');
  launcher.type = 'button'; launcher.className = 'mf-ai-fab';
  launcher.setAttribute('aria-label','Perguntar à IA sobre esta página');
  launcher.title = 'Perguntar à IA sobre esta página';
  launcher.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg>';
  const dialog = document.createElement('dialog');
  dialog.className = 'finance-context-dialog'; dialog.setAttribute('aria-labelledby','financeContextTitle');
  function close(){ dialog.close(); launcher.focus(); }
  launcher.addEventListener('click', () => {
    const active = document.querySelector('.finance-nav [aria-current="page"]');
    const view = active?.dataset.view || 'overview';
    const title = document.createElement('h2');title.id='financeContextTitle';title.textContent=labels[view]||'Assistente contextual';
    const info = document.createElement('p');info.textContent='Prévias de ajuda. A conversa sobre seus dados ainda não está disponível no PWA. Abrir este painel não envia informações à IA.';
    const scope = document.createElement('p');scope.textContent='Página: '+(labels[view]||view)+'. Contexto financeiro não enviado.';
    const questions = document.createElement('div');questions.className='finance-context-prompts';
    const label=document.createElement('label');label.textContent='Rascunho da pergunta';label.className='mf-ai-context-composer';
    const input=document.createElement('textarea');input.rows=3;input.maxLength=750;input.value=draft;input.setAttribute('aria-label','Rascunho da pergunta');label.append(input);
    const prepare=document.createElement('button');prepare.type='button';prepare.textContent='Preparar na Inteligência';prepare.disabled=!draft.trim();
    input.addEventListener('input',()=>{draft=input.value;prepare.disabled=!draft.trim();});
    for(const question of prompts[view]||prompts.overview){const row=document.createElement('button');row.type='button';row.textContent=question;row.addEventListener('click',()=>{draft=question;input.value=draft;prepare.disabled=false;input.focus();});questions.append(row);}
    prepare.addEventListener('click',()=>{
      let prepared=document.getElementById('financePreparedDraft');
      if(!prepared){prepared=document.createElement('article');prepared.id='financePreparedDraft';prepared.className='finance-card';prepared.setAttribute('role','status');document.getElementById('view-intelligence')?.prepend(prepared);}
      const heading=document.createElement('h2');heading.textContent='Rascunho local · não enviado';
      const origin=document.createElement('p');origin.className='finance-muted';origin.textContent='Preparado em '+(labels[view]||view)+'. Nenhum dado financeiro enviado.';
      const content=document.createElement('p');content.textContent=draft.trim();prepared.replaceChildren(heading,origin,content);
      dialog.close();document.querySelector('.finance-nav [data-view="intelligence"]')?.click();
    });
    const dismiss = document.createElement('button');dismiss.type='button';dismiss.textContent='Fechar assistente';dismiss.addEventListener('click',close);
    const open = document.createElement('button');open.type='button';open.textContent='Abrir Inteligência';open.addEventListener('click',()=>{dialog.close();document.querySelector('.finance-nav [data-view="intelligence"]')?.click();});
    dialog.replaceChildren(title,scope,info,questions,label,prepare,dismiss,open);dialog.showModal();
  });
  dialog.addEventListener('click',event=>{if(event.target===dialog&&event.clientX<dialog.getBoundingClientRect().left)close();});
  dialog.addEventListener('close',()=>launcher.focus());
  document.body.append(launcher,dialog);
})();
