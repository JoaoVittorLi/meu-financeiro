'use strict';
// IC v1 operational adapter. Never stores grants, modifies finance records or
// substitutes a demo answer for an authorized personal query.
const {period}=require('./financial-intelligence.cjs');
const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const statuses=['loading','ready','empty','denied','expired','stale','error','unsupported'];
const cent=value=>Number.isSafeInteger(value)?value:null;
function monthOf(input){
 const month=input?.month;
 // Reuse the existing period validator, including year and month constraints.
 return {...period(month),month};
}
function action(actionId,label,permitted=true,options={}){
 return {actionId,label,permitted,disabledReason:permitted?null:options.disabledReason||'Indisponível neste perfil.',previewRequired:!!options.previewRequired,
  handler:options.handler||null,target:options.target||null,operationId:options.operationId||null};
}
function card(id,kind,title,ctx,patch={}){
 return {id,kind,title,description:'',source:ctx.source,profile:ctx.profile,period:{start:ctx.period.start,end:ctx.period.end},
  asOf:ctx.asOf,coverage:ctx.coverage,capability:'awaiting_permission',uiState:'denied',confidence:'unknown',
  evidence:[],actions:[],status:'not_applicable',valueCents:null,count:null,unavailableReason:null,...patch};
}
function errorState(error){
 const message=String(error?.message||error||'Falha de consulta.').slice(0,200);
 return {uiState:/expirad/i.test(message)?'expired':/autoriz|consent|planejamento/i.test(message)?'denied':'error',unavailableReason:message};
}
function contextFrom(read,month,asOf){
 const r=read.references||{};
 const p=r.period||period(month);
 return {source:r.source,profile:r.profile,period:p,asOf:r.readAt||asOf,
  coverage:r.partial?'partial_local':'unknown',references:r};
}
function checkedReply(reply){
 if(reply?.version!==1||reply.readOnly!==true||reply.changesApplied!==false||reply.inferenceCalled!==false)throw Error('Resposta financeira não verificada.');
 if(!reply.references||!['bank','manual'].includes(reply.references.source)||!['real','demo'].includes(reply.references.profile))throw Error('Origem financeira inválida.');
 if(!reply.facts||typeof reply.facts!=='object')throw Error('Fatos estruturados indisponíveis neste build.');
 return reply;
}
function readCard(id,kind,title,reply,month,asOf,make){
 const ctx=contextFrom(reply,month,asOf),base=card(id,kind,title,ctx,{
  capability:'available_read_only',uiState:'ready',
  evidence:[{source:ctx.source,engine:reply.references.engine,loaded:reply.references.loaded,partial:reply.references.partial,
   note:'Uma origem local autorizada; não equivale à cobertura integral do extrato bancário.'}],
  description:reply.text});
 return make(base,reply.facts,reply);
}
function unavailable(id,kind,title,ctx,reason,capability='awaiting_permission',uiState='denied'){
 return card(id,kind,title,ctx,{capability,uiState,unavailableReason:reason,description:reason});
}
class IntelligenceOperational{
 constructor({localFinancial,categoryReview=null,db,clock=()=>Date.now()}={}){
  if(!localFinancial||typeof localFinancial.query!=='function'||!db||typeof db.listCategories!=='function')throw Error('Serviços existentes obrigatórios.');
  this.local=localFinancial;this.review=categoryReview;this.db=db;this.clock=clock;
 }
 // One shared, validated response with the eight IC v1 card IDs.
 overview(input,owner){
  if(!Number.isInteger(owner))throw Error('Identidade IPC inválida.');
  const p=monthOf(input),asOf=new Date(this.clock()).toISOString();
  const ctx={source:input?.source==='manual'?'manual':'bank',profile:input?.profile==='demo'?'demo':'real',
   period:p,asOf,coverage:'unknown'};
  const authorized=typeof input?.token==='string'&&input.token.length>0;
  const read=intent=>{
   if(!authorized)return {error:{uiState:'denied',unavailableReason:'Autorize fonte e perfil para leitura local.'}};
   try{return {reply:checkedReply(this.local.query({token:input.token,month:p.month,intent},owner))};}
   catch(err){return {error:errorState(err)};}
  };
  const rdReview=read('review'),rdRadar=read('radar'),rdBudgets=read('budgets'),rdCommitments=read('commitments');
  const from=(id,kind,title,ret,transform)=>{
   if(ret.reply)return readCard(id,kind,title,ret.reply,p.month,asOf,transform);
   return unavailable(id,kind,title,ctx,ret.error.unavailableReason,
    ret.error.uiState==='error'?'error':'awaiting_permission',ret.error.uiState);
  };
  const cards=[];
  cards.push(from('UI-01','review_inbox','Movimentações a revisar',rdReview,(c,f)=>{
   if(c.source!=='bank')return {...c,capability:'unavailable',uiState:'unsupported',unavailableReason:'Revisão bancária não se aplica à fonte manual.',count:null};
   if(!f.review||!Number.isSafeInteger(f.review.count))return {...c,uiState:'error',capability:'error',unavailableReason:'Contagem não verificada.'};
   return {...c,count:f.review.count,uiState:f.review.count?'ready':'empty',
    evidence:[...c.evidence,{criteria:'Não revisadas no histórico bancário local carregado',posted:f.review.postedCount,
      pendingBank:f.review.pendingBankCount,warning:'PENDING bancário não significa pendência de categorização.'}],
    actions:[action('navigate:transactions-review','Abrir Movimentações',true,{target:'transactions',handler:'navigation:transactions-review'})]};
  }));
  cards.push(unavailable('UI-02','rule_suggestion','Regras sugeridas',ctx,
    'Revisão supervisionada depende de perfil sintético e autorização própria.','synthetic_only','unsupported'));
  cards.push(from('UI-03','financial_metric','Radar financeiro',rdRadar,(c,f)=>{
   const observations=Array.isArray(f.budgets)?f.budgets.filter(b=>b.spentCents>b.limitCents||(b.limitCents>0&&b.pct>=80)):[];
   return {...c,count:observations.length,uiState:observations.length?'ready':'empty',
    evidence:[...c.evidence,{criteria:'Alerta quando gasto supera limite ou alcança 80% do limite positivo.'}],
    observations:observations.map(b=>({category:b.category,spentCents:cent(b.spentCents),limitCents:cent(b.limitCents),percentage:b.pct})),
    actions:[action('navigate:budgets','Ver Orçamentos',true,{target:'budgets',handler:'navigation:budgets'})]};
  }));
  cards.push(from('UI-04','budget_alert','Orçamentos',rdBudgets,(c,f)=>{
   const budgets=Array.isArray(f.budgets)?f.budgets:[];
   return {...c,count:budgets.length,uiState:budgets.length?'ready':'empty',
    budgets:budgets.map(b=>({category:b.category,spentCents:cent(b.spentCents),limitCents:cent(b.limitCents),percentage:b.pct})),
    evidence:[...c.evidence,{criteria:'Limites do cadastro manual; consumo da única fonte de movimentações autorizada.'}],
    actions:[action('navigate:budgets','Abrir Orçamentos',true,{target:'budgets',handler:'navigation:budgets'})]};
  }));
  cards.push(from('UI-05','commitment','Próximos compromissos',rdCommitments,(c,f)=>{
   const x=f.commitments;if(!x)return {...c,uiState:'error',capability:'error',unavailableReason:'Compromissos não verificados.'};
   return {...c,source:'planning',coverage:x.partial?'partial_local':'unknown',count:x.count,valueCents:cent(x.totalCents),
    period:x.period,uiState:x.count?'ready':'empty',
    evidence:[...c.evidence,{criteria:'Somente despesas futuras planejadas, confirmadas e com valor restante positivo.'}],
    actions:[action('navigate:planning','Abrir Planejamento',true,{target:'planning',handler:'navigation:planning'})]};
  }));
  const cats=this.db.listCategories();
  const names=Array.isArray(cats?.categories)?cats.categories.map(c=>({name:String(c.name),kind:c.kind||'both',color:c.color||null})):null;
  cards.push(card('UI-06','financial_metric','Categorias',ctx,{
   source:'manual',capability:names?'available_read_only':'error',uiState:names?(names.length?'ready':'empty'):'error',
   count:names?.length??null,categories:names,description:'Categorias do cadastro existente; criação apenas no editor manual.',
   evidence:[{source:'categoriesStatus',criteria:'Lista via FinanceDB.listCategories'}],
   actions:names?[action('navigate:category-editor','+ Nova categoria',true,{target:'transactions',handler:'navigation:category-editor'})]:[],
   unavailableReason:names?null:'Cadastro indisponível.'
  }));
  cards.push(card('UI-07','chat_answer','Conversar sobre finanças',ctx,{
   capability:rdRadar.reply?'available_read_only':rdRadar.error?.uiState==='error'?'error':'awaiting_permission',
   uiState:rdRadar.reply?'ready':rdRadar.error?.uiState||'denied',
   source:rdRadar.reply?.references.source||ctx.source,profile:rdRadar.reply?.references.profile||ctx.profile,
   description:'Perguntas financeiras são respondidas por consultas locais autorizadas, sem escrita por IA.',
   evidence:rdRadar.reply?[{source:'localFinancialQuery',period:rdRadar.reply.references.period}]:[],
   actions:rdRadar.reply?[action('navigate:intelligence-chat','Conversar',true,{target:'intelligence',handler:'navigation:intelligence-chat'})]:[],
   unavailableReason:rdRadar.error?.unavailableReason||null
  }));
  cards.push(unavailable('UI-08','action_receipt','Histórico de ações',ctx,
    'Recibos de execução disponíveis apenas no perfil sintético autorizado.','synthetic_only','unsupported'));
  // Synthetic controls are independent of real read grants. Never mix their data.
  if(this.review&&typeof input?.reviewToken==='string'&&input.reviewToken){
   try{
    const report=this.review.list({token:input.reviewToken},owner);
    const suggestions=Array.isArray(report?.suggestions)?report.suggestions:[];
    const audit=Array.isArray(report?.audit)?report.audit:[];
    const rctx={...ctx,source:'synthetic',profile:'synthetic',coverage:report.completeLocalHistory?'complete_local':'partial_local'};
    cards[1]=card('UI-02','rule_suggestion','Regras sugeridas',rctx,{
     capability:'synthetic_only',uiState:suggestions.length?'ready':'empty',count:report.suggestionsTotal??suggestions.length,
     suggestions:suggestions.map(s=>({id:s.id,pattern:s.pattern,category:s.category,confidence:s.confidence,
      state:s.state,reason:s.reason,evidenceCount:s.evidenceCount,conflicts:s.conflicts,accountId:s.accountId,
      compatible:s.compatible})),
     evidence:[{source:'CategoryReviewService.list',scanned:report.scanned,partial:!!report.suggestionsPartial}],
     actions:suggestions.length?[action('review:prepare-rule','Revisar sugestão',true,
      {previewRequired:true,handler:'categoryReviewPrepare'})]:[]
    });
    cards[7]=card('UI-08','action_receipt','Histórico de ações',rctx,{
     capability:'synthetic_only',uiState:audit.length?'ready':'empty',count:audit.length,
     receipts:audit.map(a=>({id:a.id,action:a.action,appliedAt:a.appliedAt,undoState:a.undoState})),
     evidence:[{source:'CategoryReviewService.list.audit',limit:50}],
     actions:[action('review:history','Abrir histórico',true,{target:'intelligence',handler:'navigation:review-history'})]
    });
   }catch(err){
    for(const i of [1,7])cards[i]={...cards[i],...errorState(err),capability:'synthetic_only'};
   }
  }
  return {version:1,contract:'IC-v1/I-P0.1',asOf,period:{start:p.start,end:p.end},
   privacy:{readOnly:true,changesApplied:false,modelCalled:false,personalAIWritingEnabled:false},
   cards};
 }
 ask(input,owner){
  if(!Number.isInteger(owner))throw Error('Identidade IPC inválida.');
  const p=monthOf(input),question=String(input?.question||'').trim();
  if(!question||question.length>700||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(question))throw Error('Pergunta inválida.');
  const q=fold(question);
  const base={version:1,contract:'IC-v1/I-P0.2-read-only',asOf:new Date(this.clock()).toISOString(),
   readOnly:true,changesApplied:false,modelCalled:false,period:{start:p.start,end:p.end},actions:[]};
  // Never route natural-language commands into finance write endpoints.
  if(/\b(crie|criar|altere|alterar|mude|apague|exclua|salve|registre|aplique|aceite|negue|categorize|reclassifique|transfira|pague)\b/.test(q))
   return {...base,uiState:'unsupported',intent:null,answer:'Posso analisar e explicar. Alterações por IA no perfil pessoal permanecem bloqueadas; use o editor manual ou a revisão sintética supervisionada.',evidence:[]};
  // Explain real synthetic suggestions/audit through the existing guarded service.
  // This path is read-only and does not call prepare, confirm or undo.
  const wantsRules=/(sugest|suger|sugir|sugira|proponha|padroes).*(regra|categori)|(regra).*(suger|sugest|proponha)/.test(q);
  const wantsHistory=/(historico).*(acao|acoes|revisao|regra)/.test(q);
  if(wantsRules||wantsHistory){
   if(!this.review)return {...base,uiState:'unsupported',intent:wantsHistory?'review_history':'suggested_rules',
    answer:'Este recurso de revisão supervisionada só pode operar em perfil sintético validado.',evidence:[],capability:'synthetic_only'};
   if(typeof input?.reviewToken!=='string'||!input.reviewToken)return {...base,uiState:'denied',
    intent:wantsHistory?'review_history':'suggested_rules',answer:'Autorize separadamente a revisão do perfil sintético.',evidence:[],capability:'synthetic_only'};
   try{
    const report=this.review.list({token:input.reviewToken},owner);
    const suggestions=Array.isArray(report.suggestions)?report.suggestions:[];
    const receipts=Array.isArray(report.audit)?report.audit:[];
    return {...base,uiState:(wantsHistory?receipts:suggestions).length?'ready':'empty',source:'synthetic',profile:'synthetic',
     capability:'synthetic_only',coverage:report.completeLocalHistory?'complete_local':'partial_local',
     intent:wantsHistory?'review_history':'suggested_rules',
     answer:wantsHistory?receipts.length+' recibo(s) locais disponíveis na auditoria sintética.':
      (report.suggestionsTotal??suggestions.length)+' sugestão(ões) identificada(s) em classificações manuais do ambiente sintético.',
     facts:wantsHistory?{receiptCount:receipts.length,receipts:receipts.map(a=>({id:a.id,action:a.action,appliedAt:a.appliedAt,undoState:a.undoState}))}:
      {suggestionCount:report.suggestionsTotal??suggestions.length,suggestions:suggestions.map(a=>({id:a.id,pattern:a.pattern,category:a.category,
       confidence:a.confidence,reason:a.reason,evidenceCount:a.evidenceCount,state:a.state,conflicts:a.conflicts}))},
     actions:wantsRules?suggestions.map(a=>action('review:prepare-rule','Revisar regra proposta',true,{
      handler:'categoryReviewPrepare',operationId:a.id,previewRequired:true})):[action('review:history','Abrir histórico',true,{target:'intelligence',handler:'navigation:review-history'})],
     evidence:[{source:'CategoryReviewService.list',scanned:report.scanned,partial:!!report.suggestionsPartial}]};
   }catch(err){const state=errorState(err);return {...base,uiState:state.uiState,capability:'synthetic_only',
    intent:wantsHistory?'review_history':'suggested_rules',answer:state.unavailableReason,evidence:[]};}
  }
  let intent=null,category;
  if(/revis|pendentes? de revis|conferir moviment/.test(q))intent='review';
  else if(/compar|mes anterior|aument|diminu/.test(q))intent='compare';
  else if(/maior(es)? gasto|maior(es)? despesa|mais cara/.test(q))intent='largest';
  else if(/compromiss|proximo mes|venciment|contas futuras/.test(q))intent='commitments';
  else if(/orcament|limites|ultrapass|exced/.test(q))intent='budgets';
  else if(/radar|atencao|alertas|risco de gasto/.test(q))intent='radar';
  else if(/categoria|gastos com|gastei com/.test(q)){
   const categories=this.db.listCategories()?.categories||[];
   const found=categories.find(c=>q.includes(fold(c.name)));
   if(found){intent='category';category=found.name;}
  }
  if(!intent)return {...base,uiState:'unsupported',intent:null,answer:'Ainda não reconheço esta pergunta com evidências suficientes. Você pode pedir maiores gastos, comparação mensal, orçamentos, revisão, compromissos ou gastos por categoria.',evidence:[]};
  if(typeof input?.token!=='string'||!input.token)return {...base,uiState:'denied',intent,answer:'Autorize a leitura local da fonte e do perfil antes de consultar suas finanças.',evidence:[]};
  try{
   const reply=checkedReply(this.local.query({token:input.token,month:p.month,intent,...(category?{category}:{})},owner));
   return {...base,uiState:'ready',intent,category:category||null,answer:reply.text,source:reply.references.source,
    profile:reply.references.profile,coverage:reply.references.partial?'partial_local':'unknown',
    facts:reply.facts,card:reply.card,evidence:[reply.references,...(reply.card?.footnote?[{warning:reply.card.footnote}]:[])]};
  }catch(err){const status=errorState(err);return {...base,uiState:status.uiState,intent,answer:'Não consegui consultar os dados autorizados. '+status.unavailableReason,evidence:[]};}
 }
}
module.exports={IntelligenceOperational,statuses};
