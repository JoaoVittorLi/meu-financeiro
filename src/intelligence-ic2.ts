/* RC-ALL-01: IC2-READ-QUERY presentation adapter. No model, HTML or ledger
 * calculation; facts come only from the versioned read-only Electron IPC. */
type MfIC2Reply={version:2;contract:'I2-A/D02-V3';readOnly:true;changesApplied:false;
 modelCalled:false;status:string;answer:string;conversationId:string;source:'bank'|'manual';
 profile:'real'|'demo';period:string;density?:string;facts:any[];blocks:any[];alerts:string[];actions:any[];
 followUps:any[];evidence?:any[];contextReset:boolean};
function mfIC2Valid(r:any,access:LocalFinancialAccess,month:string):r is MfIC2Reply{
 if(!r||r.version!==2||r.contract!=='I2-A/D02-V3'||
    r.readOnly!==true||r.changesApplied!==false||r.modelCalled!==false||
    r.source!==access?.source||r.profile!==access?.profile||r.period!==month||
    typeof r.answer!=='string'||r.answer.length>4000||
    typeof r.conversationId!=='string'||
    !Array.isArray(r.facts)||r.facts.length>4||
    !Array.isArray(r.blocks)||r.blocks.length>3||
    !Array.isArray(r.actions)||r.actions.length!==0||
    !Array.isArray(r.alerts)||!Array.isArray(r.followUps)||
    !['ready','partial','denied','stale','unavailable','needs_clarification','unsupported'].includes(r.status))
  return false;
 const ids=new Set<string>();
 for(const f of r.facts){
  if(f?.version!==2||typeof f.id!=='string'||!f.id.startsWith('i2a:')||
     f.source!==access.source||f.profile!==access.profile||
     f.period?.start?.slice(0,7)!==month||f.period?.end?.slice(0,7)!==month||
     !f.value||typeof f.value!=='object')return false;
  ids.add(f.id);
 }
 return r.blocks.every((b:any)=>b&&typeof b.kind==='string'&&
   (b.factRef===null||ids.has(b.factRef)));
}
function mfIC2Card(r:MfIC2Reply):IntelligenceStructuredCard|null{
 if(!['ready','partial'].includes(r.status)||!r.facts.length)return null;
 const money=(v:any)=>Number.isSafeInteger(v)?
   new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100):'Sem evidência';
 const metrics:{label:string;value:string;tone?:'neutral'|'positive'|'warning'}[]=[];
 const rows:{col1:string;col2:string;col3?:string}[]=[];
 let title='Leitura financeira verificada';
 let headers:[string,string,string?]=['Fato','Valor'];
 for(const fact of r.facts){
  const f=fact.value||{};
  if(fact.tool==='summary'||fact.tool==='categories'){
   title=fact.tool==='categories'?'Gastos na categoria':'Resumo financeiro do mês';
   if(Number.isSafeInteger(f.incomeCents))metrics.push({label:'Receitas',value:money(f.incomeCents)});
   if(Number.isSafeInteger(f.expenseCents))metrics.push({label:'Despesas',value:money(f.expenseCents)});
   if(fact.tool==='categories'&&Number.isSafeInteger(f.selectedCents))
     metrics.push({label:'Categoria selecionada',value:money(f.selectedCents)});
   for(const c of (Array.isArray(f.categories)?f.categories:[]).slice(0,12))
    if(typeof c.name==='string'&&Number.isSafeInteger(c.amountCents))
     rows.push({col1:c.name.slice(0,100),col2:money(c.amountCents)});
  }else if(fact.tool==='compare_spending_breakdown'){
   title='Investigação das despesas';
   if(Number.isSafeInteger(f.previousCents))metrics.push({label:'Anterior',value:money(f.previousCents)});
   if(Number.isSafeInteger(f.currentCents))metrics.push({label:'Atual',value:money(f.currentCents)});
   if(Number.isSafeInteger(f.deltaCents))metrics.push({label:'Variação',value:money(f.deltaCents),
     tone:f.deltaCents>0?'warning':'neutral'});
   headers=['Categoria','Anterior / atual','Variação'];
   for(const x of (Array.isArray(f.contributions)?f.contributions:[]).slice(0,12))
    if(typeof x.label==='string'&&Number.isSafeInteger(x.deltaCents))
     rows.push({col1:x.label.slice(0,100),
       col2:money(x.previousCents)+' / '+money(x.currentCents),col3:money(x.deltaCents)});
  }else if(fact.tool==='compare'){
   title='Comparação com o mês anterior';
   if(Number.isSafeInteger(f.deltaExpenseCents))
    metrics.push({label:'Variação de despesas',value:money(f.deltaExpenseCents),tone:f.deltaExpenseCents>0?'warning':'neutral'});
   headers=['Categoria','Atual / anterior','Variação'];
   for(const x of (Array.isArray(f.rank)?f.rank:[]).slice(0,12))
    if(typeof x.category==='string')
     rows.push({col1:x.category.slice(0,100),col2:money(x.nowCents)+' / '+money(x.previousCents),col3:money(x.deltaCents)});
  }else if(fact.tool==='merchants'){
   title='Estabelecimentos nos registros locais';
   headers=['Estabelecimento','Gasto atual','Variação'];
   for(const m of (Array.isArray(f.merchants)?f.merchants:[]).slice(0,12))
    if(typeof m.merchant==='string')
     rows.push({col1:m.merchant.slice(0,100),col2:money(m.amountCents),col3:money(m.deltaCents)});
  }else if(fact.tool==='budgets'){
   title='Orçamentos registrados';
   headers=['Categoria','Gasto','Limite'];
   for(const b of (Array.isArray(f.budgets)?f.budgets:[]).slice(0,12))
    if(typeof b.category==='string')
     rows.push({col1:b.category.slice(0,100),col2:money(b.spentCents),col3:money(b.limitCents)});
  }else if(fact.tool==='commitments'){
   title='Compromissos confirmados';
   if(Number.isSafeInteger(f.commitments?.totalCents))
    metrics.push({label:'Total restante planejado',value:money(f.commitments.totalCents)});
  }else if(fact.tool==='simulate'){
   title='Simulação hipotética, sem lançamento';
   if(Number.isSafeInteger(f.hypotheticalSavingsCents))
    metrics.push({label:'Economia hipotética',value:money(f.hypotheticalSavingsCents)});
  }else if(fact.tool==='quality'){
   title='Qualidade dos dados consultados';
   if(Number.isSafeInteger(f.loaded))metrics.push({label:'Registros carregados',value:String(f.loaded)});
  }else if(fact.tool==='recommend_savings'){
   title='Oportunidades de economia (sem dupla contagem)';
   if(Number.isSafeInteger(f.targetCents))metrics.push({label:'Meta informada',value:money(f.targetCents)});
   if(Number.isSafeInteger(f.maxIndependentSavingsCents))
    metrics.push({label:'Espaço independente',value:money(f.maxIndependentSavingsCents),tone:f.targetVerified?'positive':'warning'});
   headers=['Grupo / categoria','Gasto atual','Redução sugerida'];
   for(const opp of (Array.isArray(f.opportunities)?f.opportunities:[]).slice(0,12))
    if(typeof opp.categoryLabel==='string')
     rows.push({col1:opp.categoryLabel.slice(0,100),col2:money(opp.currentCents),col3:money(opp.minSaveCents)+' – '+money(opp.maxSaveCents)});
  }else if(fact.tool==='detect_recurring_candidates'){
   title='Candidatos recorrentes e hábitos';
   if(Number.isSafeInteger(f.estimatedMonthlyTotalCents))
    metrics.push({label:'Faixa mensal observada',value:money(f.estimatedMonthlyTotalCents)});
   if(Number.isSafeInteger(f.priceHikeCount)&&f.priceHikeCount>0)
    metrics.push({label:'Reajustes detectados',value:String(f.priceHikeCount),tone:'warning'});
   headers=['Descrição','Meses / certeza','Último valor'];
   for(const c of (Array.isArray(f.candidates)?f.candidates:[]).slice(0,12))
    if(typeof c.merchant==='string')
     rows.push({col1:c.merchant.slice(0,100),
      col2:(c.observedMonths?.length||0)+' meses · '+(c.certainty==='strong_candidate'?'forte':'candidato'),
      col3:money(c.latestCents)});
  }else if(fact.tool==='simulate_purchase'){
   title='Simulação de decisão · somente leitura';
   if(Number.isSafeInteger(f.principalCents))metrics.push({label:'Principal',value:money(f.principalCents)});
   if(Number.isSafeInteger(f.totalCents))metrics.push({label:'Total simulado',value:money(f.totalCents)});
   if(Number.isSafeInteger(f.minimumAfterPurchaseCents))
    metrics.push({label:'Saldo mínimo após',value:money(f.minimumAfterPurchaseCents),tone:f.risk==='risk'?'warning':'positive'});
   headers=['Parcela / data','Valor','Cenário'];
   for(const s of (Array.isArray(f.schedule)?f.schedule:[]).slice(0,12))
    rows.push({col1:String(s.date||''),col2:money(s.amountCents??s.amount),col3:(f.installments||1)+'x'});
  }
 }
 const warnings=r.alerts.filter(x=>typeof x==='string').slice(0,3).map(x=>x.slice(0,220));
 const notice=r.status==='partial'?'Cobertura parcial; os valores não representam o histórico integral.':'Fatos calculados localmente a partir da origem autorizada.';
 return {title,subtitle:r.period+' · '+(r.source==='bank'?'Banco':'Manual')+
   ' · '+(r.profile==='demo'?'Demonstração':'Pessoal'),
   metrics:metrics.slice(0,4),rows:rows.slice(0,12),headers,
   footnote:[notice,'Resultado mensal não equivale ao saldo disponível.',...warnings].join(' ')};
}
/* Session-only metadata: the IC2 result must not outlive its original grant.
 * Copying/restoring a chat message never recovers authorization. */
