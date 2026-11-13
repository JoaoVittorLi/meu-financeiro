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
  status:'sent'|'streaming'|'done'|'unavailable'|'unsupported'|'unimplemented'|'error';
  details?:string;
  operationalActions?:any[];
  operationalEvidence?:string;
  proposal?:IntelligenceActionProposal|null;
  structuredCard?:IntelligenceStructuredCard|null;
  visual?:MfVisualSnapshot|null;
  visualV3?:MfV3Card|null;
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
 app.setState({page:'intelligence',intelligenceTab:'chat',intelligenceMainMode:'chat',categoryReviewOpen:false,intelligenceDraftScope:scope,intelligencePanelOpen:false,detail:null,planSelected:null},()=>document.scrollingElement?.scrollTo({top:0,behavior:'instant' as ScrollBehavior}));
}
function intelligencePrepare(app:any,question:string){
  if(typeof intelligenceEnsureHydrated==='function')intelligenceEnsureHydrated(app);
  app.setState({page:'intelligence',intelligenceTab:'chat',intelligenceMainMode:'chat',intelligenceDraft:question,intelligenceDraftScope:app.state.intelligencePanelOpen&&app.state.intelligenceContextSnapshot?app.state.intelligenceContextSnapshot:intelligencePageScope(app),intelligencePanelOpen:false,detail:null,planSelected:null});
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
  return renderMfD01Proposal(app,proposal);
  /* Legacy renderer kept for contract compatibility; no longer reached by D01. */
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
  const badge=msg.status==='unavailable'?h('span',{className:'mf-ai-msg-badge is-warn'},'Consulta não autorizada'):
    msg.status==='unsupported'?h('span',{className:'mf-ai-msg-badge is-info'},'Consulta não reconhecida'):
    msg.status==='unimplemented'?h('span',{className:'mf-ai-msg-badge is-info'},'Aguarda I2-A'):
    msg.status==='error'?h('span',{className:'mf-ai-msg-badge is-error'},'Serviço indisponível'):null;
  return h('article',{key:msg.id,className:'mf-ai-msg '+(isUser?'is-user':'is-assistant')+' is-'+msg.status},
    h('header',{className:'mf-ai-msg-meta'},
      h('strong',{},isUser?'Você':'Assistente MF'),
      h('span',{},msg.scopeLabel+' · '+msg.periodLabel+' · '+msg.createdAt),
      badge),
    h('div',{className:'mf-ai-msg-body mf-ai-markdown'},...aiMarkdownNodes(msg.text)),
    msg.structuredCard&&!msg.visual&&!msg.visualV3?renderIntelligenceStructuredCard(msg.structuredCard):null,
    msg.visualV3?mfV3Render(app,msg):msg.visual?renderMfVisual(app,msg):null,
    msg.operationalEvidence?h('small',{className:'mf-premium-evidence'},msg.operationalEvidence):null,
    Array.isArray(msg.operationalActions)&&msg.operationalActions.length?h('div',{className:'mf-premium-tile-actions'},...msg.operationalActions.map((action:any)=>intelligencePremiumButton(app,null,action))):null,
    msg.proposal?renderIntelligenceActionProposalCard(app,msg.proposal):null,
    msg.id.startsWith('review-answer-')?h('button',{type:'button',className:'primary-button',onClick:()=>void categoryReviewOpen(app)},'Abrir Central de Revisão'):null,
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
      h('small',{},(s.categoryReviewGrant||s.localFinancialAccess?.token)?'Conversa temporária. Mensagens e autorizações não são gravadas no histórico do perfil.':'O histórico deste perfil é local e não usa o cofre criptografado. Não inclua senhas nem tokens.')):
    h('div',{className:'mf-ai-history-groups',role:'list'},
      ...groups.map((grp:any)=>h('div',{key:grp.label,className:'mf-ai-history-group'},
        h('span',{className:'mf-ai-history-date-label'},grp.label),
        ...grp.items.map((th:IntelligenceThread)=>h('div',{key:th.id,role:'listitem',className:'mf-ai-thread-item '+(th.id===activeId?'is-active':'')},
          h('button',{type:'button',className:'mf-ai-thread-select','aria-current':th.id===activeId?'true':'false',onClick:()=>intelligenceSelectThread(app,th.id)},
            h('strong',{},th.title),
            h('small',{},th.scopeLabel+' · '+th.updatedTime+' · '+th.messages.length+' msg')),
          h('button',{type:'button',className:'mf-ai-thread-delete','aria-label':'Excluir conversa '+th.title,title:'Excluir conversa',onClick:()=>intelligenceDeleteThread(app,th.id)},'×')))))),
    totalThreads>0?h('div',{className:'mf-ai-history-foot'},
      h('button',{type:'button',className:'ghost-button full',onClick:()=>intelligenceClearHistory(app)},(s.categoryReviewGrant||s.localFinancialAccess?.token)?'Limpar conversa temporária':'Limpar histórico do perfil')):null);
}

