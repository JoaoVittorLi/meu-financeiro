/* Meu Financeiro — Entrega IA-1, I1-A.2 & I1-B: Central de conversação financeira Premium, histórico persistente compartilhado e prévia sem gravação.
 * Este arquivo roda no mesmo bundle de src/app.ts (TypeScript module:none). */
type IntelligenceActionCandidate = {
  candidateKey:string;
  origin:'bank'|'manual';
  txId:string;
  accountId?:string;
  accountName:string;
  description:string;
  rawDescription:string;
  date:string;
  amountCents:number;
  txKind:'expense'|'income';
  currentCategory:string;
};
type IntelligenceActionProposal = {
  id:string;
  kind:'categorize';
  origin:'bank'|'manual';
  txId:string;
  accountId?:string;
  accountName?:string;
  description:string;
  rawDescription?:string;
  date:string;
  amountCents:number;
  txKind:'expense'|'income';
  currentCategory:string;
  proposedCategory:string;
  status:'ambiguous'|'pending'|'preview_confirmed'|'denied'|'stale';
  candidates?:IntelligenceActionCandidate[];
  candidatesCount?:number;
  visibleLimit?:number;
  resultMessage?:string;
};
type IntelligenceStructuredCard = {
  title:string;
  subtitle?:string;
  metrics?:{label:string;value:string;tone?:'neutral'|'positive'|'warning'}[];
  rows?:{col1:string;col2:string;col3?:string}[];
  headers?:[string,string,string?];
  footnote?:string;
};
type IntelligenceChatMessage = {
  id:string;
  role:'user'|'assistant'|'system';
  text:string;
  createdAt:string;
  createdAtIso?:string;
  scopeLabel:string;
  periodLabel:string;
  status:'sent'|'streaming'|'done'|'unavailable'|'unimplemented'|'error';
  details?:string;
  proposal?:IntelligenceActionProposal|null;
  structuredCard?:IntelligenceStructuredCard|null;
};
type IntelligenceThread = {
  id:string;
  title:string;
  createdAtIso:string;
  updatedAtIso:string;
  updatedTime:string;
  scopeLabel:string;
  periodLabel:string;
  mode:'real'|'demo';
  messages:IntelligenceChatMessage[];
};

