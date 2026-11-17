/* QA-84 B05 Plano V5. Opportunities and amounts derive ONLY from
 * live authorized IC cards; experiments never mutate ledger/SQLite. */
function mfB05ActionSignals(app) {
 const report=app.state.intelligencePremiumReport;
 return mfD03EligibleReport(report,app)?mfD03Signals(report,app):[];
}
function mfB05ActionBudget(signal) {
 if(!signal||signal.kind!=='budget')return null;
 const list=Array.isArray(signal.sourceCard?.budgets)?signal.sourceCard.budgets:[];
 const matched=list.find(b=>signal.title.endsWith(String(b.category||'')));
 const b=matched; // Do not simulate a different category when the signal cannot be matched.
 if(!b||typeof b.category!=='string')return null;
 const values=mfB05Budget(b.spentCents,b.limitCents);
 return values?{...values,category:b.category}:null;
}
function mfB05ActionSnapshotKey(app,signal,budget) {
 const c=signal?.sourceCard,report=app.state.intelligencePremiumReport;
 return JSON.stringify([intelligencePremiumSignature(app),report?.snapshotVersion||'',
  report?.asOf||'',c?.asOf||'',c?.period?.start||'',c?.period?.end||'',
  signal?.id||'',signal?.sourceId||'',budget?.category||'',
  budget?.spentCents??null,budget?.limitCents??null]);
}
function mfB05ActionStage(app,step) {
 if(!['understand','simulate','review'].includes(step))return;
 const current=mfB05ActionSignals(app).find(x=>x.id===app.state.mfB05ActionId)||
  mfB05ActionSignals(app)[0]||null;
 const key=mfB05ActionSnapshotKey(app,current,mfB05ActionBudget(current));
 const stale=!!app.state.mfB05ActionSourceSig&&app.state.mfB05ActionSourceSig!==key;
 if(stale) {
  app.setState({mfB05ActionStage:step==='review'?'understand':step,
   mfB05ActionSourceSig:null,mfB05ActionPreviewCents:null});
  return;
 }
 app.setState({mfB05ActionStage:step});
}
function mfB05ActionFocus(app,signal) {
 app.setState({mfB05ActionId:signal.id,mfB05ActionStage:'understand',
  mfB05ActionPreviewCents:null,mfB05ActionSourceSig:null});
}
function mfB05ActionVisual(app,signal,budget,signature) {
 if(signal.kind==='budget'&&budget){
  const valid=app.state.mfB05ActionSourceSig===signature;
  const proposed=valid&&Number.isSafeInteger(app.state.mfB05ActionPreviewCents)?
    app.state.mfB05ActionPreviewCents:budget.limitCents;
  const simulated=mfB05Budget(budget.spentCents,proposed);
  const usage=simulated?.usagePercent;
  return h('div',{className:'mf-b05-plan-visual',role:'group','aria-label':'Orçamento da categoria'},
    h('div',{className:'mf-b05-plan-orbit',style:{'--mf-b05-progress':Math.min(100,usage||0)+'%'}},
     h('small',{},'GASTO VERIFICADO'),h('strong',{},mfB05Money(budget.spentCents)),
     h('span',{},usage===null?'Limite explícito: R$ 0,00':Math.round(usage)+'% do limite simulado')),
    h('div',{className:'mf-b05-plan-parts'},
     h('span',{},'Limite atual'),h('strong',{},mfB05Money(budget.limitCents)),
     h('span',{},'Limite no cenário'),h('strong',{},mfB05Money(proposed)),
     h('span',{},'Excesso hipotético'),h('strong',{className:simulated.excessCents>0?'mf-b05-negative':''},
       mfB05Money(simulated.excessCents))),
    h('small',{},'O gasto registrado permanece igual. Ajustar este cenário não modifica o orçamento.'));
 }
 return h('div',{className:'mf-b05-plan-visual mf-b05-plan-readonly'},
  h(Icon,{name:signal.kind==='commitment'?'calendar':'shield',size:32}),
  Number.isSafeInteger(signal.amountCents)?h('strong',{},mfB05Money(signal.amountCents)):null,
  h('p',{},signal.kind==='commitment'?'Valor comprometido no planejamento; não é o saldo disponível.':
    'Há registros que merecem revisão. Nenhuma alteração será aplicada automaticamente.'),
  h('small',{},'Fluxo de caixa futuro exige saldo e agenda reconciliados antes de desenhar suas fatias.'));
}
function renderMfB05Actions(app,proposals) {
 const s=app.state,signals=mfB05ActionSignals(app),
  items=Array.isArray(proposals)?proposals:[],
  selected=signals.find(x=>x.id===s.mfB05ActionId)||signals[0]||null,
  budget=mfB05ActionBudget(selected),
  signature=mfB05ActionSnapshotKey(app,selected,budget),
  scenarioStale=!!s.mfB05ActionSourceSig&&s.mfB05ActionSourceSig!==signature,
  stage=scenarioStale?'understand':
   ['understand','simulate','review'].includes(s.mfB05ActionStage)?s.mfB05ActionStage:'understand';
 return h('section',{className:'mf-b05-plan',role:'region','aria-label':'Plano de Ação'},
  h('header',{className:'mf-b05-plan-head'},
   h('span',{className:'mf-b05-kicker'},'INTELLIGENCE ALIVE · PLANO DE AÇÃO'),
   h('h2',{},'Decisões melhores começam com clareza.'),
   h('p',{},'Entenda o fato, teste possibilidades e revise antes de qualquer decisão.')),
  s.autoCategory?.available&&s.autoCategory?.enabled?.length?
  h('aside',{className:'mf-b05-auto-status',role:'status'},
   h('strong',{},'Categorização automática local autorizada'),
   h('p',{},String(s.autoCategory.autoClassified||0)+' decisões registradas · '+String(s.autoCategoryReview?.total??'—')+' pendências de revisão. Sem categorização forçada.'),
   h('button',{type:'button',className:'ghost-button',onClick:()=>app.navigate('banks')},'Gerenciar contas e autorizações')):null,
  !selected&&!items.length?h('div',{className:'mf-b05-plan-empty',role:'status'},
   h(Icon,{name:'shield',size:28}),
   h('h3',{},'Nenhuma oportunidade verificável disponível.'),
   h('p',{},'Autorize a leitura, atualize o período ou converse sobre organização financeira. Não criamos recomendações pessoais sem fatos.'),
   h('button',{type:'button',className:'primary-button',onClick:()=>mfB05ChangeMode(app,'chat')},'Abrir Conversar')):null,
  selected?h('div',{className:'mf-b05-plan-layout'},
   h('article',{className:'mf-b05-plan-feature'},
    h('div',{className:'mf-b05-plan-feature-head'},
     h('span',{},'FOCO PRINCIPAL · '+(selected.kind==='budget'?'ORÇAMENTO':
      selected.kind==='commitment'?'AGENDA':selected.kind==='review'?'REVISÃO':'REGRAS')),
     h('span',{className:'mf-b05-plan-chip'},'Dado autorizado')),
    h('h3',{},selected.title),
    h('p',{},selected.detail),
    mfB05ActionVisual(app,selected,budget,signature),
    h('div',{className:'mf-b05-steps',role:'tablist','aria-label':'Etapas da decisão'},
     ...[{id:'understand',label:'Entender'},{id:'simulate',label:'Simular'},{id:'review',label:'Revisar'}]
      .map(x=>h('button',{key:x.id,type:'button',role:'tab','aria-selected':stage===x.id,
       className:stage===x.id?'is-active':'',onClick:()=>mfB05ActionStage(app,x.id)},x.label))),
    h('div',{className:'mf-b05-stage',role:'tabpanel','aria-live':'polite'},
     stage==='understand'?h('div',{},
      h('h4',{},'O que os registros mostram'),
      scenarioStale?h('p',{className:'mf-b05-warning',role:'alert'},'Os dados do cenário mudaram. A prévia foi invalidada; faça uma nova simulação.'):null,
      h('p',{},selected.meaning+' · '+selected.detail),
      intelligencePremiumEvidence(selected.sourceCard),
      h('button',{type:'button',className:'primary-button',onClick:()=>mfB05ActionStage(app,'simulate')},'Explorar cenário')):null,
     stage==='simulate'?h('div',{},
      h('h4',{},'Experimente sem alterar seus dados'),
      budget?h('div',{className:'mf-b05-simulator'},
       h('label',{htmlFor:'mf-b05-budget-slider'},'Limite hipotético de '+budget.category),
       h('input',{id:'mf-b05-budget-slider',type:'range',min:0,
        max:Math.max(100,Math.min(100000,Math.ceil(Math.max(budget.limitCents,budget.spentCents)/100)*2)),
        step:1,value:Math.round((s.mfB05ActionSourceSig===signature&&
        Number.isSafeInteger(s.mfB05ActionPreviewCents)?s.mfB05ActionPreviewCents:budget.limitCents)/100),
        onChange:(e)=>app.setState({mfB05ActionSourceSig:signature,
          mfB05ActionPreviewCents:Number(e.target.value)*100})}),
       h('p',{},'A hipótese altera apenas a visualização. O gasto realizado e o limite cadastrado não mudam.')):
       h('p',{},'Este tipo de sinal ainda não possui uma simulação verificável no contrato atual. Nenhuma mudança foi preparada.'),
      h('button',{type:'button',className:'primary-button',onClick:()=>mfB05ActionStage(app,'review')},'Revisar cenário')):null,
     stage==='review'?h('div',{},
      h('h4',{},'Sua revisão, sem aplicação automática'),
      h('dl',{className:'mf-b05-plan-review'},
       h('dt',{},'Fonte'),h('dd',{},selected.sourceId),
       h('dt',{},'Escopo'),h('dd',{},s.localFinancialMonth||s.month||'Período consultado'),
       budget?h('dt',{},'Limite original'):null,
       budget?h('dd',{},mfB05Money(budget.limitCents)):null,
       budget?h('dt',{},'Limite hipotético'):null,
       budget?h('dd',{},mfB05Money(s.mfB05ActionSourceSig===signature&&
        Number.isSafeInteger(s.mfB05ActionPreviewCents)?s.mfB05ActionPreviewCents:budget.limitCents)):null),
      h('p',{className:'mf-b05-warning'},'Não há capacidade autorizada para aplicar esta simulação pela Inteligência. O SQLite permanece inalterado.'),
      h('button',{type:'button',className:'ghost-button',onClick:()=>mfB05ActionStage(app,'understand')},'Voltar ao entendimento'),
      h('button',{type:'button',className:'primary-button',onClick:()=>selected.action==='review'?void categoryReviewOpen(app):app.navigate(selected.action),
       disabled:selected.action==='review'&&!s.categoryReviewGrant?.token},
       selected.action==='review'?'Abrir revisão supervisionada':'Consultar módulo de origem')):null)),
   h('aside',{className:'mf-b05-plan-alternatives'},
    h('h3',{},'Outras oportunidades'),
    ...signals.filter(x=>x.id!==selected.id).map(x=>
     h('button',{type:'button',key:x.id,className:'mf-b05-alternative',
      onClick:()=>mfB05ActionFocus(app,x)},
      h('strong',{},x.title),h('span',{},x.meaning),h(Icon,{name:'arrow',size:15}))),
    signals.length===1?h('p',{},'Outras oportunidades aparecerão quando houver evidências.'):null)):null,
  items.length?h('section',{className:'mf-b05-plan-proposals','aria-label':'Propostas existentes da sessão'},
   h('h3',{},'Prévia e revisão supervisionada'),
   h('p',{},'As propostas abaixo usam o mecanismo já existente. Nenhum botão deste plano autoriza escrita pessoal.'),
   ...items.map(p=>renderIntelligenceActionProposalCard(app,p))):null);
}
