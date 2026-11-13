'use strict';
// I2-A: question -> validated plan -> authorized ledger tools -> evidence-first visual reply.
// No model is allowed to supply monetary facts, write instructions or HTML.
const {FinancialReadTools,TOOL_NAMES}=require('./intelligence-tools.cjs');
const {ConversationContextStore}=require('./intelligence-context.cjs');
const {validatePlan}=require('./intelligence-provider.cjs');
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
const DENSITIES=['compact','standard','analysis','mobile'];
function localPlan(question,context,categories){
 const q=fold(question),list=[...new Set([...categories,...(context?.categoryNames||[])])];
 const found=list.find(name=>q.includes(fold(name)));
 const exclusion=/(?:desconsidere|ignore|ignorando|sem |tirando |excluindo )/.test(q);
 const excluded=exclusion?list.filter(name=>q.includes(fold(name))).map(fold):[];
 if(exclusion&&!excluded.length)return {status:'needs_clarification',
  message:'Quais categorias devo desconsiderar? Informe os nomes para recalcular.'};
 const filters=[...new Set([...(context?.exclusions||[]),...excluded])];
 const params={excludedCategories:filters};
 // Scope-safe follow-up: recompute from IC-READ, never reuse cached monetary results.
 if(exclusion&&context?.lastPlan){
  return {plan:validatePlan({steps:context.lastPlan.steps.map(s=>({tool:s.tool,
   params:{...s.params,excludedCategories:filters}}))}),exclusions:filters};
 }
 const percent=/\b(\d{1,3})\s*%/.exec(q);
 if(percent&&/(reduz|cort|econom|diminu|se eu)/.test(q))
  return found?{plan:validatePlan({steps:[{tool:'simulate',
    params:{...params,category:found,percent:Number(percent[1])}}]}),exclusions:filters}:
   {status:'needs_clarification',message:'Em qual categoria deseja simular a redução?'};
 if(/compr|consigo pagar|cabe no orcament|viabilidade/.test(q))
  return {plan:validatePlan({steps:[{tool:'summary',params},
   {tool:'commitments',params}]}),exclusions:filters,purchase:true};
 if(/estabelec|comerciante|loja|onde comprei/.test(q))
  return {plan:validatePlan({steps:context?.lastPlan?.steps?.some(s=>s.tool==='compare')?
   [{tool:'compare',params},{tool:'merchants',params}]:[{tool:'merchants',params}]}),exclusions:filters};
 if(/compar|aument|diminui|variac|por que|mes anterior|evolu/.test(q))
  return {plan:validatePlan({steps:[{tool:'compare',params}]}),exclusions:filters};
 if(/compromiss|venciment|contas futuras/.test(q))
  return {plan:validatePlan({steps:[{tool:'commitments',params}]}),exclusions:filters};
 if(/orcament|limite/.test(q))
  return {plan:validatePlan({steps:[{tool:'budgets',params}]}),exclusions:filters};
 if(/atualiz|cobertura|confiavel|qualidade/.test(q))
  return {plan:validatePlan({steps:[{tool:'quality',params}]}),exclusions:filters};
 if(/quanto|gastei|gasto|despesa|distribui|renda|receita|treemap|sankey|fluxo|maiores/.test(q))
  return {plan:validatePlan({steps:[{tool:found?'categories':'summary',
   params:{...params,...(found?{category:found}:{})}}]}),exclusions:filters,
   flowRequested:/renda|sankey|fluxo/.test(q)};
 return {status:'unsupported',message:'Ainda não há ferramenta segura para investigar essa pergunta. Tente um total, comparação, categoria, orçamento ou simulação.'};
}
function description(r){
 const f=r.facts||{};
 if(r.status==='stale')return 'A origem mudou durante a consulta. Atualize a autorização e refaça a pergunta.';
 if(r.status==='unavailable'||r.status==='needs_clarification')return r.warning||'Dados insuficientes para responder.';
 switch(r.tool){
  case 'summary':return 'Despesas '+money(f.expenseCents)+'; receitas '+money(f.incomeCents)+
   '. O resultado de '+money(f.netCents)+' não é saldo bancário disponível.';
  case 'categories':return 'Gasto verificado no filtro: '+money(f.selectedCents)+
   ' no período autorizado.';
  case 'compare':return 'Despesas variaram '+money(f.deltaExpenseCents)+
   ' frente ao mês anterior. O ranking mostra contribuição aritmética, não causalidade.';
  case 'merchants':return 'Estabelecimentos identificados no histórico local carregado. Os valores não comprovam causas de aumento.';
  case 'transactions':return 'Movimentações localizadas por IDs e filtros autorizados.';
  case 'simulate':return 'Economia hipotética: '+money(f.hypotheticalSavingsCents)+
   '. Premissa: reduzir '+f.percent+'% da categoria selecionada.';
  case 'commitments':return 'Compromissos confirmados do próximo mês: '+money(f.commitments.totalCents)+
   '. Isso não demonstra saldo suficiente para comprar.';
  case 'budgets':return 'Orçamentos do cadastro existente. Limite zero não representa divisão por zero.';
  case 'quality':return 'Cobertura dos registros locais; não significa histórico bancário integral.';
  default:return 'Análise concluída com evidências locais.';
 }
}
function visualFor(result,wanted,density){
 if(!result||!result.factRef||!['ready','partial'].includes(result.status))
  return {id:'state',kind:'state',factRef:null,density};
 const available=new Set(['summary','treemap','rank','drilldown','table','budget','recurring','whatif','quality']);
 let kind=result.kind;
 if(!available.has(kind))kind='state';
 if(wanted==='sankey'&&kind!=='sankey')kind='state';
 return {id:result.factRef,kind, factRef:result.factRef,density};
}
class IntelligenceOrchestrator{
 constructor({localFinancial,tools,contexts,planner,clock=()=>Date.now()}={}){
  this.tools=tools||new FinancialReadTools({localFinancial,clock});
  this.contexts=contexts||new ConversationContextStore({clock});
  this.planner=planner||null;this.clock=clock;
 }
 async ask(input,owner){
  const question=String(input?.question||'').trim();
  if(!question||question.length>700||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(question))
   throw Error('Pergunta inválida.');
  const opened=this.contexts.open(input,owner),ctx=opened.context,scope=ctx.scope;
  const replyBase={version:2,contract:'I2-A/D02-V3',readOnly:true,changesApplied:false,
   modelCalled:false,conversationId:opened.id,contextReset:opened.wasReset,
   period:scope.month,source:scope.source,profile:scope.profile,
   density:DENSITIES.includes(input.density)?input.density:'standard'};
  const result=(status,answer,extra={})=>({...replyBase,status,answer,
   facts:[],blocks:[],followUps:[],alerts:[],...extra});
  if(/\b(crie|criar|apague|delete|transfira|pague|altere|reclassifique|registre|salve|aceite)\b/i.test(fold(question)))
   return result('denied','Esta sessão só pode consultar. Alterações financeiras exigem outro fluxo e autorização explícita.');
  const db=this.tools.local?.db;
  const categories=typeof db?.listCategories==='function'?
   (db.listCategories()?.categories||[]).map(c=>c.name).filter(n=>typeof n==='string'):[];
  let decided=localPlan(question,ctx,categories),plannerWarning=null;
  if(this.planner&&typeof this.planner.propose==='function'){
   try{
    const proposed=await this.planner.propose({question,scope,context:ctx});
    if(proposed)decided={plan:validatePlan(proposed),exclusions:ctx.exclusions||[]};
   }catch(err){plannerWarning='Planejador indisponível; consulta local utilizada.';}
  }
  // A newer authorization/scope may have replaced this conversation while planning.
  if(this.contexts.items.get(owner+':'+opened.id)!==ctx||
     ctx.expiresAt<=this.clock()||input.signal?.aborted)
   return result('stale','Contexto alterado durante a investigação.');
  if(!decided.plan)return result(decided.status,decided.message,
   {alerts:plannerWarning?[plannerWarning]:[]});
  if(!decided.plan.steps.every(s=>TOOL_NAMES.includes(s.tool)))
   return result('denied','Ferramenta não autorizada.');
  const outputs=[];
  for(const step of decided.plan.steps){
   if(input.signal?.aborted)return result('stale','Consulta cancelada.');
   try{
    const r=this.tools.execute(step.tool,step.params,scope);
    outputs.push(r);
    if(['stale','unavailable','needs_clarification'].includes(r.status))break;
   }catch(e){
    const msg=String(e?.message||'');
    if(/Autoriza|expirada|perfil|permiss|escopo/i.test(msg))
     return result('denied','A autorização local não permite esta consulta. Autorize novamente.');
    return result('unavailable','Não foi possível verificar os dados solicitados.',
     {alerts:['Falha em ferramenta de leitura. Nenhum dado financeiro foi alterado.']});
   }
  }
  if(!this.contexts.update(opened.id,owner,ctx,{
   exclusions:decided.exclusions||ctx.exclusions,lastPlan:decided.plan,
   lastQuestion:question,lastFactRefs:outputs.map(o=>o.factRef),
   categoryNames:[...new Set(outputs.flatMap(o=>[
    ...(o.facts?.rank||[]).map(e=>e.category),
    ...(o.facts?.categories||[]).map(e=>e.name)]))].slice(0,80)
  }))return result('stale','Contexto alterado durante a investigação.');
  const notReady=outputs.some(o=>!['ready','partial'].includes(o.status));
  const partial=outputs.some(o=>o.status==='partial');
  const state=notReady?'partial':partial?'partial':'ready';
  const blocks=outputs.slice(0,3).map((o,i)=>({...visualFor(o,
   decided.flowRequested?'sankey':decided.plan.visualKind,replyBase.density),
   id:o.factRef+':'+i}));
  const facts=outputs.map(o=>({id:o.factRef,kind:o.kind,tool:o.tool,
   value:o.facts,source:o.reference.source,profile:o.reference.profile,
   period:o.reference.period,asOf:o.reference.asOf,coverage:o.reference.coverage,
   excludedCategories:o.reference.excludedCategories,version:2}));
  const alerts=outputs.map(x=>x.warning).filter(Boolean);
  if(plannerWarning)alerts.push(plannerWarning);
  if(decided.flowRequested)alerts.push('Sankey de renda não autorizado sem fluxos de origem/destino reconciliados. Exibindo estado seguro.');
  if(decided.purchase)alerts.push('Sem saldo inicial e cobertura de compromissos não é possível confirmar viabilidade de compra.');
  if(notReady)alerts.push('Pelo menos uma ferramenta está indisponível; nenhuma cifra foi estimada.');
  const answer=outputs.map(description).join(' ');
  const followUps=outputs.some(o=>o.tool==='compare')?
   [{intent:'investigate_merchants',label:'Investigar estabelecimentos'}]:
   outputs.some(o=>o.tool==='summary')?[{intent:'compare',label:'Comparar com o mês anterior'}]:[];
  return result(state,answer,{facts,blocks,alerts,followUps,
   evidence:outputs.map(o=>({queryId:o.factRef,sourceIds:[o.reference.source],
    period:{...o.reference.period,timezone:'America/Sao_Paulo'},
    asOf:o.reference.asOf,quality:o.status==='ready'?'verified':o.status}))});
 }
}
module.exports={IntelligenceOrchestrator,localPlan,visualFor};