const INTELLIGENCE_CONTEXTS:{[name:string]:{label:string;description:string;questions:string[]}}={
  overview:{label:'Visão geral',description:'Indicadores e evolução do período escolhido.',questions:['Explique as principais mudanças da minha visão geral.','Quais informações faltam para avaliar minha saúde financeira?']},
  transactions:{label:'Movimentações',description:'Categorias, recorrências e revisão de lançamentos.',questions:['Analise possíveis padrões nas minhas movimentações.','Categorize minha compra do mercado como Alimentação.']},
  planning:{label:'Planejamento',description:'Contas futuras e projeção diária do fluxo de caixa.',questions:['Quais compromissos podem comprometer meu saldo futuro?','Como planejar uma reserva sem depender de renda incerta?']},
  budgets:{label:'Orçamentos',description:'Limites, histórico de categorias e oportunidades de ajuste.',questions:['Como definir limites mais inteligentes por categoria?','Quais categorias devo analisar antes de reduzir gastos?']},
  assistant:{label:'Simular compra',description:'Impacto de compras e parcelamentos no planejamento.',questions:['Como avaliar se uma nova compra cabe no meu orçamento?','O que devo comparar antes de parcelar uma compra?']},
  banks:{label:'Minhas contas',description:'Saldos bancários e qualidade das informações sincronizadas.',questions:['Quais dados preciso conferir antes de tomar uma decisão?','Como identificar divergências entre saldo e movimentações?']},
  settings:{label:'Configurações',description:'Aparência, preferências e recuperação de dados.',questions:['O que muda ao escolher esta preferência?','Qual a diferença entre exportação manual e cópia completa?']},
  intelligence:{label:'Inteligência',description:'Rascunhos locais e testes autorizados de IA.',questions:['O que está disponível nesta etapa?','Que contexto deve ser revisado antes de uma análise?']}
};
function intelligenceContextFor(page:string){return INTELLIGENCE_CONTEXTS[page]||INTELLIGENCE_CONTEXTS.overview;}
function intelligencePageScope(app:any,page:string=app.state.page){
 const s=app.state,info=intelligenceContextFor(page);let period='Sem filtro de período';const filters:string[]=[];
 if(page==='overview'||page==='transactions')period=page==='transactions'&&s.txReviewOnly?'Todos os períodos':spanLabel(s.overviewPeriod,dateSpan(s.overviewPeriod,s.customStart,s.customEnd));
 if(page==='planning')period=prettyMonth(s.planMonth);
 if(page==='budgets')period=prettyMonth(s.month);
 if(page==='assistant')period='Cenário atual';
 if(page==='banks')period='Referências das instituições';
 if(page==='transactions'){
  if(s.query?.trim())filters.push('Busca: '+s.query.trim().slice(0,100));
  if(s.bankFilter)filters.push('Conta filtrada');
  if(s.txReviewOnly)filters.push('A revisar');
  if(s.txOrganize)filters.push('Categorias e regras');
  if(s.txSelected?.length)filters.push(s.txSelected.length+' selecionada(s)');
  if(s.detail)filters.push('Movimentação aberta');
 }
 if(page==='planning'&&s.planTerm?.trim())filters.push('Busca: '+s.planTerm.trim().slice(0,100));
 return {page,label:info.label,period,filters,mode:s.mode==='demo'?'Demonstração':'Pessoal'};
}
function intelligenceNextTab(current:string,key:string){
 const ids=['today','chat','actions'],index=Math.max(0,ids.indexOf(current));
 if(key==='Home')return ids[0];if(key==='End')return ids[2];
 if(key==='ArrowRight')return ids[(index+1)%ids.length];
 if(key==='ArrowLeft')return ids[(index+ids.length-1)%ids.length];return null;
}
function intelligenceHistoryList(app:any):IntelligenceChatMessage[]{
 if(typeof intelligenceEnsureHydrated==='function')intelligenceEnsureHydrated(app);
 return Array.isArray(app.state.intelligenceMessages)?app.state.intelligenceMessages:[];
}
function intelligenceOpenFullChat(app:any){
 if(typeof intelligenceEnsureHydrated==='function')intelligenceEnsureHydrated(app);
 const scope=app.state.intelligencePanelOpen&&app.state.intelligenceContextSnapshot?app.state.intelligenceContextSnapshot:intelligencePageScope(app);
 app.setState({page:'intelligence',intelligenceTab:'chat',intelligenceDraftScope:scope,intelligencePanelOpen:false,detail:null,planSelected:null});
}
function intelligencePrepare(app:any,question:string){
  if(typeof intelligenceEnsureHydrated==='function')intelligenceEnsureHydrated(app);
  app.setState({page:'intelligence',intelligenceTab:'chat',intelligenceDraft:question,intelligenceDraftScope:app.state.intelligencePanelOpen&&app.state.intelligenceContextSnapshot?app.state.intelligenceContextSnapshot:intelligencePageScope(app),intelligencePanelOpen:false,detail:null,planSelected:null});
}
function renderIntelligenceStructuredCard(card:IntelligenceStructuredCard){
  return h('div',{className:'mf-ai-structured-card',role:'region','aria-label':card.title},
    h('div',{className:'mf-ai-structured-head'},
      h('strong',{},card.title),
      card.subtitle?h('small',{},card.subtitle):null),
    Array.isArray(card.metrics)&&card.metrics.length?h('div',{className:'mf-ai-structured-metrics'},
      ...card.metrics.map((m,idx)=>h('div',{key:idx,className:'mf-ai-structured-metric is-'+(m.tone||'neutral')},
        h('small',{},m.label),
        h('strong',{},m.value)))):null,
    Array.isArray(card.rows)&&card.rows.length?h('div',{className:'mf-ai-table-wrap'},
      h('table',{},
        card.headers?h('thead',{},h('tr',{},
          h('th',{},card.headers[0]),
          h('th',{},card.headers[1]),
          card.headers[2]?h('th',{},card.headers[2]):null)):null,
        h('tbody',{},
          ...card.rows.map((r,idx)=>h('tr',{key:idx},
            h('td',{},r.col1),
            h('td',{},r.col2),
            r.col3!==undefined?h('td',{},r.col3):null))))):null,
    card.footnote?h('small',{className:'mf-ai-structured-foot'},card.footnote):null);
}
function renderIntelligenceActionProposalCard(app:any,proposal:IntelligenceActionProposal){
  const moneyFmt=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((cents||0)/100);
  const isAmbiguous=proposal.status==='ambiguous';
  const isPending=proposal.status==='pending';
  const allCandidates=Array.isArray(proposal.candidates)?proposal.candidates:[];
  const totalCount=proposal.candidatesCount||allCandidates.length;
  const visibleLimit=typeof proposal.visibleLimit==='number'&&proposal.visibleLimit>0?proposal.visibleLimit:8;
  const visibleCandidates=allCandidates.slice(0,visibleLimit);
  const hiddenCount=Math.max(0,allCandidates.length-visibleCandidates.length);
  const statusLabel=proposal.status==='ambiguous'?'Seleção explícita necessária ('+totalCount+' opções)':
    proposal.status==='pending'?'Prévia sem gravação · I2-B pendente':
    proposal.status==='preview_confirmed'?'Prévia validada · sem gravação (I2-B)':
    proposal.status==='stale'?'Estado desatualizado · recusada':'Proposta negada';
  return h('div',{className:'mf-ai-proposal-card status-'+proposal.status,role:'region','aria-label':'Prévia de categorização supervisionada'},
    h('div',{className:'mf-ai-proposal-head'},
      h('span',{className:'micro-label'},isAmbiguous?'DESAMBIGUAÇÃO DE LANÇAMENTOS':proposal.origin==='bank'?'PRÉVIA · MOVIMENTAÇÃO BANCÁRIA':'PRÉVIA · LANÇAMENTO MANUAL'),
      h('span',{className:'mf-ai-status'},statusLabel)),
    isAmbiguous&&allCandidates.length?h('div',{className:'mf-ai-candidate-list',role:'group','aria-label':'Escolha o lançamento exato'},
      h('p',{className:'mf-ai-proposal-notice'},'Múltiplos lançamentos correspondem ao pedido. Nunca escolhemos um registro arbitrariamente; selecione abaixo qual deseja preparar para “'+proposal.proposedCategory+'”:'),
      allCandidates.length>8?h('p',{className:'mf-ai-refine-hint'},'Para refinar a busca entre os '+allCandidates.length+' lançamentos, informe data (ex.: ontem ou DD/MM/AAAA), valor exato (ex.: R$ 50,00) ou origem (banco / manual).'):null,
      ...visibleCandidates.map((c:IntelligenceActionCandidate)=>h('div',{key:c.candidateKey,className:'mf-ai-candidate-row'},
        h('div',{className:'mf-ai-candidate-copy'},
          h('strong',{},c.description),
          h('small',{},(c.origin==='bank'?'Banco ('+c.accountName+')':'Manual')+' · '+c.date+' · '+moneyFmt(c.amountCents)+' · Atual: '+c.currentCategory)),
        h('button',{type:'button',className:'ghost-button',onClick:()=>intelligenceSelectActionCandidate(app,proposal.id,c.candidateKey)},'Selecionar lançamento'))),
      hiddenCount>0?h('button',{type:'button',className:'ghost-button mf-ai-expand-candidates',onClick:()=>intelligenceExpandProposalCandidates(app,proposal.id)},
        'Mostrar mais '+hiddenCount+' lançamento(s) (ver todos os '+allCandidates.length+')'):null,
      h('div',{className:'mf-ai-proposal-actions'},
        h('button',{type:'button',className:'ghost-button',onClick:()=>intelligenceResolveActionProposal(app,proposal.id,'deny')},'Cancelar proposta'))):null,
    !isAmbiguous?h('div',{className:'mf-ai-proposal-tx'},
      h('strong',{},proposal.description),
      h('small',{},(proposal.origin==='bank'?'Banco ('+(proposal.accountName||proposal.accountId||'Conta')+')':'Manual')+' · '+proposal.date+' · '+moneyFmt(proposal.amountCents))):null,
    !isAmbiguous?h('div',{className:'mf-ai-proposal-diff'},
      h('div',{className:'mf-ai-diff-col'},h('small',{},'Categoria atual'),h('b',{},proposal.currentCategory||'Sem categoria')),
      h('span',{className:'mf-ai-diff-arrow','aria-hidden':'true'},'→'),
      h('div',{className:'mf-ai-diff-col is-proposed'},h('small',{},'Categoria proposta'),h('b',{},proposal.proposedCategory))):null,
    isPending?h('p',{className:'mf-ai-proposal-notice'},'Prévia sem gravação: confirmar valida identidade, origem, data, valor e categoria, mas não persiste alterações no SQLite até a entrega I2-B.'):null,
    isPending?h('div',{className:'mf-ai-proposal-actions'},
      h('button',{type:'button',className:'primary-button',onClick:()=>intelligenceResolveActionProposal(app,proposal.id,'approve')},'Confirmar prévia (sem gravar)'),
      h('button',{type:'button',className:'ghost-button',onClick:()=>intelligenceResolveActionProposal(app,proposal.id,'deny')},'Negar alteração')):null,
    proposal.resultMessage?h('p',{className:'mf-ai-proposal-result',role:'status'},proposal.resultMessage):null);
}
function renderIntelligenceMessageItem(app:any,msg:IntelligenceChatMessage){
  const isUser=msg.role==='user';
  const badge=msg.status==='unavailable'?h('span',{className:'mf-ai-msg-badge is-warn'},'Conta desconectada'):
    msg.status==='unimplemented'?h('span',{className:'mf-ai-msg-badge is-info'},'Aguarda I2-A'):
    msg.status==='error'?h('span',{className:'mf-ai-msg-badge is-error'},'Serviço indisponível'):null;
  return h('article',{key:msg.id,className:'mf-ai-msg '+(isUser?'is-user':'is-assistant')+' is-'+msg.status},
    h('header',{className:'mf-ai-msg-meta'},
      h('strong',{},isUser?'Você':'Assistente MF'),
      h('span',{},msg.scopeLabel+' · '+msg.createdAt),
      badge),
    h('div',{className:'mf-ai-msg-body mf-ai-markdown'},...aiMarkdownNodes(msg.text)),
    msg.structuredCard?renderIntelligenceStructuredCard(msg.structuredCard):null,
    msg.proposal?renderIntelligenceActionProposalCard(app,msg.proposal):null,
    msg.details?h('details',{className:'mf-ai-msg-details'},
      h('summary',{},'Ver contexto e diagnóstico'),
      h('p',{},msg.details)):null);
}
function intelligenceExampleCard(app:any,id:string,title:string,description:string,icon:string,question:string){
  return h('div',{className:'mf-ai-example-card',key:id},
    h('span',{className:'mf-ai-example-icon'},h(Icon,{name:icon,size:20})),
    h('div',{className:'mf-ai-example-copy'},h('strong',{},title),h('p',{},description),
      h('button',{type:'button',className:'mf-ai-link',onClick:()=>intelligencePrepare(app,question)},'Preparar análise',h(Icon,{name:'arrow',size:15}))));
}
function renderIntelligenceHistorySidebar(app:any){
  const s=app.state;
  const query=String(s.intelligenceHistoryQuery||'');
  const groups=typeof intelligenceGroupThreadsByDate==='function'?intelligenceGroupThreadsByDate(app,query):[];
  const activeId=s.intelligenceActiveThreadId||null;
  const totalThreads=Array.isArray(s.intelligenceThreads)?s.intelligenceThreads.length:0;
  return h('aside',{className:'mf-ai-history-sidebar','aria-label':'Histórico de conversas'},
    h('div',{className:'mf-ai-history-top'},
      h('div',{className:'mf-ai-history-title-row'},
        h('strong',{},'Conversas'),
        h('span',{className:'mf-ai-thread-count'},String(totalThreads))),
      h('button',{type:'button',className:'primary-button mf-ai-new-thread-btn',onClick:()=>intelligenceCreateThread(app)},
        h(Icon,{name:'plus',size:14}),'Nova conversa')),
    h('div',{className:'mf-ai-history-search'},
      h('input',{type:'search',value:query,maxLength:120,placeholder:'Buscar no histórico…','aria-label':'Buscar conversas no histórico',onChange:(e:any)=>app.setState({intelligenceHistoryQuery:e.target.value})})),
    s.intelligenceStorageError?h('p',{className:'mf-ai-error mf-ai-storage-error',role:'alert'},s.intelligenceStorageError):null,
    groups.length===0?h('div',{className:'mf-ai-history-empty'},
      h('p',{},query.trim()?'Nenhuma conversa encontrada para “'+query.trim()+'”.':'Nenhuma conversa salva neste perfil ('+(s.mode==='demo'?'Demonstração':'Pessoal')+').'),
      h('small',{},'O histórico deste perfil é local e não usa o cofre criptografado. Não inclua senhas nem tokens.')):
    h('div',{className:'mf-ai-history-groups',role:'list'},
      ...groups.map((grp:any)=>h('div',{key:grp.label,className:'mf-ai-history-group'},
        h('span',{className:'mf-ai-history-date-label'},grp.label),
        ...grp.items.map((th:IntelligenceThread)=>h('div',{key:th.id,role:'listitem',className:'mf-ai-thread-item '+(th.id===activeId?'is-active':'')},
          h('button',{type:'button',className:'mf-ai-thread-select','aria-current':th.id===activeId?'true':'false',onClick:()=>intelligenceSelectThread(app,th.id)},
            h('strong',{},th.title),
            h('small',{},th.scopeLabel+' · '+th.updatedTime+' · '+th.messages.length+' msg')),
          h('button',{type:'button',className:'mf-ai-thread-delete','aria-label':'Excluir conversa '+th.title,title:'Excluir conversa',onClick:()=>intelligenceDeleteThread(app,th.id)},'×')))))),
    totalThreads>0?h('div',{className:'mf-ai-history-foot'},
      h('button',{type:'button',className:'ghost-button full',onClick:()=>intelligenceClearHistory(app)},'Limpar histórico do perfil')):null);
}
function renderIntelligenceView(app:any){
  if(app.state.workIntelligenceDemo?.enabled&&typeof renderWorkIntelligenceDemo==='function')return renderWorkIntelligenceDemo(app);
  if(typeof intelligenceEnsureHydrated==='function')intelligenceEnsureHydrated(app);
  const s=app.state,tab=s.intelligenceTab||'today';
  const tabs=[{id:'today',label:'Hoje'},{id:'chat',label:'Conversar'},{id:'actions',label:'Plano de ação'}];
  const messages=intelligenceHistoryList(app);
  const allProposals=typeof intelligenceAllProposals==='function'?intelligenceAllProposals(app):(messages.map(m=>m.proposal).filter(Boolean) as IntelligenceActionProposal[]);
  const convState=typeof intelligenceConversationState==='function'?intelligenceConversationState(app):{kind:'oauth_disconnected',pill:'Conta desconectada · modo local',badge:'Conta desconectada',css:'is-offline'};
  const activeScope=s.intelligenceDraftScope||intelligencePageScope(app,s.intelligenceContext||s.page);
  let section:any=null;
  if(tab==='today')section=h('div',{className:'mf-ai-today'},
    h('button',{type:'button',className:'ghost-button',onClick:()=>workDemoLoad(app)},'Explorar nova Inteligência · dados fictícios'),
    h('div',{className:'mf-ai-welcome'},
      h('span',{className:'micro-label'},'PAINEL CONCEITUAL · DADOS FICTÍCIOS'),
      h('h2',{},'Três assuntos para explorar.'),
      h('p',{},'Exemplos fictícios. Eles não representam alertas reais das suas contas.')),
    h('div',{className:'mf-ai-card-grid'},
      intelligenceExampleCard(app,'future','Compromissos à frente','Analise pagamentos futuros antes de separar dinheiro para investir.','calendar','Avalie meus compromissos futuros antes de eu reservar dinheiro para investimentos.'),
      intelligenceExampleCard(app,'budgets','Limites mais inteligentes','Compare o comportamento das categorias antes de alterar seu orçamento.','pie','Ajude-me a elaborar limites inteligentes para o próximo mês.'),
      intelligenceExampleCard(app,'reserve','Reserva e liquidez','Entenda a diferença entre saldo disponível e dinheiro realmente livre.','shield','Como calcular o dinheiro realmente livre para poupar ou investir?')),
    h('div',{className:'mf-ai-explainer'},h(Icon,{name:'shield',size:19}),
      h('div',{},h('strong',{},'Insights econômicos por padrão'),
        h('p',{},'Na integração definitiva, alertas matemáticos virão do motor financeiro; o GPT-6.1 Sol será acionado apenas quando você solicitar explicação ou análise.'))));
  if(tab==='today'&&s.localFinancialAccess?.token&&typeof renderLocalFinancialRadar==='function')section=renderLocalFinancialRadar(app);
  if(tab==='chat')section=h('div',{className:'mf-ai-workbench'},
    renderIntelligenceHistorySidebar(app),
    h('div',{className:'mf-ai-chat-main mf-ai-workbench-main'},
      h('div',{className:'mf-ai-workbench-header'},
        h('div',{className:'mf-ai-chat-hero'},
          h('span',{className:'mf-ai-orb'},h(Icon,{name:'spark',size:25})),
          h('h2',{},'Central de conversação financeira'),
          h('p',{},'Histórico compartilhado com o chat lateral, salvo localmente quando disponível. Não cole credenciais.')),
        h('div',{className:'mf-ai-workbench-badges'},
          h('span',{className:'mf-ai-conn-pill '+convState.css},convState.pill),
          h('span',{className:'mf-ai-scope-badge'},'Contexto: '+activeScope.label+' · '+activeScope.period))),
      s.intelligenceDraftScope?h('div',{className:'mf-ai-context-meta'},h('span',{},'Rascunho de '+s.intelligenceDraftScope.label),h('span',{},s.intelligenceDraftScope.period)):null,
      s.intelligencePreparedQuestion?h('div',{className:'mf-ai-prepared',role:'status'},
        h('span',{className:'micro-label'},'PERGUNTA PREPARADA · NÃO ENVIADA'),
        h('p',{},s.intelligencePreparedQuestion),
        h('small',{},'Este rascunho não é enviado ao Sol. Use os casos fictícios autorizados abaixo; nenhuma chamada ocorreu aqui.')):null,
      messages.length===0?h('div',{className:'mf-ai-empty-thread'},
        h('h3',{},'Comece uma análise ou prepare uma categorização supervisionada'),
        h('p',{},'Suas conversas ficam organizadas por data na coluna à esquerda e continuam disponíveis ao alternar para o chat lateral em qualquer uma das oito áreas.'),
        h('div',{className:'mf-ai-starter-grid'},
          ['Categorize minha compra do mercado como Alimentação.','Mostre um resumo estruturado das minhas movimentações carregadas.','Como construir uma reserva de emergência?','Quando faz sentido antecipar uma dívida?'].map((q:string,i:number)=>
            h('button',{type:'button',className:'mf-ai-context-prompt',key:i,onClick:()=>intelligenceSubmitQuestion(app,q)},
              h('span',{},q),h(Icon,{name:'arrow',size:14}))))):
      h('div',{className:'mf-ai-thread',role:'log','aria-live':'polite'},
        ...messages.map(m=>renderIntelligenceMessageItem(app,m)),
        (s.aiBusy||s.localFinancialBusy)?h('div',{className:'mf-ai-msg is-assistant is-streaming',role:'status'},
          h('strong',{},'Assistente MF'),
          h('p',{},'Processando solicitação…')):null),
      s.aiError?h('p',{className:'mf-ai-error',role:'alert'},s.aiError):null,
      h('div',{className:'mf-ai-composer'},
        h('label',{className:'mf-ai-composer-label',htmlFor:'mf-ai-draft'},'Sua pergunta ou comando supervisionado'),
        h('textarea',{id:'mf-ai-draft',value:s.intelligenceDraft||'',rows:3,maxLength:750,placeholder:'Ex.: Categorize minha compra do mercado de ontem como Alimentação…',onChange:(e:any)=>app.setState({intelligenceDraft:e.target.value}),onKeyDown:(e:any)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if((s.intelligenceDraft||'').trim())void intelligenceSubmitQuestion(app,s.intelligenceDraft);}}}),
        h('span',{className:'mf-ai-compose-actions'},
          h('small',{},convState.pill+(s.localFinancialAccess?.token?' · respostas na memória da sessão':' · armazenamento local isolado ('+(s.mode==='demo'?'Demonstração':'Pessoal')+')')),
          h('div',{className:'mf-ai-compose-btns'},
            h('button',{type:'button',className:'ghost-button',disabled:!(s.intelligenceDraft||'').trim(),onClick:()=>app.setState({intelligencePreparedQuestion:(s.intelligenceDraft||'').trim(),intelligenceDraft:''})},'Guardar rascunho'),
            h('button',{type:'button',className:'primary-button',disabled:!(s.intelligenceDraft||'').trim()||Boolean(s.aiBusy||s.localFinancialBusy),onClick:()=>intelligenceSubmitQuestion(app,s.intelligenceDraft)},
              'Enviar no chat',h(Icon,{name:'arrow',size:16})))))));
  else if(tab==='actions')section=h('div',{className:'mf-ai-actions'},
    h('div',{className:'mf-ai-welcome'},
      h('span',{className:'micro-label'},'AÇÕES SUPERVISIONADAS E EXEMPLOS · SEM GRAVAÇÃO AUTOMÁTICA'),
      h('h2',{},'Sugestões e prévias para revisar, nunca automáticas.'),
      h('p',{},'As propostas preparadas nas suas conversas aparecem abaixo mantendo a prévia sem gravação até a entrega I2-B.')),
    allProposals.length?h('div',{className:'mf-ai-proposals-list','aria-label':'Propostas supervisionadas da sessão'},
      ...allProposals.map(p=>renderIntelligenceActionProposalCard(app,p))):
    h('div',{className:'mf-ai-empty-actions'},
      h('p',{},'Nenhuma proposta supervisionada pendente nesta conversa. Peça no chat, por exemplo: “Categorize minha compra do mercado como Alimentação”.')),
    [{id:'limits',title:'Revisar limites de categorias',description:'Compare médias, compromissos e uma margem de segurança.',question:'Prepare uma proposta de limites por categoria para o próximo mês.'},
     {id:'reserve',title:'Planejar reserva de emergência',description:'Estime um objetivo compatível com despesas essenciais e liquidez.',question:'Como construir uma reserva de emergência considerando meus compromissos?'},
     {id:'review',title:'Revisar despesas recorrentes',description:'Identifique cobranças repetidas antes de propor mudanças.',question:'Como posso avaliar se meus gastos recorrentes precisam de revisão?'}].map((item:any)=>
      h('div',{className:'mf-ai-action-card',key:item.id},
        h('div',{className:'mf-ai-action-text'},h('span',{className:'mf-ai-status'},'Exemplo ilustrativo'),h('h3',{},item.title),h('p',{},item.description),
          s.intelligenceExpandedAction===item.id?h('div',{className:'mf-ai-action-detail'},'Na versão conectada, esta proposta mostrará dados utilizados, impacto esperado, validade da análise e ações de aceitar, editar ou rejeitar. Nada será aplicado automaticamente.'):null),
        h('div',{className:'mf-ai-action-buttons'},
          h('button',{type:'button',className:'ghost-button',onClick:()=>app.setState({intelligenceExpandedAction:s.intelligenceExpandedAction===item.id?null:item.id})},
            s.intelligenceExpandedAction===item.id?'Recolher':'Ver detalhes'),
          h('button',{type:'button',className:'mf-ai-link',onClick:()=>intelligencePrepare(app,item.question)},'Preparar análise',h(Icon,{name:'arrow',size:15}))))));
  return h('section',{className:'section mf-intelligence-page','aria-label':'Inteligência financeira'},
    h('div',{className:'mf-ai-intro'},
      h('div',{},h('span',{className:'micro-label'},'INTELIGÊNCIA FINANCEIRA'),
        h('h2',{},'Seu espaço de análise e conversação'),
        h('p',{},s.localFinancialAccess?.token?'Hoje e chat consultam os registros autorizados; respostas somente nesta sessão.':'Hoje, conversa com histórico persistente e plano de ação supervisionado.')),
      h('span',{className:'mf-ai-preview-label'},h(Icon,{name:'shield',size:15}),s.mode==='demo'?'Prévia · dados fictícios':'Prévia · dados locais, sem inferência')),
    typeof renderLocalFinancialAccess==='function'?renderLocalFinancialAccess(app):null,
    h('div',{className:'mf-ai-tabbar',role:'tablist','aria-label':'Seções da Inteligência'},
      tabs.map((item:any)=>h('button',{type:'button',key:item.id,role:'tab','aria-selected':tab===item.id,
        id:'mf-ai-tab-'+item.id,'aria-controls':'mf-ai-section-'+item.id,tabIndex:tab===item.id?0:-1,className:tab===item.id?'active':'',onClick:()=>app.setState({intelligenceTab:item.id}),onKeyDown:(e:any)=>{const next=intelligenceNextTab(item.id,e.key);if(next){e.preventDefault();app.setState({intelligenceTab:next},()=>document.getElementById('mf-ai-tab-'+next)?.focus());}}},item.label))),
    h('div',{id:'mf-ai-section-'+tab,role:'tabpanel','aria-labelledby':'mf-ai-tab-'+tab,tabIndex:0},section),
    h('details',{className:'mf-ai-lab-disclosure'},h('summary',{},h(Icon,{name:'settings',size:17}),h('span',{},'Laboratório de Inteligência'),h('small',{},'Configurações técnicas, conexão OAuth, memória e contexto sintético')),
       renderIntelligenceConnection(app),renderIntelligencePrivacy(app),renderIntelligenceFinancialContext(app)));
}
function renderIntelligencePanel(app:any){
  if(!app.state.intelligencePanelOpen)return null;
  if(app.state.workIntelligenceDemo?.enabled&&typeof renderWorkIntelligencePanel==='function')return renderWorkIntelligencePanel(app);
  if(typeof intelligenceEnsureHydrated==='function')intelligenceEnsureHydrated(app);
  const info=intelligenceContextFor(app.state.intelligenceContext);
  const scope=app.state.intelligenceContextSnapshot||intelligencePageScope(app,app.state.intelligenceContext);
  const messages=intelligenceHistoryList(app);
  const threads:IntelligenceThread[]=Array.isArray(app.state.intelligenceThreads)?app.state.intelligenceThreads:[];
  const activeThreadId=app.state.intelligenceActiveThreadId||'';
  const convState=typeof intelligenceConversationState==='function'?intelligenceConversationState(app):{kind:'oauth_disconnected',pill:'Conta desconectada · modo local',badge:'Conta desconectada',css:'is-offline'};
  const busy=Boolean(app.state.aiBusy||app.state.localFinancialBusy||app.state.intelligenceDrawerBusy);
  const draft=String(app.state.intelligenceDraft||'');
  return h('div',{className:'mf-ai-backdrop',role:'presentation',onMouseDown:(e:any)=>{if(e.target===e.currentTarget)app.setState({intelligencePanelOpen:false});}},
    h('aside',{className:'mf-ai-drawer mf-ai-drawer-compact',role:'dialog','aria-modal':'true','aria-label':'Assistente contextual de '+info.label},
      h('div',{className:'mf-ai-drawer-head'},
        h('div',{className:'mf-ai-drawer-title-wrap'},
          h('div',{className:'mf-ai-drawer-kicker-row'},
            h('span',{className:'micro-label'},'COPILOTO CONTEXTUAL'),
            h('span',{className:'mf-ai-conn-pill '+convState.css},convState.pill)),
          h('h2',{},info.label)),
        h('div',{className:'mf-ai-drawer-head-actions'},
          h('button',{type:'button',className:'ghost-button mf-ai-expand-btn','aria-label':'Nova conversa',title:'Iniciar nova conversa',onClick:()=>intelligenceCreateThread(app)},'Nova'),
          h('button',{type:'button',className:'ghost-button mf-ai-expand-btn','aria-label':'Expandir na aba Inteligência',title:'Abrir na aba Inteligência mantendo a conversa ativa',onClick:()=>intelligenceOpenFullChat(app)},'Expandir'),
          h('button',{type:'button',className:'close-button','aria-label':'Fechar assistente',onClick:()=>app.setState({intelligencePanelOpen:false})},'×'))),
      h('div',{className:'mf-ai-context-meta mf-ai-drawer-scope'},
        h('span',{},scope.label),
        h('span',{},scope.period),
        h('span',{},scope.mode),
        ...scope.filters.map((filter:string)=>h('span',{key:filter},filter)),
        threads.length>1?h('select',{className:'mf-ai-drawer-thread-select','aria-label':'Alternar conversa ativa',value:activeThreadId,onChange:(e:any)=>intelligenceSelectThread(app,e.target.value)},
          ...threads.map((t:IntelligenceThread)=>h('option',{key:t.id,value:t.id},t.title+' ('+t.messages.length+')'))):null),
      typeof renderLocalFinancialAccess==='function'?renderLocalFinancialAccess(app):null,
      h('div',{className:'mf-ai-drawer-body'},
        messages.length===0?h('div',{className:'mf-ai-drawer-empty'},
          h('p',{className:'muted-desc'},info.description),
          h('div',{className:'mf-ai-drawer-suggestions','aria-label':'Sugestões rápidas para '+info.label},
            ...info.questions.map((q:string,i:number)=>h('button',{type:'button',className:'mf-ai-context-prompt',key:i,onClick:()=>intelligenceSubmitQuestion(app,q)},
              h('span',{},q),h(Icon,{name:'arrow',size:15}))))):
        h('div',{className:'mf-ai-drawer-messages',role:'log','aria-live':'polite'},
          ...messages.map(m=>renderIntelligenceMessageItem(app,m)),
          busy?h('div',{className:'mf-ai-msg is-assistant is-streaming',role:'status'},
            h('strong',{},'Assistente MF'),
            h('p',{},'Processando solicitação no contexto de '+scope.label+'…')):null),
        app.state.intelligenceStorageError?h('p',{className:'mf-ai-error',role:'alert'},app.state.intelligenceStorageError):null,
        app.state.aiError?h('p',{className:'mf-ai-error',role:'alert'},app.state.aiError):null),
      h('form',{className:'mf-ai-drawer-composer',onSubmit:(e:any)=>{e.preventDefault();if(draft.trim()&&!busy)void intelligenceSubmitQuestion(app,draft);}},
        h('label',{className:'mf-ai-context-composer',htmlFor:'mf-ai-drawer-input'},
          h('span',{className:'sr-only'},'Pergunta para o assistente'),
          h('textarea',{id:'mf-ai-drawer-input',value:draft,rows:2,maxLength:750,disabled:busy,placeholder:'Pergunte sobre '+scope.label.toLowerCase()+' ou prepare prévia de categoria…',onChange:(e:any)=>app.setState({intelligenceDraft:e.target.value}),onKeyDown:(e:any)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(draft.trim()&&!busy)void intelligenceSubmitQuestion(app,draft);}}})),
        h('div',{className:'mf-ai-drawer-footer'},
          messages.length>0&&activeThreadId?h('button',{type:'button',className:'ghost-button',onClick:()=>intelligenceDeleteThread(app,activeThreadId)},'Excluir conversa'):h('span',{className:'mf-ai-drawer-hint'},'Histórico salvo e sincronizado com a aba Inteligência'),
          h('button',{type:'submit',className:'primary-button',disabled:!draft.trim()||busy},busy?'Enviando…':'Enviar',h(Icon,{name:'arrow',size:15}))))));
}
function renderIntelligenceSettings(app:any){
  return h(Card,{className:'settings-card mf-ai-settings'},
    h('div',{className:'card-heading'},h('div',{},h('h2',{},'Inteligência artificial'),h('p',{},'Autenticação local e testes fictícios · Entrega 2'))),
    h('div',{className:'mf-ai-setting-line'},h('span',{},'Estado'),h('strong',{},app.state.aiStatus.connected?'Conectada':'Não conectada')),
    h('div',{className:'mf-ai-setting-line'},h('span',{},'Modelo previsto'),h('strong',{},'GPT-6.1 Sol')),
    h('div',{className:'mf-ai-setting-line'},h('span',{},'Raciocínio'),h('strong',{},'Low / Medium automático')),
    h('div',{className:'mf-ai-setting-line'},h('span',{},'Economia de tokens'),h('strong',{},'Contexto mínimo + aprovação por teste')),
    h('p',{className:'muted-desc'},'OAuth e memórias aprovadas são protegidos localmente no Windows. Nenhuma memória é enviada sem consentimento por teste. Dados bancários e sincronização de memórias no PWA continuam indisponíveis para a IA.'),
    h('button',{type:'button',className:'outlined-action full',onClick:()=>app.navigate('intelligence')},h(Icon,{name:'spark',size:17}),'Abrir prévia da Inteligência'));
}
