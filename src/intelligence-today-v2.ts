/* RC-ALL-01 C1 — D03 Intelligence Today V2.
 * Financial signals come ONLY from authorized IC-v1/I-P0.1 local service facts.
 * There is deliberately no available balance/forward projection in this service.
 * Do not repurpose netCents as cash balance or infer future income. */
type MfD03Signal={
 id:string;priority:number;kind:'budget'|'commitment'|'review'|'rule';
 title:string;detail:string;amountCents:number|null;meaning:string;
 sourceId:string;action:string;actionLabel:string;sourceCard:any;
};
function mfD03EligibleReport(report:any,app:any):boolean{
 const s=app.state,access=s.localFinancialAccess,review=s.categoryReviewGrant;
 if(!report||report.contract!=='IC-v1/I-P0.1'||report.privacy?.readOnly!==true||
   report.privacy?.changesApplied!==false||report.privacy?.modelCalled!==false||
   report.privacy?.personalAIWritingEnabled!==false||!Array.isArray(report.cards)||
   report.cards.length!==8||MF_PREMIUM_IDS.some((id,i)=>report.cards[i]?.id!==id))return false;
 if(s.intelligencePremiumSignature!==intelligencePremiumSignature(app))return false;
 const a=access?.token&&Number.isFinite(access.expiresAt)&&access.expiresAt>Date.now()&&
   access.profile===s.mode&&['bank','manual'].includes(access.source);
 const b=review?.token&&Number.isFinite(review.expiresAt)&&review.expiresAt>Date.now();
 return !!(a||b);
}
function mfD03Signals(report:any,app:any):MfD03Signal[]{
 if(!mfD03EligibleReport(report,app))return [];
 const s=app.state,activeGrant=!!s.localFinancialAccess?.token&&
   s.localFinancialAccess?.expiresAt>Date.now()&&s.localFinancialAccess?.profile===s.mode;
 const activeReview=!!s.categoryReviewGrant?.token&&s.categoryReviewGrant.expiresAt>Date.now();
 const cards=report.cards,get=(id:string)=>cards.find((c:any)=>c.id===id);
 const result:MfD03Signal[]=[];
 const budgets=get('UI-04');
 if(activeGrant&&(budgets?.uiState==='ready'||budgets?.uiState==='empty')&&
    budgets.capability==='available_read_only'&&Array.isArray(budgets.budgets)){
  const b=budgets.budgets.filter((r:any)=>r&&typeof r.category==='string'&&
    Number.isSafeInteger(r.spentCents)&&r.spentCents>=0&&
    Number.isSafeInteger(r.limitCents)&&r.limitCents>=0);
  const excess=b.filter((r:any)=>r.spentCents>r.limitCents).sort((a:any,c:any)=>
    (c.spentCents-c.limitCents)-(a.spentCents-a.limitCents));
  if(excess.length){
   const first=excess[0],delta=first.spentCents-first.limitCents;
   if(Number.isSafeInteger(delta))result.push({id:'budget-excess',priority:100,kind:'budget',
    title:'Revise o orçamento de '+first.category,
    detail:excess.length+' categoria(s) superaram o limite registrado. O excesso indicado é do período consultado.',
    amountCents:delta,meaning:'Excesso observado · '+first.category,sourceId:'UI-04',
    action:'budgets',actionLabel:'Ver limites',sourceCard:budgets});
  }else{
   const near=b.filter((r:any)=>r.limitCents>0&&r.spentCents>=r.limitCents*0.8)
     .sort((a:any,c:any)=>c.spentCents/c.limitCents-a.spentCents/a.limitCents);
   if(near.length)result.push({id:'budget-near',priority:75,kind:'budget',
    title:'Acompanhe '+near[0].category,detail:'O consumo atingiu 80% ou mais do limite configurado. Ainda não é uma previsão de estouro.',
    amountCents:near[0].limitCents-near[0].spentCents,
    meaning:'Restante do limite · '+near[0].category,sourceId:'UI-04',
    action:'budgets',actionLabel:'Conferir orçamento',sourceCard:budgets});
  }
 }
 const commitments=get('UI-05');
 if(activeGrant&&s.localFinancialAccess?.planning===true&&
   commitments?.uiState==='ready'&&commitments.capability==='available_read_only'&&
   Number.isSafeInteger(commitments.valueCents)&&commitments.valueCents>=0&&
   Number.isSafeInteger(commitments.count)&&commitments.count>0)
  result.push({id:'commitments',priority:80,kind:'commitment',
   title:'Compromissos futuros confirmados',
   detail:commitments.count+' compromisso(s) ainda previstos no planejamento. Não representa dinheiro já descontado ou saldo disponível.',
   amountCents:commitments.valueCents,meaning:'Total restante planejado · próximo período',sourceId:'UI-05',
   action:'planning',actionLabel:'Ver agenda',sourceCard:commitments});
 const review=get('UI-01');
 if(activeGrant&&s.localFinancialAccess?.source==='bank'&&
   review?.source==='bank'&&review?.uiState==='ready'&&
   Number.isSafeInteger(review.count)&&review.count>0)
  result.push({id:'review',priority:72,kind:'review',title:'Há movimentações para conferir',
   detail:review.count+' movimentação(ões) não revisada(s) no histórico bancário local. PENDING não significa erro de categorização.',
   amountCents:null,meaning:'Registros para revisão',sourceId:'UI-01',
   action:'transactions',actionLabel:'Inspecionar registros',sourceCard:review});
 const rules=get('UI-02');
 if(activeReview&&rules?.profile==='synthetic'&&rules.uiState==='ready'&&
   Number.isSafeInteger(rules.count)&&rules.count>0)
  result.push({id:'rules',priority:67,kind:'rule',title:'Regras aguardando sua análise',
    detail:rules.count+' sugestão(ões) do ambiente sintético. Nenhuma categorização pessoal foi aplicada.',
    amountCents:null,meaning:'Revisões supervisionadas',sourceId:'UI-02',
    action:'review',actionLabel:'Abrir Central de Revisão',sourceCard:rules});
 return result.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).slice(0,3);
}
function mfD03OpenDrawer(app:any,signal:MfD03Signal|null,openerId:string):void{
 app.setState({mfD03Drawer:signal||{id:'projection',title:'Ajustar previsão',
   detail:'O serviço autorizado atual não disponibiliza saldo disponível e calendário futuro reconciliados no mesmo escopo. Ajuste premissas apenas no Simulador original.',
   meaning:'Sem previsão certificada',action:'simulator',actionLabel:'Abrir Simular Compra',
   amountCents:null},mfD03OpenerId:openerId},()=>{
  document.getElementById('mf-d03-drawer-close')?.focus();
 });
}
function mfD03CloseDrawer(app:any):void{
 const opener=app.state.mfD03OpenerId;
 app.setState({mfD03Drawer:null,mfD03OpenerId:null},()=>{
  if(opener)document.getElementById(opener)?.focus();
 });
}
function mfD03Go(app:any,action:string):void{
 mfD03CloseDrawer(app);
 if(action==='review'){void categoryReviewOpen(app);return;}
 if(action==='transactions'){app.navigate('review');return;}
 if(action==='budgets'||action==='planning'||action==='simulator'){app.navigate(action);return;}
 if(action==='chat'){intelligenceOpenFullChat(app);return;}
}
function mfD03SignalCard(app:any,s:MfD03Signal):any{
 const id='mf-d03-signal-'+s.id;
 return h('article',{key:s.id,className:'mf-d03-signal',role:'group','aria-label':s.title},
  h('div',{className:'mf-d03-signal-head'},
   h('span',{className:'mf-d03-symbol','aria-hidden':'true'},
    h(Icon,{name:s.kind==='commitment'?'calendar':s.kind==='budget'?'pie':s.kind==='review'?'filter':'spark',size:18})),
   h('span',{className:'mf-d03-kind'},s.kind==='budget'?'ORÇAMENTO':
    s.kind==='commitment'?'AGENDA':s.kind==='review'?'MOVIMENTAÇÕES':'REVISÃO')),
  h('h3',{},s.title),
  Number.isSafeInteger(s.amountCents)?h('div',{className:'mf-d03-signal-value'},
   h('strong',{},intelligencePremiumMoney(s.amountCents)),
   h('small',{},s.meaning)):h('small',{className:'mf-d03-signal-meaning'},s.meaning),
  h('p',{},s.detail),
  h('button',{id,type:'button',className:'mf-d03-signal-action',
    onClick:()=>mfD03OpenDrawer(app,s,id)},s.actionLabel,h(Icon,{name:'arrow',size:14})));
}
function mfD03ContextDrawer(app:any):any{
 const d=app.state.mfD03Drawer;if(!d)return null;
 const trap=(e:any)=>{
  if(e.key==='Escape'){e.preventDefault();mfD03CloseDrawer(app);return;}
  if(e.key!=='Tab')return;
  const root=document.getElementById('mf-d03-drawer');
  const focusable=Array.from(root?.querySelectorAll('button:not(:disabled),[tabindex="0"]')||[]) as HTMLElement[];
  if(!focusable.length)return;
  const i=focusable.indexOf(document.activeElement as HTMLElement);
  if(e.shiftKey&&i<=0){e.preventDefault();focusable[focusable.length-1].focus();}
  else if(!e.shiftKey&&i===focusable.length-1){e.preventDefault();focusable[0].focus();}
 };
 return h('div',{className:'mf-d03-backdrop',onClick:()=>mfD03CloseDrawer(app)},
  h('aside',{id:'mf-d03-drawer',className:'mf-d03-drawer',role:'dialog','aria-modal':'true',
   'aria-labelledby':'mf-d03-drawer-title',tabIndex:-1,onKeyDown:trap,
   onClick:(e:any)=>e.stopPropagation()},
   h('div',{className:'mf-d03-drawer-top'},
    h('span',{className:'mf-d03-kicker'},'EXPLORAR SINAL'),
    h('button',{id:'mf-d03-drawer-close',type:'button',className:'ghost-button',onClick:()=>mfD03CloseDrawer(app)},'Fechar')),
   h('h3',{id:'mf-d03-drawer-title'},d.title),
   h('p',{},d.detail),
   Number.isSafeInteger(d.amountCents)?h('div',{className:'mf-d03-drawer-amount'},
    h('strong',{},intelligencePremiumMoney(d.amountCents)),h('span',{},d.meaning)):null,
   d.sourceCard?intelligencePremiumEvidence(d.sourceCard):
     h('small',{className:'mf-premium-evidence'},'Projeção pessoal não disponível neste contrato de leitura.'),
   h('p',{className:'mf-d03-drawer-caution'},
    'Ação informativa: nenhum saldo é movimentado e nenhuma proposta da IA aplica alterações financeiras.'),
   h('div',{className:'mf-d03-drawer-actions'},
    h('button',{type:'button',className:'primary-button',onClick:()=>mfD03Go(app,d.action)},d.actionLabel),
    h('button',{type:'button',className:'ghost-button',onClick:()=>mfD03Go(app,'chat')},'Conversar sobre isso'))));
}
function renderMfD03Today(app:any):any{
 const s=app.state;
 const signature=intelligencePremiumSignature(app);
 const report=s.intelligencePremiumSignature===signature?s.intelligencePremiumReport:null;
 const live=mfD03EligibleReport(report,app);
 const signals=live?mfD03Signals(report,app):[];
 const pending=!!s.intelligencePremiumLoading;
 const period=s.localFinancialMonth||s.month;
 return h('section',{className:'mf-d03-today',role:'region','aria-label':'Inteligência Hoje'},
  h('header',{className:'mf-d03-top'},
   h('div',{},h('span',{className:'mf-d03-kicker'},'INTELIGÊNCIA HOJE · '+period),
     h('h2',{},'O que merece sua atenção?'),
     h('p',{},live?
      'Prioridades calculadas dos registros autorizados. Você decide o próximo passo.':
      'Autorize os registros para receber prioridades financeiras com evidência, sem números estimados.')),
   h('div',{className:'mf-d03-toolbar'},
    h('button',{id:'mf-d03-adjust',type:'button',className:'ghost-button',
      onClick:()=>mfD03OpenDrawer(app,null,'mf-d03-adjust')},'Ajustar previsão'),
    h('button',{id:'mf-d03-chat',type:'button',className:'primary-button',
      onClick:()=>intelligenceOpenFullChat(app)},'Conversar'),
    h('button',{type:'button',className:'ghost-button',disabled:pending,
      onClick:()=>void intelligencePremiumLoad(app)},pending?'Consultando…':'Atualizar'))),
  h('div',{className:'mf-d03-hero'},
   h('small',{},'SEU CONTEXTO FINANCEIRO'),
   h('h3',{},!live?'Uma visão clara começa com dados autorizados.':
     signals.length?'Estes são os assuntos mais relevantes do período.':'Nenhum alerta confirmado nos registros consultados.'),
   h('p',{},'O resultado do mês não é saldo bancário. Projeções de disponibilidade e sugestões de reserva permanecem indisponíveis sem saldo e compromissos verificados no mesmo escopo.')),
  s.intelligencePremiumError?h('p',{role:'alert',className:'mf-ai-error'},s.intelligencePremiumError):null,
  pending?h('div',{role:'status',className:'mf-d03-loading'},'Atualizando prioridades com dados locais…'):null,
  h('div',{className:'mf-d03-layout'},
   h('div',{className:'mf-d03-signals','aria-label':'Prioridades deste período'},
    ...signals.map((signal:MfD03Signal)=>mfD03SignalCard(app,signal)),
    !signals.length?h('div',{className:'mf-d03-no-signals',role:'status'},
      h('h3',{},live?'Sem prioridades críticas comprovadas.':'Sem leitura financeira habilitada.'),
      h('p',{},live?'A ausência de alertas locais não confirma ausência de despesas futuras.':
       'Abra Permissões de consulta acima, autorize uma fonte e atualize esta visão.')):null),
   h('aside',{className:'mf-d03-side','aria-label':'Agenda e revisão'},
    h('section',{className:'mf-d03-side-card'},
     h('h3',{},'Próximos compromissos'),
     signals.some((x:MfD03Signal)=>x.kind==='commitment')?
      h('p',{},'Total confirmado pelo Planejamento autorizado para o próximo período. Datas individuais devem ser consultadas na agenda.'):
      h('p',{},'Agenda detalhada indisponível ou sem compromissos confirmados nesta consulta.'),
     h('button',{type:'button',className:'mf-d03-side-link',onClick:()=>app.navigate('planning')},'Abrir Planejamento')),
    h('section',{className:'mf-d03-side-card'},
     h('h3',{},'Revisar decisões'),
     h('p',{},'Examine sugestões e movimentações. Revisões pessoais pela IA permanecem somente em prévia.'),
     h('button',{type:'button',className:'mf-d03-side-link',onClick:()=>void categoryReviewOpen(app)},'Central de Revisão')))),
  h('footer',{className:'mf-d03-footer'},
   h('span',{},'Uma conversa continua de onde você parou.'),
   h('button',{type:'button',className:'mf-d03-side-link',onClick:()=>intelligenceOpenFullChat(app)},'Abrir conversa')),
  mfD03ContextDrawer(app));
}
