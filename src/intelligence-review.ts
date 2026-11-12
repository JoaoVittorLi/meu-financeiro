/* Production IPC review UI; writes are available exclusively in a validated
   synthetic Electron profile. Authorization and previews never enter storage. */
function categoryReviewAPI():any{return desktop;}
const categoryReviewKey=(r:any)=>JSON.stringify([r.accountId,r.externalId]);
const categoryReviewConfidence=(v:string)=>({high:'Alta',medium:'Média',low:'Baixa',none:'Sem evidência'}[v]||v);
async function categoryReviewRun(app:any,fn:()=>Promise<void>){
 if(app.state.categoryReviewBusy)return;
 app.setState({categoryReviewBusy:true,categoryReviewError:''});
 try{await fn();}catch(e:any){app.setState({categoryReviewError:String(e.message||'Operação indisponível.').slice(0,240),categoryReviewPreview:null});}
 finally{app.setState({categoryReviewBusy:false});}
}
async function categoryReviewRefresh(app:any,after=0){
 const grant=app.state.categoryReviewGrant;if(!grant)return;
 const api=categoryReviewAPI();
 const [report,queue]=await Promise.all([api.categoryReviewList({token:grant.token}),api.categoryReviewQueue({token:grant.token,after,limit:50,filters:app.state.categoryReviewFilters||{}})]);
 if(app.state.categoryReviewGrant?.token!==grant.token)return;
 app.setState({categoryReviewReport:report,categoryReviewQueue:queue,categoryReviewCursor:after});
}
async function categoryReviewOpen(app:any){
 app.setState({page:'intelligence',intelligencePanelOpen:false,intelligenceTab:'actions',categoryReviewOpen:true},()=>document.scrollingElement?.scrollTo({top:0,behavior:'instant' as ScrollBehavior}));
 await categoryReviewRun(app,async()=>{
  const status=await categoryReviewAPI()?.categoryReviewStatus?.();
  app.setState({categoryReviewAvailable:status?.available===true});
  if(app.state.categoryReviewGrant)await categoryReviewRefresh(app);
 });
}
async function categoryReviewEnable(app:any){
 await categoryReviewRun(app,async()=>{
  if(app.state.localFinancialAccess?.token)localFinancialDisable(app);
  const mode=app.state.mode,grant=await categoryReviewAPI().categoryReviewAuthorize({consent:'SYNTHETIC_CATEGORY_REVIEW_V1'});
  if(app.state.mode!==mode){await categoryReviewAPI().categoryReviewRevoke({token:grant.token});return;}
  const backup={intelligenceThreads:app.state.intelligenceThreads,intelligenceMessages:app.state.intelligenceMessages,intelligenceActiveThreadId:app.state.intelligenceActiveThreadId,intelligenceHydratedMode:app.state.intelligenceHydratedMode};
  app.setState({categoryReviewGrant:grant,categoryReviewBackup:backup,intelligenceThreads:[],intelligenceMessages:[],intelligenceActiveThreadId:null});
  await categoryReviewRefresh(app);
 });
}
function categoryReviewDisable(app:any){
 const grant=app.state.categoryReviewGrant;
 app.setState({...app.state.categoryReviewBackup,categoryReviewGrant:null,categoryReviewBackup:null,categoryReviewReport:null,categoryReviewQueue:null,categoryReviewPreview:null,categoryReviewSelected:[],categoryReviewReceipt:null,categoryReviewOpen:false,categoryReviewError:'',categoryReviewBusy:false});
 if(grant)void categoryReviewAPI()?.categoryReviewRevoke({token:grant.token}).catch(()=>{});
}
async function categoryReviewPrepare(app:any,action:string,payload:any){
 await categoryReviewRun(app,async()=>{
  const grant=app.state.categoryReviewGrant;
  const preview=await categoryReviewAPI().categoryReviewPrepare({token:grant.token,action,payload});
  if(app.state.categoryReviewGrant?.token===grant.token)app.setState({categoryReviewPreview:preview,categoryReviewConfirmed:false,categoryReviewReceipt:null},()=>document.querySelector('.mf-review-preview')?.scrollIntoView({block:'start'}));
 });
}
async function categoryReviewConfirm(app:any){
 const p=app.state.categoryReviewPreview,g=app.state.categoryReviewGrant;
 if(!p||!g||!app.state.categoryReviewConfirmed)return;
 await categoryReviewRun(app,async()=>{
  const receipt=await categoryReviewAPI().categoryReviewConfirm({token:g.token,id:p.id,digest:p.digest,consent:'CONFIRM_CATEGORY_PREVIEW_V1'});
  if(app.state.categoryReviewGrant?.token!==g.token)return;
  app.setState({categoryReviewPreview:null,categoryReviewConfirmed:false,categoryReviewReceipt:{...receipt,rule:p.rule},categoryReviewSelected:[]});
  await categoryReviewRefresh(app);
  // Refresh the ordinary bank views using their own existing service.
  if(typeof app.refreshBank==='function')await app.refreshBank();
 });
}
function categoryReviewHandleQuestion(app:any,raw:string):boolean{
 const q=intelligenceFoldText(raw);
 if(!app.state.categoryReviewGrant||!(/revis.*(pend|tudo|moviment)|sug.*regr|regr.*recom|desfac/.test(q)))return false;
 if(/desfac/.test(q)){
  const last=app.state.categoryReviewReport?.audit?.find((a:any)=>a.undoState==='available');
  if(last)void categoryReviewPrepare(app,'undo',{commandId:last.id});
 }
 const scope=intelligencePageScope(app),messages=intelligenceHistoryList(app);
 intelligenceSyncThreadMessages(app,[...messages,{id:'review-user-'+Date.now(),role:'user',text:raw,status:'sent',createdAt:intelligenceNowTime(),scopeLabel:scope.label,periodLabel:scope.period},
  {id:'review-answer-'+Date.now(),role:'assistant',text:'A Central de Revisão usa o histórico local, com regras sugeridas, registros paginados e confirmação específica de cada ação. Abra a seleção para revisar. Nenhuma mudança foi executada por esta mensagem.',status:'done',createdAt:intelligenceNowTime(),scopeLabel:scope.label,periodLabel:scope.period}],scope);
 app.setState({intelligenceDraft:''});return true;
}
function renderCategoryReviewPreview(app:any){
 const p=app.state.categoryReviewPreview;if(!p)return null;
 return h('section',{className:'mf-review-preview','aria-label':'Prévia da ação supervisionada'},
  h('span',{className:'micro-label'},'PRÉVIA · NENHUMA ALTERAÇÃO EXECUTADA'),h('h3',{},p.title),h('p',{},p.summary),
  p.rule?h('dl',{className:'mf-review-rule-details'},...Object.entries({Padrão:p.rule.pattern,Correspondência:'Descrição exata',Categoria:p.rule.category,Conta:p.rule.accountName,Natureza:p.rule.nature==='expense'?'Saída':'Entrada',Prioridade:p.rule.priority}).map(([k,v])=>h('div',{key:k},h('dt',{},k),h('dd',{},String(v))))):null,
  p.historicalEligible!=null?h('p',{},p.historicalEligible+(p.historicalPartial?'+':'')+' registro(s) anteriores elegíveis. Aplicar ao histórico exige outra seleção e outra confirmação.'):null,
  p.affected?.length?h('div',{className:'mf-review-table-wrap'},h('table',{},h('thead',{},h('tr',{},...['Movimentação','Valor','Antes','Depois'].map(t=>h('th',{key:t},t)))),h('tbody',{},...p.affected.map((r:any)=>h('tr',{key:categoryReviewKey(r)},h('td',{},r.description||r.externalId,h('small',{},r.accountName||r.accountId)),h('td',{},r.amount!=null?fmt(Math.abs(r.amount)):'—'),h('td',{},r.category||'—'),h('td',{},r.newCategory||'—')))))):null,
  p.totalCents!=null?h('p',{},'Total absoluto da seleção: '+fmt(p.totalCents)):null,
  p.partial?h('p',{},'Prévia limitada aos primeiros 100 registros de '+p.affectedTotal+'.'):null,
  h('label',{className:'mf-review-confirm'},h('input',{type:'checkbox',checked:!!app.state.categoryReviewConfirmed,disabled:app.state.categoryReviewBusy,onChange:(e:any)=>app.setState({categoryReviewConfirmed:e.target.checked})}),'Conferi esta prévia e autorizo somente esta ação nos dados sintéticos.'),
  h('div',{className:'mf-review-actions'},h('button',{type:'button',className:'primary-button',disabled:!app.state.categoryReviewConfirmed||app.state.categoryReviewBusy||p.expiresAt<=Date.now(),onClick:()=>void categoryReviewConfirm(app)},'Confirmar esta ação'),h('button',{type:'button',className:'ghost-button',disabled:app.state.categoryReviewBusy,onClick:()=>app.setState({categoryReviewPreview:null,categoryReviewConfirmed:false})},'Cancelar sem aplicar')));
}
function renderCategoryReviewRow(app:any,r:any,selected:any[],button:any){
 const reasons={generic_category:'Categoria genérica',not_reviewed:'Ainda não revisada',inconsistent_pattern:'Classificações divergentes',split_individual_review:'Possui divisão',outdated_classification:'Classificação desatualizada após importação'};
 return h('tr',{key:categoryReviewKey(r)},
  h('td',{},h('input',{type:'checkbox','aria-label':'Selecionar '+r.description+' '+r.externalId,
   disabled:app.state.categoryReviewBusy||!r.batchEligible,checked:selected.some(x=>categoryReviewKey(x)===categoryReviewKey(r)),
   onChange:(e:any)=>app.setState({categoryReviewSelected:e.target.checked?[...selected,r].slice(0,100):selected.filter(x=>categoryReviewKey(x)!==categoryReviewKey(r))})})),
  h('td',{},r.description,h('small',{},r.date+' · '+r.accountName+' · '+r.status)),
  h('td',{},r.category,h('small',{},r.reasons.map(v=>reasons[v]).join(' · '))),
  h('td',{},fmt(Math.abs(r.amount))),
  h('td',{},button('Revisar individualmente',()=>void categoryReviewPrepare(app,'classify',{items:[r],category:app.state.categoryReviewCategory||r.suggestedCategory||'Alimentação'}),r.manual||r.hasSplits||r.status!=='POSTED'),
   button('Marcar como revisada',()=>void categoryReviewPrepare(app,'reviewed',{items:[r]}))));
}
function renderCategoryReview(app:any){
 const s=app.state,g=s.categoryReviewGrant,report=s.categoryReviewReport,queue=s.categoryReviewQueue,busy=!!s.categoryReviewBusy,selected=s.categoryReviewSelected||[],filters=s.categoryReviewFilters||{};
 const button=(label:string,action:()=>void,disabled=false)=>h('button',{type:'button',className:'ghost-button',disabled:busy||disabled,onClick:action},label);
 const categorySelect=(value:string,onChange:(v:string)=>void,label='Categoria')=>h('select',{'aria-label':label,value,disabled:busy,onChange:(e:any)=>onChange(e.target.value)},...(report?.categories||[]).map((c:any)=>h('option',{key:c.name,value:c.name},c.name)));
 const setFilter=(name:string,value:string)=>app.setState({categoryReviewFilters:{...filters,[name]:value},categoryReviewSelected:[],categoryReviewPreview:null});
 return h('section',{className:'mf-review','aria-label':'Central de revisão inteligente'},
  h('header',{className:'mf-review-header'},h('div',{},h('span',{className:'micro-label'},'INTELIGÊNCIA · DECISÕES LOCAIS'),h('h2',{},'Central de revisão'),h('p',{},'Entenda o padrão. Confira a seleção. Decida o que pode mudar.')),g?h('div',{className:'mf-review-actions'},button('Conversar',()=>app.setState({categoryReviewOpen:false,intelligenceTab:'chat'})),button('Encerrar revisão',()=>categoryReviewDisable(app))):button('Voltar',()=>app.setState({categoryReviewOpen:false}))),
  h('p',{className:'mf-review-safety'},'Homologação com dados sintéticos. Escrita da Inteligência permanece desativada no perfil pessoal.'),
  !g?h('div',{className:'mf-review-empty'},h('h3',{},s.categoryReviewAvailable===false?'Aguardando homologação':'Começar uma revisão supervisionada'),h('p',{},s.categoryReviewAvailable===false?'Este perfil não permite escrita pela Inteligência. O fluxo pode ser testado na candidata Electron com perfil sintético validado.':'Autorize a leitura do perfil de teste para encontrar padrões e preparar ações. Cada gravação terá uma prévia e confirmação separadas.'),s.categoryReviewAvailable? h('button',{type:'button',className:'primary-button',disabled:busy,onClick:()=>void categoryReviewEnable(app)},'Autorizar revisão dos dados sintéticos'):null):null,
  s.categoryReviewError?h('p',{role:'alert',className:'mf-ai-error'},s.categoryReviewError):null,
  busy?h('p',{role:'status'},'Conferindo os registros e as permissões…'):null,
  g&&report?h('div',{className:'mf-review-content'},
   h('div',{className:'mf-review-summary'},h('div',{},h('strong',{},String(report.suggestionsTotal)),h('span',{},'regras sugeridas')),h('div',{},h('strong',{},String(report.scanned)),h('span',{},'registros locais analisados')),h('div',{},h('strong',{},String(report.rules.filter((r:any)=>r.enabled).length)),h('span',{},'regras ativas')),button('Atualizar análise',()=>void categoryReviewRun(app,()=>categoryReviewRefresh(app)))),
   report.suggestionsPartial?h('p',{},'Exibindo 100 de '+report.suggestionsTotal+' sugestões.'):null,
   renderCategoryReviewPreview(app),
   s.categoryReviewReceipt?h('div',{className:'mf-review-receipt',role:'status'},h('strong',{},'Ação persistida e auditada.'),h('p',{},'Comprovante: '+s.categoryReviewReceipt.id),s.categoryReviewReceipt.action==='rule'?h('div',{},h('p',{},'Regra criada para as próximas importações. Deseja aplicar também aos lançamentos anteriores compatíveis?'),button('Revisar histórico compatível',()=>app.setState({categoryReviewFilters:{accountId:s.categoryReviewReceipt.rule.accountId,pattern:s.categoryReviewReceipt.rule.pattern},categoryReviewSelected:[]},()=>void categoryReviewRun(app,()=>categoryReviewRefresh(app)))),button('Agora não',()=>app.setState({categoryReviewReceipt:null}))):null):null,
   h('section',{'aria-label':'Sugestões de regras'},h('h3',{},'Padrões que podem reduzir seu trabalho'),
    !report.suggestions.length?h('p',{className:'mf-review-empty'},'Nenhum padrão novo com evidência manual nesta análise.'):null,
    ...report.suggestions.map((r:any)=>h('article',{key:r.id,className:'mf-review-suggestion'},h('div',{className:'mf-review-suggestion-head'},h('h4',{},r.name),h('span',{className:'mf-review-confidence is-'+r.confidence},'Confiança '+categoryReviewConfidence(r.confidence)+(r.state==='deferred'?' · adiada':''))),h('p',{},r.reason),h('p',{},r.accountName+' · '+(r.nature==='expense'?'Saídas':'Entradas')+' · descrição exata · '+r.compatible+' compatíveis'),r.conflicts.length?h('p',{className:'mf-ai-error'},'Divergências: '+r.conflicts.join(' · ')):null,
     h('ul',{},...r.examples.map((e:any)=>h('li',{key:categoryReviewKey(e)},e.date+' · '+e.description+' · '+fmt(Math.abs(e.amount))+' · '+e.category))),
     h('div',{className:'mf-review-actions'},categorySelect(s.categoryReviewEdits?.[r.id]||r.category,v=>app.setState({categoryReviewEdits:{...s.categoryReviewEdits,[r.id]:v}}),'Editar categoria da sugestão '+r.pattern),button('Aceitar / simular regra',()=>void categoryReviewPrepare(app,'rule',{suggestionId:r.id,category:s.categoryReviewEdits?.[r.id]||r.category})),button('Negar',()=>void categoryReviewPrepare(app,'decision',{suggestionId:r.id,state:'denied'})),button('Adiar',()=>void categoryReviewPrepare(app,'decision',{suggestionId:r.id,state:'deferred'})))))),
   h('section',{'aria-label':'Movimentações para revisar'},h('h3',{},'Revise os registros que precisam de atenção'),h('p',{},'PENDING indica confirmação bancária; não é, por si só, uma pendência de categoria. Baixa confiança exige revisão individual.'),
    h('div',{className:'mf-review-filters'},h('label',{},'Conta',h('select',{value:filters.accountId||'',onChange:(e:any)=>setFilter('accountId',e.target.value)},h('option',{value:''},'Todas as contas'),...report.accounts.map((a:any)=>h('option',{key:a.id,value:a.id},a.name)))),h('label',{},'De',h('input',{type:'date',value:filters.start||'',onChange:(e:any)=>setFilter('start',e.target.value)})),h('label',{},'Até',h('input',{type:'date',value:filters.end||'',onChange:(e:any)=>setFilter('end',e.target.value)})),h('label',{},'Confiança',h('select',{value:filters.confidence||'',onChange:(e:any)=>setFilter('confidence',e.target.value)},...['','high','medium','low','none'].map(v=>h('option',{key:v,value:v},v?categoryReviewConfidence(v):'Todas')))),button('Aplicar filtros',()=>void categoryReviewRun(app,()=>categoryReviewRefresh(app))),filters.pattern?button('Limpar padrão',()=>app.setState({categoryReviewFilters:{...filters,pattern:''}},()=>void categoryReviewRun(app,()=>categoryReviewRefresh(app)))):null),
    h('div',{className:'mf-review-actions'},h('span',{},selected.length+' selecionado(s)'),categorySelect(s.categoryReviewCategory||'Alimentação',v=>app.setState({categoryReviewCategory:v}),'Categoria da seleção'),button('Preparar classificação da seleção',()=>void categoryReviewPrepare(app,'classify',{items:selected,category:s.categoryReviewCategory||'Alimentação'}),!selected.length),button('Limpar seleção',()=>app.setState({categoryReviewSelected:[]}))),
    queue?h('div',{className:'mf-review-table-wrap'},h('table',{},h('thead',{},h('tr',{},...['Selecionar','Movimentação','Categoria / motivo','Valor','Revisão'].map(t=>h('th',{key:t},t)))),h('tbody',{},...queue.rows.map((r:any)=>renderCategoryReviewRow(app,r,selected,button))))):null,
    !queue?.rows?.length?h('p',{className:'mf-review-empty'},'Nenhum registro para estes filtros.'):null,
    h('div',{className:'mf-review-actions'},button('Primeira página',()=>void categoryReviewRun(app,()=>categoryReviewRefresh(app)),!s.categoryReviewCursor),button('Próxima página',()=>void categoryReviewRun(app,()=>categoryReviewRefresh(app,queue.nextCursor)),queue?.nextCursor==null),h('small',{},queue?.coverage||'Registros paginados; até 50 por página.'))),
   h('section',{'aria-label':'Gestão de regras'},h('h3',{},'Regras ativas e pausadas'),...report.rules.map((r:any)=>h('div',{className:'mf-review-managed',key:r.id},h('strong',{},r.pattern+' → '+r.category),h('small',{},(r.enabled?'Ativa':'Pausada')+' · prioridade '+r.priority+(r.constraint?' · conta específica · importações futuras':' · regra existente')),r.constraint?h('div',{className:'mf-review-actions'},categorySelect(s.categoryReviewRuleEdits?.[r.id]||r.category,v=>app.setState({categoryReviewRuleEdits:{...s.categoryReviewRuleEdits,[r.id]:v}}),'Categoria da regra '+r.id),button('Simular edição',()=>void categoryReviewPrepare(app,'manage-rule',{ruleId:r.id,change:'edit',category:s.categoryReviewRuleEdits?.[r.id]||r.category})),button(r.enabled?'Pausar':'Reativar',()=>void categoryReviewPrepare(app,'manage-rule',{ruleId:r.id,change:r.enabled?'pause':'resume'})),button('Excluir com prévia',()=>void categoryReviewPrepare(app,'manage-rule',{ruleId:r.id,change:'delete'}))):h('small',{},'Editar em Configurações de categorias.')))),
   h('details',{},h('summary',{},'Decisões e auditoria local'),...report.audit.map((a:any)=>h('div',{className:'mf-review-audit',key:a.id},h('span',{},({rule:'Regra criada',classify:'Classificação',reviewed:'Revisão',decision:'Decisão',undo:'Reversão',forget:'Preferências apagadas','manage-rule':'Regra atualizada'}[a.action]||'Ação')+' · '+new Date(a.appliedAt).toLocaleString('pt-BR')+' · '+({available:'Pode desfazer',undone:'Desfeita',not_applicable:'Registrada'}[a.undoState]||'Registrada')),a.undoState==='available'?button('Preparar desfazer',()=>void categoryReviewPrepare(app,'undo',{commandId:a.id})):null)),h('p',{},report.decisions.length+' decisão(ões) recente(s): '+report.decisions.map((d:any)=>({denied:'negada',deferred:'adiada',accepted:'aceita',edited:'editada'}[d.state])).join(', ')),button('Apagar preferências de sugestões',()=>void categoryReviewPrepare(app,'forget',{})))):null);
}
