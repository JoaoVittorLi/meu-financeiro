/* Meu Financeiro — Entrega IA-1: interface isolada, sem rede nem dados financeiros.
 * Este arquivo roda no mesmo bundle de src/app.ts (TypeScript module:none). */
const INTELLIGENCE_CONTEXTS:{[name:string]:{label:string;description:string;questions:string[]}}={
  overview:{label:'Visão geral',description:'Indicadores e evolução do período escolhido.',questions:['Explique as principais mudanças da minha visão geral.','Quais informações faltam para avaliar minha saúde financeira?']},
  transactions:{label:'Movimentações',description:'Categorias, recorrências e revisão de lançamentos.',questions:['Analise possíveis padrões nas minhas movimentações.','Como revisar despesas incomuns sem alterar o extrato original?']},
  planning:{label:'Planejamento',description:'Contas futuras e projeção diária do fluxo de caixa.',questions:['Quais compromissos podem comprometer meu saldo futuro?','Como planejar uma reserva sem depender de renda incerta?']},
  budgets:{label:'Orçamentos',description:'Limites, histórico de categorias e oportunidades de ajuste.',questions:['Como definir limites mais inteligentes por categoria?','Quais categorias devo analisar antes de reduzir gastos?']},
  assistant:{label:'Simular compra',description:'Impacto de compras e parcelamentos no planejamento.',questions:['Como avaliar se uma nova compra cabe no meu orçamento?','O que devo comparar antes de parcelar uma compra?']},
  banks:{label:'Minhas contas',description:'Saldos bancários e qualidade das informações sincronizadas.',questions:['Quais dados preciso conferir antes de tomar uma decisão?','Como identificar divergências entre saldo e movimentações?']}
,
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
function intelligencePrepare(app:any,question:string){
  app.setState({page:'intelligence',intelligenceTab:'chat',intelligenceDraft:question,intelligenceDraftScope:app.state.intelligencePanelOpen&&app.state.intelligenceContextSnapshot?app.state.intelligenceContextSnapshot:intelligencePageScope(app),intelligencePanelOpen:false,detail:null,planSelected:null});
}
function intelligenceExampleCard(app:any,id:string,title:string,description:string,icon:string,question:string){
  return h('div',{className:'mf-ai-example-card',key:id},
    h('span',{className:'mf-ai-example-icon'},h(Icon,{name:icon,size:20})),
    h('div',{className:'mf-ai-example-copy'},h('strong',{},title),h('p',{},description),
      h('button',{type:'button',className:'mf-ai-link',onClick:()=>intelligencePrepare(app,question)},'Preparar análise',h(Icon,{name:'arrow',size:15}))));
}
function renderIntelligenceView(app:any){
  const s=app.state,tab=s.intelligenceTab||'today';
  const tabs=[{id:'today',label:'Hoje'},{id:'chat',label:'Conversar'},{id:'actions',label:'Plano de ação'}];
  let section:any=null;
  if(tab==='today')section=h('div',{className:'mf-ai-today'},
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
  else if(tab==='chat')section=h('div',{className:'mf-ai-chat-layout'},
    h('div',{className:'mf-ai-chat-main'},
      h('div',{className:'mf-ai-chat-hero'},h('span',{className:'mf-ai-orb'},h(Icon,{name:'spark',size:25})),
        h('h2',{},'Prepare uma pergunta.'),
        h('p',{},'Escreva e revise um rascunho local. Os testes de IA ficam no laboratório, com dados fictícios.')),
      s.intelligenceDraftScope?h('div',{className:'mf-ai-context-meta'},h('span',{},'Rascunho de '+s.intelligenceDraftScope.label),h('span',{},s.intelligenceDraftScope.period)):null,
      s.intelligencePreparedQuestion?h('div',{className:'mf-ai-prepared',role:'status'},
        h('span',{className:'micro-label'},'PERGUNTA PREPARADA · NÃO ENVIADA'),
        h('p',{},s.intelligencePreparedQuestion),
        h('small',{},'Este rascunho não é enviado ao Sol. Use os casos fictícios autorizados abaixo; nenhuma chamada ocorreu aqui.')):null,
      h('div',{className:'mf-ai-composer'},h('label',{className:'mf-ai-composer-label',htmlFor:'mf-ai-draft'},'Sua pergunta'),
        h('textarea',{id:'mf-ai-draft',value:s.intelligenceDraft||'',rows:3,maxLength:750,placeholder:'Ex.: Quanto posso investir sem comprometer meus pagamentos?',onChange:(e:any)=>app.setState({intelligenceDraft:e.target.value})}),
        h('span',{className:'mf-ai-compose-actions'},h('small',{},'Rascunho local · não enviado'),
          h('button',{type:'button',className:'primary-button',disabled:!(s.intelligenceDraft||'').trim(),onClick:()=>app.setState({intelligencePreparedQuestion:(s.intelligenceDraft||'').trim(),intelligenceDraft:''})},
            'Preparar pergunta',h(Icon,{name:'arrow',size:16}))))),
    h('aside',{className:'mf-ai-prompts'},
      h('strong',{},'Para começar'),
      ['Como construir uma reserva de emergência?','Como funcionam limites inteligentes?','Quando faz sentido antecipar uma dívida?'].map((q:string,i:number)=>
        h('button',{type:'button',key:i,onClick:()=>app.setState({intelligenceDraft:q})},q,h(Icon,{name:'arrow',size:14}))),
      h('div',{className:'mf-ai-prompt-foot'},h('b',{},'Modelo em testes'),h('span',{},'GPT-6.1 Sol · Low/Medium'),h('small',{},'OAuth local no Windows; sem fallback pago e sem acesso bancário pela IA.'))));
  else section=h('div',{className:'mf-ai-actions'},
    h('div',{className:'mf-ai-welcome'},
      h('span',{className:'micro-label'},'EXEMPLOS DE DECISÕES · SEM ALTERAÇÕES REAIS'),
      h('h2',{},'Sugestões para revisar, nunca automáticas.'),
      h('p',{},'Os itens ilustrativos abaixo não estão vinculados às suas contas e não alteram registros.')),
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
        h('h2',{},'Seu espaço de análise'),
        h('p',{},'Hoje, conversa e plano de ação — com dados demonstrativos identificados.')),
      h('span',{className:'mf-ai-preview-label'},h(Icon,{name:'shield',size:15}),'Prévia · dados fictícios')),
    h('div',{className:'mf-ai-tabbar',role:'tablist','aria-label':'Seções da Inteligência'},
      tabs.map((item:any)=>h('button',{type:'button',key:item.id,role:'tab','aria-selected':tab===item.id,
        id:'mf-ai-tab-'+item.id,'aria-controls':'mf-ai-section-'+item.id,tabIndex:tab===item.id?0:-1,className:tab===item.id?'active':'',onClick:()=>app.setState({intelligenceTab:item.id}),onKeyDown:(e:any)=>{const next=intelligenceNextTab(item.id,e.key);if(next){e.preventDefault();app.setState({intelligenceTab:next},()=>document.getElementById('mf-ai-tab-'+next)?.focus());}}},item.label))),
    h('div',{id:'mf-ai-section-'+tab,role:'tabpanel','aria-labelledby':'mf-ai-tab-'+tab,tabIndex:0},section),
    tab==='chat'?h('details',{className:'mf-ai-lab-disclosure'},h('summary',{},h(Icon,{name:'settings',size:17}),h('span',{},'Laboratório de Inteligência'),h('small',{},'Conexão, memória, contexto fictício e testes opcionais')),
       renderIntelligenceConnection(app),renderIntelligencePrivacy(app),renderIntelligenceFinancialContext(app)):null);
}
function renderIntelligencePanel(app:any){
  if(!app.state.intelligencePanelOpen)return null;
  const info=intelligenceContextFor(app.state.intelligenceContext);
  const scope=app.state.intelligenceContextSnapshot||intelligencePageScope(app,app.state.intelligenceContext);
  return h('div',{className:'mf-ai-backdrop',role:'presentation',onMouseDown:(e:any)=>{if(e.target===e.currentTarget)app.setState({intelligencePanelOpen:false});}},
    h('aside',{className:'mf-ai-drawer',role:'dialog','aria-modal':'true','aria-label':'Assistente contextual de '+info.label},
      h('div',{className:'mf-ai-drawer-head'},
        h('div',{},h('span',{className:'micro-label'},'ASSISTENTE CONTEXTUAL'),h('h2',{},info.label)),
        h('button',{type:'button',className:'close-button','aria-label':'Fechar assistente',onClick:()=>app.setState({intelligencePanelOpen:false})},'×')),
      h('div',{className:'mf-ai-drawer-body'},
        h('div',{className:'mf-ai-context-meta'},h('span',{},scope.label),h('span',{},scope.period),h('span',{},scope.mode),...scope.filters.map((filter:string)=>h('span',{key:filter},filter))),
        h('div',{className:'mf-ai-preview-notice'},h(Icon,{name:'shield',size:20}),
          h('div',{},h('strong',{},'Rascunho local'),h('p',{},'Este painel não consulta contas nem envia perguntas ao GPT. Os testes autorizados ficam no laboratório.'))),
        h('p',{className:'muted-desc'},info.description),
        h('h3',{},'Sugestões para esta página'),
        info.questions.map((q:string,i:number)=>h('button',{type:'button',className:'mf-ai-context-prompt',key:i,onClick:()=>intelligencePrepare(app,q)},
          h('span',{},q),h(Icon,{name:'arrow',size:16}))),
        h('label',{className:'mf-ai-context-composer'},h('span',{},'Rascunho da pergunta'),h('textarea',{value:app.state.intelligenceDraft||'',rows:3,maxLength:750,placeholder:'Escreva o que deseja analisar…',onChange:(e:any)=>app.setState({intelligenceDraft:e.target.value})})),
        h('button',{type:'button',className:'primary-button full',disabled:!(app.state.intelligenceDraft||'').trim(),onClick:()=>intelligencePrepare(app,app.state.intelligenceDraft.trim())},'Preparar na Inteligência'),
        h('div',{className:'mf-ai-drawer-footer'},h('button',{type:'button',className:'primary-button full',onClick:()=>app.setState({page:'intelligence',intelligenceTab:'chat',intelligencePanelOpen:false,detail:null,planSelected:null})},'Abrir Inteligência')))));
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