/* R1 — Premium operational surface. PR #51 owns all financial facts and permission
   checks. This renderer owns only presentation, routing and stale-response guards. */
const MF_PREMIUM_IDS=['UI-01','UI-02','UI-03','UI-04','UI-05','UI-06','UI-07','UI-08'];
function intelligencePremiumAPI():any{return desktop as any;}
function intelligencePremiumSignature(app:any):string{
 const s=app.state,a=s.localFinancialAccess,g=s.categoryReviewGrant;
 return JSON.stringify([s.mode,s.localFinancialMonth||s.month,a?.token||'',a?.source||'',a?.profile||'',
  a?.planning===true,g?.token||'',s.bankFilter||'']);
}
function intelligencePremiumInvalidate(app:any){
 app.__premiumRequest=(app.__premiumRequest||0)+1;
 app.setState({intelligencePremiumReport:null,intelligencePremiumSignature:null,intelligencePremiumLoading:false,intelligencePremiumError:''});
}
async function intelligencePremiumLoad(app:any){
 const api=intelligencePremiumAPI(),signature=intelligencePremiumSignature(app),s=app.state;
 const sequence=(app.__premiumRequest||0)+1;app.__premiumRequest=sequence;
 app.setState({intelligencePremiumLoading:true,intelligencePremiumSignature:signature,intelligencePremiumReport:null,intelligencePremiumError:''});
 if(typeof api?.intelligenceOperationalOverview!=='function'){
  if(sequence===app.__premiumRequest)app.setState({intelligencePremiumLoading:false,
    intelligencePremiumError:'A integração com os serviços do PR #51 ainda não está disponível nesta versão do aplicativo.'});
  return;
 }
 const a=s.localFinancialAccess,g=s.categoryReviewGrant,month=s.localFinancialMonth||s.month;
 try{
  const result=await api.intelligenceOperationalOverview({
   month,source:a?.source||(s.mode==='demo'?'manual':s.localFinancialSource||'bank'),
   profile:a?.profile||(s.mode==='demo'?'demo':'real'),token:a?.token||null,reviewToken:g?.token||null
  });
  if(sequence!==app.__premiumRequest||signature!==intelligencePremiumSignature(app))return;
  if(result?.contract!=='IC-v1/I-P0.1'||result?.privacy?.changesApplied!==false||
     result?.privacy?.personalAIWritingEnabled!==false||
     !Array.isArray(result.cards)||result.cards.length!==8||
     MF_PREMIUM_IDS.some((id,i)=>result.cards[i]?.id!==id))throw Error('Contrato financeiro inválido.');
  app.setState({intelligencePremiumReport:result,intelligencePremiumLoading:false,intelligencePremiumError:''});
 }catch(error:any){
  if(sequence!==app.__premiumRequest||signature!==intelligencePremiumSignature(app))return;
  app.setState({intelligencePremiumLoading:false,intelligencePremiumReport:null,
   intelligencePremiumError:String(error?.message||'Não foi possível carregar esta análise.').slice(0,220)});
 }
}
function intelligencePremiumMoney(value:any):string{
 return Number.isSafeInteger(value)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100):'—';
}
function intelligencePremiumCoverage(value:string):string{
 return value==='complete_local'?'Histórico local analisado':value==='partial_local'?'Cobertura parcial da fonte local':'Cobertura não certificada';
}
function intelligencePremiumState(c:any):string{
 if(!c)return 'Aguardando consulta.';
 if(c.uiState==='ready')return '';
 const labels:any={loading:'Consultando dados…',empty:'Sem registros aplicáveis neste período.',
  denied:'Autorização necessária para consultar.',expired:'A autorização expirou. Autorize novamente.',
  stale:'Consulta desatualizada. Atualize o período.',error:'Não foi possível consultar esta fonte.',
  unsupported:'Não disponível para esta fonte ou perfil.'};
 return c.unavailableReason||labels[c.uiState]||'Não disponível no momento.';
}
function intelligencePremiumAction(app:any,c:any,a:any):void{
 if(!a?.permitted||!a.handler)return;
 switch(a.handler){
  case 'navigation:transactions-review': app.navigate('review');return;
  case 'navigation:transactions': app.navigate('transactions');return;
  case 'navigation:budgets': app.navigate('budgets');return;
  case 'navigation:planning': app.navigate('planning');return;
  case 'navigation:category-editor':
   app.navigate('categories');
   setTimeout(()=>{const node=document.getElementById('mf-category-editor-heading');node?.scrollIntoView({block:'center'});node?.focus();},0);
   return;
  case 'navigation:intelligence-chat':
   app.setState({page:'intelligence',intelligenceTab:'chat',intelligenceMainMode:'chat',categoryReviewOpen:false});return;
  case 'navigation:review-history':
   if(app.state.categoryReviewGrant?.token)void categoryReviewOpen(app);return;
  case 'categoryReviewPrepare':
   if(!app.state.categoryReviewGrant?.token||!a.previewRequired||!a.operationId)return;
   void (async()=>{await categoryReviewOpen(app);if(app.state.categoryReviewGrant?.token)
     await categoryReviewPrepare(app,'rule',{suggestionId:a.operationId});})();
   return;
 }
}
function intelligencePremiumButton(app:any,c:any,a:any){
 const routes=['navigation:transactions-review','navigation:transactions','navigation:budgets','navigation:planning',
  'navigation:category-editor','navigation:intelligence-chat','navigation:review-history','categoryReviewPrepare'];
 const enabled=!!a?.permitted&&routes.includes(a?.handler)&&
  (a.handler!=='navigation:category-editor'||app.state.mode!=='demo')&&
  (a.handler!=='categoryReviewPrepare'||(a.previewRequired===true&&!!a.operationId&&!!app.state.categoryReviewGrant?.token))&&
  (a.handler!=='navigation:review-history'||!!app.state.categoryReviewGrant?.token);
 return h('button',{type:'button',key:a.actionId,className:'mf-premium-action',
  disabled:!enabled,title:!enabled?(a.disabledReason||'Ação indisponível neste perfil.'):a.label,
  onClick:()=>intelligencePremiumAction(app,c,a)},a.label,h(Icon,{name:'arrow',size:14}));
}
function intelligencePremiumEvidence(c:any){
 if(!c)return null;
 return h('small',{className:'mf-premium-evidence'},
  (c.profile==='synthetic'?'Ambiente sintético':c.source==='planning'?'Planejamento':c.source==='bank'?'Banco':c.source==='manual'?'Manual':'Fonte local')+
  ' · '+intelligencePremiumCoverage(c.coverage)+
  (c.period?.start?' · '+c.period.start.slice(0,7):''));
}
function intelligencePremiumTile(app:any,c:any,icon:string,variant=''){
 if(!c)return null;
 const available=c.uiState==='ready'||c.uiState==='empty';
 const actions=Array.isArray(c.actions)?c.actions:[];
 return h('article',{key:c.id,className:'mf-premium-tile '+variant+' is-'+c.uiState,'aria-labelledby':'mf-premium-'+c.id},
  h('header',{className:'mf-premium-tile-head'},
   h('span',{className:'mf-premium-tile-icon'},h(Icon,{name:icon,size:19})),
   h('span',{className:'mf-premium-contract'},c.id)),
  h('h3',{id:'mf-premium-'+c.id},c.title),
  available&&Number.isSafeInteger(c.valueCents)?h('strong',{className:'mf-premium-value'},intelligencePremiumMoney(c.valueCents)):
   available&&Number.isSafeInteger(c.count)?h('strong',{className:'mf-premium-value'},String(c.count)):null,
  h('p',{className:'mf-premium-tile-explanation'},available?
   (c.uiState==='empty'?intelligencePremiumState(c):c.description||'Informações disponíveis da fonte consultada.'):
   intelligencePremiumState(c)),
  available&&c.id==='UI-01'&&c.evidence?.[1]?
   h('p',{className:'mf-premium-review-split'},'Confirmadas: '+c.evidence[1].posted+' · Pendentes no banco: '+c.evidence[1].pendingBank+'. Pendente no banco não implica categoria pendente.'):null,
  available?intelligencePremiumEvidence(c):null,
  h('div',{className:'mf-premium-tile-actions'},...actions.map((a:any)=>intelligencePremiumButton(app,c,a))));
}
function intelligencePremiumBudgetChart(c:any){
 const budgets=(Array.isArray(c?.budgets)?c.budgets:[]).slice(0,4);
 return h('div',{className:'mf-premium-budget-list'},
  ...budgets.map((b:any)=>h('div',{key:b.category,className:'mf-premium-budget-item'},
   h('div',{className:'mf-premium-budget-label'},
    h('strong',{},b.category),
    h('span',{},intelligencePremiumMoney(b.spentCents)+' / '+intelligencePremiumMoney(b.limitCents))),
   Number.isFinite(b.percentage)&&Number.isSafeInteger(b.limitCents)&&b.limitCents>0?
    h('div',{className:'mf-premium-budget-track',role:'progressbar','aria-label':'Consumo do orçamento '+b.category,
     'aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':Math.min(100,Math.max(0,b.percentage))},
     h('span',{className:b.percentage>=100?'is-over':'',style:{width:Math.min(100,Math.max(0,b.percentage))+'%'}})):null)));
}
function renderIntelligencePremiumToday(app:any){
 const s=app.state,signature=intelligencePremiumSignature(app);
 const stale=!!s.intelligencePremiumReport&&s.intelligencePremiumSignature!==signature;
 const report=!stale?s.intelligencePremiumReport:null;
 const loading=!!s.intelligencePremiumLoading&&!stale;
 const cards:Array<any>=Array.isArray(report?.cards)?report.cards:[];
 const get=(id:string)=>cards.find(c=>c.id===id)||null;
 const radar=get('UI-03'),review=get('UI-01'),budgets=get('UI-04'),commit=get('UI-05'),
  rules=get('UI-02'),categories=get('UI-06'),conversation=get('UI-07'),history=get('UI-08');
 const meaningful=radar?.uiState==='ready'&&radar.count>0;
 const sourceLabel=s.categoryReviewGrant?.token?'Revisão sintética':s.localFinancialAccess?.source==='bank'?'Fonte bancária':
   s.localFinancialAccess?.source==='manual'?'Lançamentos manuais':'Sem leitura autorizada';
 const grant=s.localFinancialAccess?.token||s.categoryReviewGrant?.token;
 return h('div',{className:'mf-ai-premium-today',role:'region','aria-label':'Inteligência Hoje'},
  h('div',{className:'mf-premium-head'},
   h('div',{},h('span',{className:'mf-premium-eyebrow'},h(Icon,{name:'spark',size:15}),'VISÃO OPERACIONAL · '+sourceLabel),
    h('h2',{},'O que merece sua atenção?'),
    h('p',{},'Sinais verificáveis para transformar informação em decisão. Nenhuma mudança é aplicada sem sua confirmação.')),
   h('div',{className:'mf-premium-head-controls'},
    h('span',{className:'mf-premium-period'},s.localFinancialMonth||s.month),
    h('button',{type:'button',className:'mf-premium-refresh',disabled:loading,
     onClick:()=>void intelligencePremiumLoad(app)},h(Icon,{name:'arrow',size:15}),loading?'Consultando…':'Atualizar visão'))),
  !grant?h('div',{className:'mf-premium-consent',role:'status'},h(Icon,{name:'shield',size:20}),
   h('p',{},s.mode==='real'&&!s.bank?.config?.configured&&s.localFinancialSource!=='manual'?
    'Nenhuma conexão bancária configurada. Você pode escolher lançamentos manuais na autorização de leitura local acima.':
    'Autorize a leitura local acima para consultar suas movimentações. Categorias e estados de disponibilidade continuam acessíveis sem autorização financeira.')):null,
  stale?h('div',{className:'mf-premium-alert',role:'status'},'Fonte, perfil, conta ou período mudou. A consulta anterior foi ocultada. Atualize para ver os novos dados.'):null,
  s.intelligencePremiumError?h('div',{className:'mf-premium-alert',role:'alert'},s.intelligencePremiumError):null,
  loading?h('div',{className:'mf-premium-loading',role:'status','aria-label':'Carregando informações financeiras'},
   h('div',{className:'mf-premium-skeleton'}),h('div',{className:'mf-premium-skeleton'}),h('div',{className:'mf-premium-skeleton'})):null,
  report?h('div',{className:'mf-premium-dashboard'},
   h('div',{className:'mf-premium-lead'},
    h('section',{className:'mf-premium-radar '+(meaningful?'has-attention':''),'aria-labelledby':'mf-premium-radar-title'},
     h('span',{className:'mf-premium-kicker'},'UI-03 · RADAR FINANCEIRO'),
     h('h3',{id:'mf-premium-radar-title'},meaningful?'Pontos de atenção encontrados.':'Visão do período'),
     radar?.uiState==='ready'||radar?.uiState==='empty'?
      h('div',{},radar.count!==null&&Number.isSafeInteger(radar.count)?
       h('div',{className:'mf-premium-radar-count'},h('strong',{},String(radar.count)),h('span',{},radar.count===1?'ponto de atenção':'pontos de atenção')):null,
       Array.isArray(radar.observations)&&radar.observations.length?
       h('ul',{className:'mf-premium-observations'},...radar.observations.slice(0,3).map((o:any)=>h('li',{key:o.category},
        h('strong',{},o.category),h('span',{},intelligencePremiumMoney(o.spentCents)+' / '+intelligencePremiumMoney(o.limitCents))))):
       h('p',{},intelligencePremiumState({...radar,uiState:'empty'})),
       intelligencePremiumEvidence(radar),
       h('div',{className:'mf-premium-tile-actions'},...(radar.actions||[]).map((a:any)=>intelligencePremiumButton(app,radar,a)))) :
      h('p',{className:'mf-premium-state'},intelligencePremiumState(radar))),
    intelligencePremiumTile(app,review,'filter','mf-premium-review')),
   h('div',{className:'mf-premium-major-grid'},
    h('section',{className:'mf-premium-budget-card','aria-labelledby':'mf-premium-budget-title'},
     h('div',{className:'mf-premium-tile-head'},h('span',{className:'mf-premium-tile-icon'},h(Icon,{name:'pie',size:19})),h('span',{className:'mf-premium-contract'},'UI-04')),
     h('h3',{id:'mf-premium-budget-title'},'Orçamentos em perspectiva'),
     budgets?.uiState==='ready'||budgets?.uiState==='empty'?
      h('div',{},intelligencePremiumBudgetChart(budgets),
       !budgets?.budgets?.length?h('p',{},'Nenhum limite cadastrado com dados aplicáveis.'):null,
       intelligencePremiumEvidence(budgets),
       h('div',{className:'mf-premium-tile-actions'},...(budgets.actions||[]).map((a:any)=>intelligencePremiumButton(app,budgets,a)))) :
      h('p',{},intelligencePremiumState(budgets))),
    intelligencePremiumTile(app,commit,'calendar','mf-premium-commitment')),
   h('div',{className:'mf-premium-lower-grid'},
    intelligencePremiumTile(app,rules,'spark'),
    intelligencePremiumTile(app,categories,'filter'),
    intelligencePremiumTile(app,conversation,'spark'),
    intelligencePremiumTile(app,history,'calendar')),
   h('div',{className:'mf-premium-bottom-note'},
    h(Icon,{name:'shield',size:16}),
    h('span',{},'Valores em centavos da fonte autorizada. '+
      intelligencePremiumCoverage(radar?.coverage||'unknown')+
      '. Revisões e recibos sintéticos nunca representam alterações pessoais.'))):
   !loading&&!s.intelligencePremiumError&&!stale?
    h('div',{className:'mf-premium-empty',role:'status'},h('strong',{},'Sua central está pronta para consultar.'),
     h('p',{},'Use “Atualizar visão” para carregar os contratos reais disponíveis nesta instalação.')):null);
}