const MF_IC2_MESSAGE_GRANTS=new WeakMap<IntelligenceChatMessage,{
 access:LocalFinancialAccess;token:string;signature:string;month:string
}>();
function mfIC2BindMessage(msg:IntelligenceChatMessage,access:LocalFinancialAccess,signature:string,month:string){
 if(access?.token)MF_IC2_MESSAGE_GRANTS.set(msg,{access,token:access.token,signature,month});
 return msg;
}
function mfIC2MessageLive(app:any,msg:IntelligenceChatMessage):boolean{
 const b=MF_IC2_MESSAGE_GRANTS.get(msg),access:LocalFinancialAccess=app.state.localFinancialAccess;
 return !!b&&b.access===access&&b.token===access?.token&&
  b.signature===intelligencePremiumSignature(app)&&
  b.month===(app.state.localFinancialMonth||app.state.month)&&
  access?.profile===(app.state.mode==='demo'?'demo':'real')&&
  Number.isFinite(access.expiresAt)&&access.expiresAt>Date.now();
}


/* Marco 2 — Adaptive Response Renderer for IC2 (self-contained, isolated-eval safe). */
function mfIC2AdaptiveDensity(app:any,msg:any):'compact'|'standard'|'analysis'|'mobile'{
 if(app?.state?.mfV3AnalysisMessageId===msg?.id)return 'analysis';
 if(app?.state?.intelligencePanelOpen)return 'compact';
 if(typeof window!=='undefined'&&window.innerWidth<720)return 'mobile';
 return 'standard';
}
function mfIC2Money(cents:any):string{
 return Number.isSafeInteger(cents)?
  new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100):'Sem evidência';
}
function mfIC2AdaptiveModel(r:MfIC2Reply,density:string='standard'){
 if(!r||!['ready','partial'].includes(r.status)||!Array.isArray(r.facts)||!r.facts.length)return null;
 const card=mfIC2Card(r);
 if(!card)return null;
 const primary=r.facts[0],val=primary?.value||{},tool=String(primary?.tool||'');
 const maxMetrics=density==='compact'?2:4;
 const maxRows=density==='analysis'?25:density==='compact'?5:10;
 const epistemic=r.status==='partial'?{tone:'partial',label:'Fato · cobertura parcial'}:
  tool==='simulate_purchase'||tool==='simulate'?{tone:'simulation',label:'Simulação hipotética'}:
  tool==='recommend_savings'?{tone:'estimate',label:'Estimativa anti-dupla-contagem'}:
  tool==='detect_recurring_candidates'?{tone:'estimate',label:'Hipótese · confirmar assinatura'}:
  {tone:'fact',label:'Fato verificado'};
 const visualRows:Array<{label:string;categoryId?:string|null;subcategoryId?:string|null;col2:string;col3?:string;barPct:number|null;barUp:boolean;pill?:string|null}>=[];
 const supplementary:Array<{kind:string;title:string;items:any[];note?:string}>=[];
 if(tool==='compare_spending_breakdown'){
  const contribs=Array.isArray(val.contributions)?val.contributions:[];
  const maxAbs=Math.max(1,...contribs.map((c:any)=>Math.abs(c.deltaCents||0)));
  for(const c of contribs.slice(0,maxRows)){
   const d=Number.isSafeInteger(c.deltaCents)?c.deltaCents:0;
   visualRows.push({
    label:String(c.label||'Categoria').slice(0,100),
    categoryId:c.categoryId||null,subcategoryId:c.subcategoryId||null,
    col2:mfIC2Money(c.previousCents)+' / '+mfIC2Money(c.currentCents),
    col3:(d>0?'+':'')+mfIC2Money(d),
    barPct:Math.min(100,Math.round(Math.abs(d)/maxAbs*100)),
    barUp:d>0
   });
  }
  if(density==='analysis'&&Array.isArray(val.merchants)&&val.merchants.length){
   supplementary.push({
    kind:'merchants',
    title:'Estabelecimentos normalizados no período',
    items:val.merchants.slice(0,8).map((m:any)=>({
     label:String(m.merchant||'Não identificado').slice(0,90),
     col2:mfIC2Money(m.previousCents)+' → '+mfIC2Money(m.currentCents),
     col3:String(m.previousCount||0)+' → '+String(m.currentCount||0)+'x'
    }))
   });
  }
 }else if(tool==='recommend_savings'){
  const opps=Array.isArray(val.opportunities)?val.opportunities:[];
  const maxSave=Math.max(1,...opps.map((o:any)=>o.maxSaveCents||0));
  for(const o of opps.slice(0,maxRows)){
   visualRows.push({
    label:String(o.categoryLabel||'Grupo').slice(0,100),
    categoryId:o.categoryId||null,subcategoryId:o.subcategoryId||null,
    col2:mfIC2Money(o.currentCents),
    col3:mfIC2Money(o.minSaveCents)+' – '+mfIC2Money(o.maxSaveCents),
    barPct:Math.min(100,Math.round((o.maxSaveCents||0)/maxSave*100)),
    barUp:false,
    pill:o.independentIncluded?'Independente':'Sobreposição evitada'
   });
  }
  if(Array.isArray(val.scenarios)&&val.scenarios.length){
   supplementary.push({
    kind:'scenarios',
    title:'Cenários graduais (grupos independentes)',
    items:val.scenarios.slice(0,3)
   });
  }
 }else if(tool==='detect_recurring_candidates'){
  const cands=Array.isArray(val.candidates)?val.candidates:[];
  const maxEst=Math.max(1,...cands.map((c:any)=>c.estimatedMonthlyCents||0));
  for(const c of cands.slice(0,maxRows)){
   visualRows.push({
    label:String(c.merchant||'Recorrente').slice(0,100),
    categoryId:c.categoryId||null,subcategoryId:c.subcategoryId||null,
    col2:(c.observedMonths?.length||0)+' meses · anual '+mfIC2Money(c.estimatedAnnualMinCents)+'–'+mfIC2Money(c.estimatedAnnualMaxCents),
    col3:mfIC2Money(c.latestCents)+'/mês',
    barPct:Math.min(100,Math.round((c.estimatedMonthlyCents||0)/maxEst*100)),
    barUp:!!c.priceIncreased,
    pill:c.priceIncreased?'Reajuste +'+(mfIC2Money(c.priceDeltaCents)):c.certainty==='strong_candidate'?'Forte':null
   });
  }
  if(Array.isArray(val.habits)&&val.habits.length){
   supplementary.push({
    kind:'habits',
    title:'Hábitos frequentes observados',
    items:val.habits.slice(0,5)
   });
  }
 }else if(tool==='simulate_purchase'){
  for(const r0 of (card.rows||[]).slice(0,maxRows)){
   visualRows.push({label:r0.col1,col2:r0.col2,col3:r0.col3,barPct:null,barUp:false});
  }
  if(val.cashComparison||val.risk){
   supplementary.push({
    kind:'decision',
    title:'Comparativo à vista vs parcelado e limites do fluxo',
    items:[{
     cashTotalCents:val.cashComparison?.totalCents??val.principalCents,
     installmentsTotalCents:val.totalCents,
     interestCents:val.interestCents??0,
     installments:val.installments??1,
     minimumAfterPurchaseCents:val.minimumAfterPurchaseCents??null,
     worstDay:val.worstDay||null,
     risk:val.risk||'unknown',
     cashflowVerified:!!val.cashflowVerified
    }]
   });
  }
 }else{
  for(const r0 of (card.rows||[]).slice(0,maxRows)){
   visualRows.push({label:r0.col1,col2:r0.col2,col3:r0.col3,barPct:null,barUp:false});
  }
 }
 const evList=Array.isArray(r.evidence)?r.evidence:[];
 const rawIds=new Set<string>();
 for(const ev of evList)if(Array.isArray(ev?.sourceIds))for(const id of ev.sourceIds)if(typeof id==='string'&&id)rawIds.add(id);
 for(const c of (Array.isArray(val.contributions)?val.contributions:[]))if(Array.isArray(c?.evidenceIds))for(const id of c.evidenceIds)if(typeof id==='string'&&id)rawIds.add(id);
 for(const o of (Array.isArray(val.opportunities)?val.opportunities:[]))if(Array.isArray(o?.evidenceIds))for(const id of o.evidenceIds)if(typeof id==='string'&&id)rawIds.add(id);
 for(const c of (Array.isArray(val.candidates)?val.candidates:[]))if(Array.isArray(c?.evidenceIds))for(const id of c.evidenceIds)if(typeof id==='string'&&id)rawIds.add(id);
 const sampleIds=[...rawIds].slice(0,5);
 return {
  density,tool,card,epistemic,
  metrics:(card.metrics||[]).slice(0,maxMetrics),
  rows:visualRows,
  supplementary:supplementary.slice(0,2),
  blocks:(Array.isArray(r.blocks)?r.blocks:[]).slice(0,3),
  followUps:(Array.isArray(r.followUps)?r.followUps:[]).slice(0,3),
  evidenceSummary:{
   dataVersion:String(val.dataVersion||evList[0]?.dataVersion||'local').slice(0,16),
   method:String(val.method||evList[0]?.method||'shared/finance-period-ledger.mjs'),
   count:rawIds.size,
   sampleIds
  }
 };
}
function renderMfIC2Adaptive(app:any,msg:any){
 if(typeof h!=='function')return null;
 const r:MfIC2Reply=msg?.ic2Reply;
 if(!r||!mfIC2MessageLive(app,msg))return null;
 const density=mfIC2AdaptiveDensity(app,msg);
 const model=mfIC2AdaptiveModel(r,density);
 if(!model)return null;
 const expanded=density==='analysis';
 const catGlyph=(label:string,categoryId?:string|null,subcategoryId?:string|null)=>{
  if(typeof resolveCategoryVisualIdentity!=='function'||typeof CategoryVisualGlyph!=='function')return null;
  const identity=resolveCategoryVisualIdentity({categoryId:categoryId||null,subcategoryId:subcategoryId||null,categoryName:label,aggregate:!subcategoryId});
  return h(CategoryVisualGlyph,{identity,size:density==='compact'?16:18});
 };
 const navAction=model.tool==='simulate_purchase'&&typeof app?.navigate==='function'?
  h('button',{type:'button',className:'mf-ic2-toggle-btn',onClick:()=>app.navigate('simulator')},'Abrir Simular Compra'):null;
 return h('div',{className:'mf-ai-structured-card mf-ic2-adaptive mf-ic2-density-'+density,role:'region','aria-label':model.card.title},
  h('div',{className:'mf-ic2-adaptive-head'},
   h('div',{className:'mf-ic2-adaptive-title'},
    h('strong',{},model.card.title),
    model.card.subtitle?h('small',{},model.card.subtitle):null),
   h('div',{className:'mf-ic2-adaptive-controls'},
    h('span',{className:'mf-ic2-epistemic-badge is-'+model.epistemic.tone},model.epistemic.label),
    h('button',{type:'button',className:'mf-ic2-toggle-btn',
     onClick:()=>app.setState({mfV3AnalysisMessageId:expanded?null:msg.id})},
     expanded?'Recolher análise':'Explorar análise'))),
  model.metrics.length?h('div',{className:'mf-ai-structured-metrics'},
   ...model.metrics.map((m,idx)=>h('div',{key:idx,className:'mf-ai-structured-metric is-'+(m.tone||'neutral')},
    h('small',{},m.label),h('strong',{},m.value)))):null,
  model.rows.length?h('div',{className:'mf-ai-table-wrap'},
   h('table',{},
    model.card.headers?h('thead',{},h('tr',{},
     h('th',{},model.card.headers[0]),
     h('th',{},model.card.headers[1]),
     model.card.headers[2]?h('th',{},model.card.headers[2]):null)):null,
    h('tbody',{},
     ...model.rows.map((row,idx)=>h('tr',{key:idx},
      h('td',{},h('span',{className:'mf-ic2-cat-cell'},
       row.categoryId||row.subcategoryId?catGlyph(row.label,row.categoryId,row.subcategoryId):null,
       h('span',{},row.label),
       row.pill?h('span',{className:'mf-ic2-pill'+(row.barUp?' is-hike':'')},row.pill):null)),
      h('td',{},row.barPct===null?row.col2:h('div',{className:'mf-ic2-bar-cell'},
       h('span',{},row.col2),
       h('div',{className:'mf-ic2-bar-track','aria-hidden':'true'},
        h('span',{className:row.barUp?'is-up':'',style:{width:Math.max(4,row.barPct)+'%'}})))),
      row.col3!==undefined?h('td',{},row.col3):null))))):null,
  ...model.supplementary.map((blk,bIdx)=>{
   if(blk.kind==='scenarios'){
    return h('div',{key:bIdx,className:'mf-ic2-subblock'},
     h('span',{className:'mf-ic2-subblock-title'},blk.title),
     h('div',{className:'mf-ic2-scenario-grid'},
      ...blk.items.map((sc:any,i:number)=>h('div',{key:i,className:'mf-ic2-scenario-card'+(sc.goalReached?' is-target-met':'')},
       h('small',{},sc.label||sc.id||'Cenário'),
       h('strong',{},mfIC2Money(sc.saveCents)),
       h('span',{},sc.goalReached===true?'Atinge a meta':sc.goalReached===false?'Abaixo da meta':'Redução estimada')))));
   }
   if(blk.kind==='merchants'||blk.kind==='habits'){
    return h('div',{key:bIdx,className:'mf-ic2-subblock'},
     h('span',{className:'mf-ic2-subblock-title'},blk.title),
     h('div',{className:'mf-ai-table-wrap'},
      h('table',{},h('tbody',{},
       ...blk.items.map((it:any,i:number)=>h('tr',{key:i},
        h('td',{},String(it.label||it.merchant||'Item')),
        h('td',{},String(it.col2||(it.monthlyCountAvg?it.monthlyCountAvg+'x/mês':''))),
        h('td',{},String(it.col3||(it.avgTicketCents!==undefined?mfIC2Money(it.avgTicketCents):'')))
       ))
      ))
     )
    );
   }
   if(blk.kind==='decision'&&blk.items[0]){
    const d=blk.items[0];
    return h('div',{key:bIdx,className:'mf-ic2-subblock'},
     h('span',{className:'mf-ic2-subblock-title'},blk.title),
     h('div',{className:'mf-ic2-scenario-grid'},
      h('div',{className:'mf-ic2-scenario-card'},h('small',{},'À vista'),h('strong',{},mfIC2Money(d.cashTotalCents)),h('span',{},'Sem parcelamento')),
      h('div',{className:'mf-ic2-scenario-card'},h('small',{},d.installments+'x simulado'),h('strong',{},mfIC2Money(d.installmentsTotalCents)),h('span',{},'Juros: '+mfIC2Money(d.interestCents))),
      h('div',{className:'mf-ic2-scenario-card'},h('small',{},d.cashflowVerified?'Menor saldo':'Projeção'),h('strong',{},d.cashflowVerified?mfIC2Money(d.minimumAfterPurchaseCents):'Requer planejamento'),h('span',{},d.worstDay?'Data: '+d.worstDay:'Somente cálculo de parcelas'))),
     navAction);
   }
   return null;
  }),
  h('details',{className:'mf-ic2-evidence-disclosure'},
   h('summary',{},'Evidências verificadas ('+model.evidenceSummary.count+' registros citados · versão '+model.evidenceSummary.dataVersion+')'),
   h('div',{className:'mf-ic2-evidence-meta'},
    h('span',{},'Motor: '+model.evidenceSummary.method+' · Densidade: '+density),
    model.evidenceSummary.sampleIds.length?h('span',{},'Amostra de IDs: '+model.evidenceSummary.sampleIds.join(', ')):null)),
  model.followUps.length&&typeof intelligenceSubmitQuestion==='function'?h('div',{className:'mf-ic2-followups','aria-label':'Próximas investigações'},
   ...model.followUps.map((fu:any,i:number)=>h('button',{key:i,type:'button',className:'mf-ic2-followup-chip',
    onClick:()=>void intelligenceSubmitQuestion(app,fu.question||fu.label)},
    String(fu.label||fu.question||'Aprofundar')))):null,
  model.card.footnote?h('small',{className:'mf-ai-structured-foot'},model.card.footnote):null);
}
