/* QA-84 B05 Conversar V5: one transcript, one composer, one existing thread store.
 * Rendered replies are the existing D01/D02 validated messages, never mocks. */
function mfB05CloseHistory(app) {
 app.setState({intelligenceHistoryOpen:false},()=>{
  if(typeof document!=='undefined')document.getElementById('mf-b05-history-trigger')?.focus();
 });
}
function mfB05HistoryDrawer(app) {
 if(!app.state.intelligenceHistoryOpen)return null;
 const close=()=>mfB05CloseHistory(app);
 return h('div',{className:'mf-b05-backdrop mf-b05-history-scrim',
  onMouseDown:(event)=>{if(event.target===event.currentTarget)close();}},
  h('aside',{className:'mf-b05-drawer mf-b05-history-drawer',role:'dialog','aria-modal':'true',
   'aria-label':'Histórico de conversas',onKeyDown:(event)=>mfB05DrawerKeyboard(event,close)},
   h('div',{className:'mf-b05-drawer-heading'},
    h('strong',{},'Seu histórico'),
    h('button',{type:'button',className:'ghost-button',onClick:close},'Fechar')),
   renderIntelligenceHistorySidebar(app)));
}
function renderMfB05Chat(app,messages,convState,activeScope) {
 const s=app.state,session=intelligenceChatSession(app);
 const items=Array.isArray(messages)?messages:[];
 const authorized=!!s.localFinancialAccess?.token&&s.localFinancialAccess?.expiresAt>Date.now();
 const hasReview=!!s.categoryReviewGrant?.token&&s.categoryReviewGrant?.expiresAt>Date.now();
 return h('section',{className:'mf-b05-chat',role:'region','aria-label':'Conversar com a Inteligência'},
  h('header',{className:'mf-b05-chat-head'},
   h('div',{},h('span',{className:'mf-b05-kicker'},'INTELIGÊNCIA FINANCEIRA · CONVERSAR'),
    h('h2',{},'Uma boa conversa muda a perspectiva.'),
    h('p',{},'Pergunte, compare e decida com contexto e evidências quando disponíveis.')),
   h('div',{className:'mf-b05-chat-controls'},
    h('button',{id:'mf-b05-history-trigger',type:'button',className:'ghost-button',
      'aria-expanded':!!s.intelligenceHistoryOpen,
      onClick:()=>app.setState({intelligenceHistoryOpen:true})},h(Icon,{name:'clock',size:16}),'Histórico'),
    h('button',{type:'button',className:'primary-button',
      onClick:()=>{intelligenceCreateThread(app);app.setState({intelligenceHistoryOpen:false});}},
      h(Icon,{name:'plus',size:15}),'Nova conversa'))),
  h('div',{className:'mf-b05-chat-scope'},
   h('span',{className:convState?.css||'is-offline'},authorized?'Leitura autorizada':hasReview?'Revisão sintética':convState?.pill||'Sem conexão autorizada'),
   h('span',{},'Contexto: '+(activeScope?.label||'Inteligência')+' · '+(activeScope?.period||'Sem período')),
   session.expired?h('strong',{className:'mf-b05-warning'},'Permissão expirada — renove em Permissões de consulta'):null),
  s.intelligenceDraftScope&&items.length===0?h('p',{className:'mf-b05-chat-context'},'Rascunho preparado a partir de '+s.intelligenceDraftScope.label):null,
  s.intelligencePreparedQuestion&&s.intelligenceDraft&&s.intelligencePreparedQuestion===s.intelligenceDraft?h('div',{className:'mf-ai-prepared',role:'status'},
   h('p',{},s.intelligencePreparedQuestion),h('small',{},'Pergunta preparada, ainda não enviada.')):null,
  h('div',{className:'mf-b05-chat-thread',role:'log','aria-label':'Mensagens da conversa','aria-live':'polite'},
   items.length?items.map(msg=>renderIntelligenceMessageItem(app,msg)):
    h('div',{className:'mf-b05-chat-welcome'},
     h('span',{className:'mf-b05-chat-orb'},h(Icon,{name:'spark',size:30})),
     h('h3',{},'O que você gostaria de entender hoje?'),
     h('p',{},authorized?'Explore seus registros autorizados ou converse com o Copiloto.':
      s.aiStatus?.connected&&s.aiCopilotCap?.enabled?'Pergunte sobre finanças em geral ou autorize a leitura local para consultar seus registros.':
      'Comece com uma dúvida geral ou autorize seus registros para análises e ações supervisionadas.'),
     h('div',{className:'mf-b05-starters'},
      ...(authorized?['Quais foram minhas maiores despesas?','Quais categorias ultrapassaram o orçamento?']:
        ['Como organizar minhas despesas mensais?','Como construir uma reserva de emergência?'])
       .map(q=>h('button',{type:'button',key:q,onClick:()=>{
         if(typeof intelligenceSubmitQuestion==='function')void intelligenceSubmitQuestion(app,q);
         else intelligencePrepare(app,q);
        }},
         q,h(Icon,{name:'arrow',size:14}))))),
   s.aiCopilotBusy?h('div',{className:'mf-ai-msg is-assistant is-streaming',role:'status'},
     h('strong',{},'Copiloto GPT-6.2 Sol'),
     h('p',{},s.aiCopilotStreaming||'Consultando GPT-6.2 Sol…'),
     typeof (typeof desktop!=='undefined'?desktop as any:null)?.aiCopilotCancel==='function'?h('button',{type:'button',className:'ghost-button mf-ai-stream-cancel',onClick:()=>void (desktop as any).aiCopilotCancel()},'Cancelar solicitação'):null):null,
   !s.aiCopilotBusy&&(s.aiBusy||s.localFinancialBusy)?h('p',{className:'mf-b05-chat-thinking',role:'status'},
     'Consultando a fonte disponível…'):null,
   s.aiError?h('p',{role:'alert',className:'mf-ai-error'},s.aiError):null,
   s.intelligenceStorageError?h('p',{role:'alert',className:'mf-ai-error'},s.intelligenceStorageError):null),
  items.length?renderIntelligenceFollowups(app):null,
  h('div',{className:'mf-b05-chat-composer'},renderIntelligenceComposer(app)),
  mfB05HistoryDrawer(app));
}