function renderIntelligenceAccess(app:any){
 if(typeof renderLocalFinancialAccess!=='function')return null;
 const s=app.state,g=s.localFinancialAccess||s.categoryReviewGrant;
 if(!g)return renderLocalFinancialAccess(app);
 const expired=g.expiresAt<=Date.now();
 return h('details',{className:'mf-chat-access',open:expired},h('summary',{},h(Icon,{name:'shield',size:15}),expired?'Permissão expirada · renovar':s.categoryReviewGrant?'Revisão sintética · gerenciar permissão':'Leitura local autorizada · fonte e período',h('small',{},s.localFinancialMonth||s.month)),renderLocalFinancialAccess(app));
}
function intelligenceChatSession(app:any){
 const s=app.state,g=s.localFinancialAccess||s.categoryReviewGrant;
 return {temporary:!!g,expired:!!g&&g.expiresAt<=Date.now(),busy:!!(s.aiBusy||s.localFinancialBusy||s.intelligenceDrawerBusy)};
}
function renderIntelligenceComposer(app:any,drawer=false){
 const s=app.state,session=intelligenceChatSession(app),draft=String(s.intelligenceDraft||''),id=drawer?'mf-ai-drawer-input':'mf-ai-draft';
 const submit=()=>{if(draft.trim()&&!session.busy&&!session.expired)void intelligenceSubmitQuestion(app,draft);};
 return h('form',{className:'mf-chat-composer '+(drawer?'mf-ai-drawer-composer':'mf-ai-composer'),onSubmit:(e:any)=>{e.preventDefault();submit();}},
  session.expired?h('div',{className:'mf-chat-expired',role:'alert'},h('strong',{},'Autorização expirada'),h('p',{},'Renove a permissão acima para consultar novamente. Seu rascunho foi preservado.')):null,
  h('label',{className:'mf-ai-composer-label',htmlFor:id},'Converse sobre seus registros'),
  h('textarea',{id,value:draft,rows:2,maxLength:750,disabled:session.busy,placeholder:'Pergunte sobre despesas, categorias ou compromissos…',onChange:(e:any)=>app.setState({intelligenceDraft:e.target.value}),onKeyDown:(e:any)=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit();}}}),
  h('div',{className:'mf-chat-compose-footer'},h('small',{},session.temporary?'Somente nesta sessão · sem IA externa':'Histórico local · não inclua credenciais'),h('small',{},draft.length+'/750 · Shift + Enter para nova linha'),
   h('button',{type:'submit',className:'primary-button',disabled:!draft.trim()||session.busy||session.expired},session.busy?'Consultando…':'Enviar',h(Icon,{name:'arrow',size:16}))));
}
function renderIntelligenceFollowups(app:any){
 const session=intelligenceChatSession(app);
 const scope=intelligenceContextFor(app.state.intelligenceContext||app.state.page);
 const answered=new Set(intelligenceHistoryList(app).filter(m=>m.role==='user')
  .map(m=>String(m.text||'').trim().toLocaleLowerCase('pt-BR')));
 const candidates=app.state.categoryReviewGrant?
  ['Quais regras são recomendadas?','Que movimentações preciso revisar?']:
  (app.state.localFinancialAccess?.token?[
    'Quais foram minhas maiores despesas?',
    'Quais despesas aumentaram?',
    'Que movimentações preciso revisar?']:(scope.questions||[]));
 const available=candidates.filter(q=>!answered.has(q.toLocaleLowerCase('pt-BR')))
   .filter(q=>app.state.categoryReviewGrant||app.state.localFinancialAccess?.token||
     (!/minhas|meus|foram|minha renda/i.test(q))).slice(0,2);
 if(!available.length)return null;
 return h('div',{className:'mf-chat-followups','aria-label':'Continuar a análise'},
  ...available.map(q=>h('button',{type:'button',key:q,disabled:session.busy||session.expired,
    onClick:()=>intelligenceSubmitQuestion(app,q)},q,h(Icon,{name:'arrow',size:13}))));
}
function renderIntelligenceView(app:any){
  if(app.state.workIntelligenceDemo?.enabled&&typeof renderWorkIntelligenceDemo==='function')return renderWorkIntelligenceDemo(app);
  if(typeof intelligenceEnsureHydrated==='function')intelligenceEnsureHydrated(app);
  const s=app.state,tab=['chat','today','actions'].includes(s.intelligenceMainMode)?s.intelligenceMainMode:'chat';
  if(s.categoryReviewOpen)return h('section',{className:'section mf-intelligence-page'},renderCategoryReview(app));
  const tabs=[{id:'today',label:'Hoje'},{id:'chat',label:'Conversar'},{id:'actions',label:'Plano de ação'}];
  const messages=intelligenceHistoryList(app);
  const allProposals=typeof intelligenceAllProposals==='function'?intelligenceAllProposals(app):(messages.map(m=>m.proposal).filter(Boolean) as IntelligenceActionProposal[]);
  const convState=typeof intelligenceConversationState==='function'?intelligenceConversationState(app):{kind:'oauth_disconnected',pill:'Conta desconectada · modo local',badge:'Conta desconectada',css:'is-offline'};
  const activeScope=s.intelligenceDraftScope||intelligencePageScope(app,s.intelligenceContext||s.page);
  let section:any=null;
  if(tab==='today')section=renderIntelligencePremiumToday(app);
  if(tab==='chat')section=h('div',{className:'mf-ai-workbench'+(s.intelligenceHistoryOpen?'':' is-history-closed')},
    s.intelligenceHistoryOpen?renderIntelligenceHistorySidebar(app):null,
    h('div',{className:'mf-ai-chat-main mf-ai-workbench-main'},
      h('div',{className:'mf-ai-workbench-header'},
        h('button',{type:'button',className:'ghost-button mf-ai-v3-history-toggle',
          'aria-expanded':!!s.intelligenceHistoryOpen,onClick:()=>app.setState({intelligenceHistoryOpen:!s.intelligenceHistoryOpen})},
          s.intelligenceHistoryOpen?'Recolher histórico':'Histórico de conversas'),
        h('div',{className:'mf-ai-chat-hero'},
          h('span',{className:'mf-ai-orb'},h(Icon,{name:'spark',size:25})),
          h('h2',{},'Uma conversa, mais clareza.'),
          h('p',{},(s.categoryReviewGrant||s.localFinancialAccess?.token)?'Conversa temporária compartilhada com o chat lateral. Prévia e confirmação continuam disponíveis na Central.':'Histórico compartilhado com o chat lateral, salvo localmente quando disponível. Não cole credenciais.')),
        h('div',{className:'mf-ai-workbench-badges'},
          h('span',{className:'mf-ai-conn-pill '+convState.css},s.localFinancialAccess?.token?'Leitura local autorizada':convState.pill),
          h('span',{className:'mf-ai-scope-badge'},'Contexto: '+activeScope.label+' · '+activeScope.period))),
      s.intelligenceDraftScope?h('div',{className:'mf-ai-context-meta'},h('span',{},'Rascunho de '+s.intelligenceDraftScope.label),h('span',{},s.intelligenceDraftScope.period)):null,
      s.intelligencePreparedQuestion?h('div',{className:'mf-ai-prepared',role:'status'},
        h('span',{className:'micro-label'},'PERGUNTA PREPARADA · NÃO ENVIADA'),
        h('p',{},s.intelligencePreparedQuestion),
        h('small',{},'Este rascunho não é enviado ao Sol. Use os casos fictícios autorizados abaixo; nenhuma chamada ocorreu aqui.')):null,
      messages.length===0?h('div',{className:'mf-ai-empty-thread'},
        h('h3',{},'Comece uma análise ou prepare uma categorização supervisionada'),
        h('p',{},'Escolha um ponto de partida. A mesma conversa acompanha você no chat lateral; consultas financeiras autorizadas ficam apenas nesta sessão.'),
        h('div',{className:'mf-ai-starter-grid'},
          ['Quais foram meus maiores gastos deste mês?','Compare minhas despesas com o mês anterior.','Quais orçamentos merecem atenção?','Quais compromissos tenho para o próximo mês?'].map((q:string,i:number)=>
            h('button',{type:'button',className:'mf-ai-context-prompt',key:i,onClick:()=>intelligenceSubmitQuestion(app,q)},
              h('span',{},q),h(Icon,{name:'arrow',size:14}))))):
      h('div',{className:'mf-ai-thread',role:'log','aria-live':'polite'},
        ...messages.map(m=>renderIntelligenceMessageItem(app,m)),
        (s.aiBusy||s.localFinancialBusy)?h('div',{className:'mf-ai-msg is-assistant is-streaming',role:'status'},
          h('strong',{},'Assistente MF'),
          h('p',{},'Processando solicitação…')):null),
      s.aiError?h('p',{className:'mf-ai-error',role:'alert'},s.aiError):null,
      renderIntelligenceFollowups(app),
      renderIntelligenceComposer(app)));
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
        h('h2',{},'Seu centro de comando financeiro'),
        h('p',{},s.localFinancialAccess?.token?'Hoje e chat consultam os registros autorizados; respostas somente nesta sessão.':'Leitura sob autorização, explicações verificáveis e decisões supervisionadas.')),
      h('span',{className:'mf-ai-preview-label'},h(Icon,{name:'shield',size:15}),s.mode==='demo'?'Demonstração isolada':s.localFinancialAccess?.token?'Leitura local autorizada':'Sem consulta externa')),
    h('details',{className:'mf-ai-v3-access'},h('summary',{},'Permissões de consulta'),renderIntelligenceAccess(app)),
    h('button',{type:'button',className:'outlined-action',onClick:()=>void categoryReviewOpen(app)},'Central de revisão · categorização supervisionada'),
    s.categoryReviewPreview?h('div',{className:'mf-review-drawer-pending',role:'status'},h('p',{},'Uma prévia de categorização aguarda sua decisão.'),h('button',{type:'button',className:'primary-button',onClick:()=>void categoryReviewOpen(app)},'Revisar prévia na Central')):null,
    h('details',{className:'mf-ai-v3-tools'},
      h('summary',{},'Mais ferramentas'),
      h('div',{className:'mf-ai-v3-tool-list'},
        ...tabs.filter(item=>item.id!==tab).map((item:any)=>h('button',{type:'button',key:item.id,
          className:'ghost-button',onClick:()=>app.setState({intelligenceMainMode:item.id,categoryReviewOpen:false},
            ()=>{if(item.id==='today')void intelligencePremiumLoad(app);})},
          item.id==='today'?'Ver panorama existente':item.id==='actions'?'Ver propostas supervisionadas':'Voltar à conversa')),
        tab!=='chat'?h('button',{type:'button',className:'primary-button',
          onClick:()=>app.setState({intelligenceMainMode:'chat'})},'Voltar à conversa'):null)),
    h('div',{className:'mf-ai-v3-content',role:'region','aria-label':tab==='chat'?'Conversa financeira':tab==='today'?'Panorama financeiro':'Propostas supervisionadas'},section),
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
    h('aside',{className:'mf-ai-drawer mf-ai-drawer-compact mf-d01',role:'dialog','aria-modal':'true','aria-label':'Assistente contextual de '+info.label},
      h('div',{className:'mf-ai-drawer-head'},
        h('div',{className:'mf-ai-drawer-title-wrap'},
          h('div',{className:'mf-ai-drawer-kicker-row'},
            h('span',{className:'mf-d01-spark','aria-hidden':'true'},'✦'),
            h('span',{className:'micro-label'},'SEU ASSISTENTE')),
          h('h2',{},'Assistente Financeiro'),
          h('small',{className:'mf-d01-context-subtitle'},'Ajudando em '+info.label)),
        h('div',{className:'mf-ai-drawer-head-actions'},
          h('button',{type:'button',className:'ghost-button mf-ai-expand-btn','aria-label':'Nova conversa',title:'Iniciar nova conversa',onClick:()=>intelligenceCreateThread(app)},'Nova'),
          h('button',{type:'button',className:'ghost-button mf-ai-expand-btn','aria-label':'Expandir na aba Inteligência',title:'Abrir na aba Inteligência mantendo a conversa ativa',onClick:()=>intelligenceOpenFullChat(app)},'Expandir'),
          h('button',{type:'button',className:'close-button','aria-label':'Fechar assistente',onClick:()=>app.setState({intelligencePanelOpen:false})},'×'))),
      h('details',{className:'mf-d01-context-disclosure'},
        h('summary',{},'Contexto da conversa',h(Icon,{name:'chevron-down',size:14})),
        h('div',{className:'mf-ai-context-meta mf-ai-drawer-scope'},
          h('span',{},scope.label),h('span',{},scope.period),h('span',{},scope.mode),
          ...scope.filters.map((filter:string)=>h('span',{key:filter},filter)),
          h('span',{},app.state.localFinancialAccess?.token?'Leitura local autorizada':convState.pill)),
        threads.length>1?h('select',{className:'mf-ai-drawer-thread-select','aria-label':'Alternar conversa ativa',value:activeThreadId,onChange:(e:any)=>intelligenceSelectThread(app,e.target.value)},
          ...threads.map((t:IntelligenceThread)=>h('option',{key:t.id,value:t.id},t.title+' ('+t.messages.length+')'))):null),
      h('details',{className:'mf-d01-access'},
        h('summary',{},'Permissões de consulta'),renderIntelligenceAccess(app)),
      app.state.categoryReviewPreview?h('div',{className:'mf-review-drawer-pending'},h('p',{},'Uma prévia de categorização aguarda sua decisão.'),h('button',{type:'button',className:'primary-button',onClick:()=>void categoryReviewOpen(app)},'Revisar prévia na Central')):null,
      h('div',{className:'mf-ai-drawer-body'},
        messages.length===0?h('div',{className:'mf-ai-drawer-empty'},
          h('p',{className:'muted-desc'},info.description),
          h('div',{className:'mf-ai-drawer-suggestions','aria-label':'Sugestões rápidas para '+info.label},
            ...info.questions.filter(q=>!intelligenceHistoryList(app).some(m=>m.role==='user'&&m.text===q)).slice(0,2).map((q:string,i:number)=>h('button',{type:'button',className:'mf-ai-context-prompt',key:i,onClick:()=>intelligenceSubmitQuestion(app,q)},
              h('span',{},q),h(Icon,{name:'arrow',size:15}))))):
        h('div',{className:'mf-ai-drawer-messages',role:'log','aria-live':'polite'},
          ...messages.map(m=>renderIntelligenceMessageItem(app,m)),
          busy?h('div',{className:'mf-ai-msg is-assistant is-streaming',role:'status'},
            h('strong',{},'Assistente MF'),
            h('p',{},'Processando solicitação no contexto de '+scope.label+'…')):null),
        app.state.intelligenceStorageError?h('p',{className:'mf-ai-error',role:'alert'},app.state.intelligenceStorageError):null,
        app.state.aiError?h('p',{className:'mf-ai-error',role:'alert'},app.state.aiError):null),
      renderIntelligenceFollowups(app),renderIntelligenceComposer(app,true)));
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
