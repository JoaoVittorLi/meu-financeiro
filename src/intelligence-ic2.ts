/* RC-ALL-01: IC2-READ-QUERY presentation adapter. No model, HTML or ledger
 * calculation; facts come only from the versioned read-only Electron IPC. */
type MfIC2Reply={version:2;contract:'I2-A/D02-V3';readOnly:true;changesApplied:false;
 modelCalled:false;status:string;answer:string;conversationId:string;source:'bank'|'manual';
 profile:'real'|'demo';period:string;facts:any[];blocks:any[];alerts:string[];actions:any[];
 followUps:any[];contextReset:boolean};
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
