'use strict';
// I2-D D1: evidence-based, read-only category & merchant investigations.
// Existing FinanceDB + IC-READ grant are the sole data/authorization sources.
const {createHash}=require('node:crypto');
const {normalizeLabel,matchRule}=require('./db.cjs');
const {specific}=require('./category-review.cjs');
const {sameScope}=require('./intelligence-context.cjs');
const VERSION='I2-D/CATEGORY-OPPORTUNITIES-V1';
const fold=normalizeLabel;
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const natureOf=r=>r.nature&&r.nature!=='auto'?r.nature:r.amount<0?'expense':'income';
const valid= r=>r.status==='POSTED'&&['income','expense'].includes(natureOf(r))&&
  Number.isSafeInteger(r.amount)&&r.amount!==0&&!r.splits?.length&&!r.splitOutdated&&
  !r.linkedManualId&&!r.supervisedOutdated;
const rowId=r=>String(r.accountId)+':'+String(r.id);
const safeSummary=r=>({id:rowId(r),accountId:r.accountId,externalId:r.id,
 date:r.date,description:r.description,category:r.category,
 amountCents:Math.abs(r.amount),nature:natureOf(r),categorySource:r.categorySource});
function distanceAtMostTwo(a,b){
 if(Math.abs(a.length-b.length)>2)return 3;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const next=[i];let min=i;
  for(let j=1;j<=b.length;j++){
   const n=Math.min(prev[j]+1,next[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
   next.push(n);min=Math.min(min,n);
  }
  if(min>2)return 3;prev=next;
 }
 return prev[b.length];
}
function likelyNameCollision(a,b){
 const x=fold(a),y=fold(b);
 if(x===y)return {relation:'normalized_equal',confidence:'high'};
 if(Math.min(x.length,y.length)>=6&&x[0]===y[0]&&distanceAtMostTwo(x,y)<=2)
  return {relation:'spelling_similar',confidence:'low'};
 return null;
}
function normalizedParams(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Filtro inválido.');
 if(Object.keys(input).some(k=>!['accountId','limit','includeUnused','includeSimilar'].includes(k)))
  throw Error('Campo de investigação não autorizado.');
 const accountId=input.accountId??null;
 if(accountId!==null&&(typeof accountId!=='string'||!accountId.trim()||accountId.length>150))
  throw Error('Conta inválida.');
 const limit=input.limit??12;
 if(!Number.isInteger(limit)||limit<1||limit>30)throw Error('Limite inválido.');
 return {accountId,limit,includeUnused:input.includeUnused!==false,includeSimilar:input.includeSimilar!==false};
}
class ProactiveCategoryAdvisor{
 constructor({proposals,clock=()=>Date.now(),ttlMs=5*60*1000,max=100}={}){
  if(!proposals?.authorize||!proposals?.catalog||!proposals?.preview)throw Error('I2-B obrigatório.');
  this.proposals=proposals;this.db=proposals.db;this.clock=clock;this.ttlMs=ttlMs;
  this.max=max;this.opportunities=new Map();
 }
 catalogAnalysis(scope,owner,params){
  const c=this.proposals.catalog(scope,owner);
  const cats=c.categories,similar=[];
  if(params.includeSimilar)for(let i=0;i<cats.length;i++)for(let j=i+1;j<cats.length;j++){
   const reason=likelyNameCollision(cats[i].name,cats[j].name);
   if(reason)similar.push({categoryNames:[cats[i].name,cats[j].name],
    ...reason,action:'review_only',mergeAllowed:false,
    explanation:'Similaridade de rótulo não comprova duplicidade semântica.'});
  }
  const unused=params.includeUnused?cats.filter(x=>x.probablyUnused)
   .map(x=>({name:x.name,builtIn:!!x.builtIn,reason:'no_explicit_local_reference',
    action:'review_only',canDeleteAutomatically:false,
    warning:'Classificação implícita, histórico não carregado e vínculos futuros podem existir.'})):[];
  return {similar:similar.slice(0,params.limit),unused:unused.slice(0,params.limit),
   counts:{similarFound:similar.length,unusedCandidates:unused.length},
   note:'Nunca mesclar, apagar ou renomear apenas por semelhança/ausência de referências.'};
 }
 scan(input,owner){
  const params=normalizedParams(input?.filters||{}),{scope,references}=this.proposals.authorize(input,owner);
  const catalog=this.catalogAnalysis(input,owner,params);
  const base={contract:VERSION,version:1,status:'ready',changesApplied:false,
   readOnly:true,modelCalled:false,source:scope.source,profile:scope.profile,
   month:scope.month,asOf:references.readAt,
   coverage:references.partial?'partial_local':'local_not_certified',
   accountId:params.accountId,catalog,opportunities:[],conflicts:[],diagnostics:[],
   totalRowsLoaded:0,visibleRows:0};
  if(scope.source!=='bank'){
   if(params.accountId)throw Error('Conta bancária não pertence à fonte manual.');
   return {...base,diagnostics:[
    'No histórico manual não há um campo que diferencie correções humanas de classificações importadas. Sugestões automáticas foram desabilitadas.',
    'O catálogo é consultável; nenhum lançamento foi alterado.']};
  }
  const overview=this.db.bankOverview();
  if(params.accountId&&!overview.accounts.some(x=>x.id===params.accountId))
   throw Error('Conta não encontrada no escopo local.');
  const rows=overview.transactions.filter(r=>
   r.date>=references.period.start&&r.date<=references.period.end&&
   (!params.accountId||r.accountId===params.accountId));
  base.totalRowsLoaded=overview.transactions.length;base.visibleRows=rows.length;
  if(overview.truncated){base.coverage='partial_local';base.status='partial';
   base.diagnostics.push('A visão bancária limita a 2500 lançamentos; padrões e contagens são parciais.');}
  if(!rows.length)return {...base,diagnostics:[...base.diagnostics,'Nenhum lançamento elegível foi carregado no período autorizado.']};
  const groups=new Map();
  for(const r of rows){
   if(!valid(r)||!specific(r.description))continue;
   const nature=natureOf(r),key=JSON.stringify([r.accountId,nature,fold(r.description)]);
   let group=groups.get(key);
   if(!group){group={accountId:r.accountId,nature,pattern:fold(r.description),
    rows:[],votes:new Map(),manuallyCorrected:[]};groups.set(key,group);}
   group.rows.push(r);
   if(r.categorySource==='manual'){
    const count=group.votes.get(r.category)||0;
    group.votes.set(r.category,count+1);group.manuallyCorrected.push(r);
   }
  }
  const suggestions=[],conflicts=[];
  const configuration=this.db.listCategories();
  for(const g of groups.values()){
   if(g.votes.size>1){
    conflicts.push({type:'conflicting_human_labels',accountId:g.accountId,nature:g.nature,
     pattern:g.pattern,labels:[...g.votes].map(([category,count])=>({category,count})),
     evidence:g.manuallyCorrected.slice(0,8).map(safeSummary),
     confidence:'conflicted',action:'manual_review_required'});
    continue;
   }
   if(g.votes.size!==1)continue;
   const [category,anchorCount]=[...g.votes][0],target=configuration.categories.find(c=>c.name===category);
   if(!target||!(target.kind==='both'||target.kind===g.nature))continue;
   const candidates=g.rows.filter(r=>r.categorySource==='bank'&&r.category!==category);
   const compatible=g.rows.filter(r=>r.categorySource==='bank'&&r.category===category);
   const ruleShadowed=g.rows.filter(r=>r.categorySource==='rule');
   if(anchorCount<2)continue; // Explicit evidence: two independent corrections minimum.
   if(!candidates.length&&!compatible.length&&!ruleShadowed.length)continue;
   const collisions=configuration.rules.filter(rule=>rule.enabled&&rule.scope!=='manual'&&
    (!rule.constraint||rule.constraint.accountId===g.accountId)&&
    matchRule(g.pattern,'bank',[rule],{accountId:g.accountId,nature:g.nature,
     rowid:Number.MAX_SAFE_INTEGER,status:'POSTED',hasSplits:false})!==null);
   const confidence=anchorCount>=3?'high':'medium';
   const capped=candidates.slice(0,25);
   const shown=capped.map(safeSummary);
   const evidence=g.manuallyCorrected.slice(0,8).map(safeSummary);
   const cents=candidates.reduce((sum,r)=>sum+Math.abs(r.amount),0);
   const digest=sha({scope,sourceIds:g.rows.map(rowId),evidence,candidates:candidates.map(safeSummary),
    category,pattern:g.pattern,asOf:references.readAt,ruleIds:collisions.map(x=>x.id)});
   const id=sha([scope.owner,scope.token,g.accountId,g.nature,g.pattern,category,digest]).slice(0,32);
   const item={id,kind:'merchant_pattern',accountId:g.accountId,nature:g.nature,
    pattern:g.pattern,category,confidence,
    rationale:anchorCount+' correções manuais explícitas e consistentes para esta descrição exata.',
    evidence:{manualCorrections:anchorCount,manualExamples:evidence,
     loadedCandidateCount:candidates.length,loadedCandidateAmountCents:cents,
     candidateExamples:shown,candidatePreviewTruncated:candidates.length>shown.length,
     alreadyInCategoryLoaded:compatible.length,alreadyByRuleLoaded:ruleShadowed.length},
    precedence:{blocking:collisions.length>0,matchedRules:collisions.map(x=>({
     id:x.id,pattern:x.pattern,priority:x.priority,category:x.category,scope:x.scope}))},
    actions:{
     historical:candidates.length&&candidates.length<=100&&!overview.truncated&&!collisions.length?
      'preview_explicit_ids':'manual_review_only',
     future:collisions.length?'review_precedence':'future_exact_rule_candidate'},
    scope:{source:scope.source,profile:scope.profile,month:scope.month,
     accountId:g.accountId,nature:g.nature},expiresAt:this.clock()+this.ttlMs,
    coverage:overview.truncated?'partial_local':'loaded_local'};
   suggestions.push(item);
   this.opportunities.set(owner+':'+id,{scope,record:item,digest,
    candidateIds:candidates.slice(0,100).map(r=>({accountId:r.accountId,externalId:r.id})),
    expiresAt:item.expiresAt,criteria:params});
  }
  suggestions.sort((a,b)=>b.evidence.manualCorrections-a.evidence.manualCorrections||
   b.evidence.loadedCandidateAmountCents-a.evidence.loadedCandidateAmountCents||
   a.id.localeCompare(b.id));
  const ordered=suggestions.slice(0,params.limit);
  const selectedIds=new Set(ordered.map(x=>x.id));
  for(const [key,v] of this.opportunities)
   if(v.expiresAt<=this.clock())this.opportunities.delete(key);
  while(this.opportunities.size>this.max){
   const k=this.opportunities.keys().next().value;this.opportunities.delete(k);
  }
  return {...base,opportunities:ordered,conflicts:conflicts.slice(0,params.limit),
   counts:{patterns:groups.size,suggestions:suggestions.length,conflicts:conflicts.length},
   continuation:{hasMore:suggestions.length>params.limit,shown:ordered.length},
   diagnostics:[...base.diagnostics,'Somente correções humanas explícitas serviram de âncora.',
    'A confiança representa consistência da amostra, não probabilidade calibrada de acerto.',
    'Sugestões não autorizam lançamentos, regras ou contas fora do escopo.']};
 }
 detail(id,input,owner){
  const {scope}=this.proposals.authorize(input,owner),saved=this.opportunities.get(owner+':'+id);
  if(!saved||saved.expiresAt<=this.clock()||!sameScope(saved.scope,scope))
   return {status:'stale',changesApplied:false,reason:'Padrão expirado ou escopo alterado.'};
  return {contract:VERSION,status:'ready',changesApplied:false,opportunity:saved.record};
 }
 propose(id,action,input,owner){
  if(!['historical','future'].includes(action))throw Error('Ação de proposta inválida.');
  const {scope}=this.proposals.authorize(input,owner),saved=this.opportunities.get(owner+':'+id);
  if(!saved||saved.expiresAt<=this.clock()||!sameScope(saved.scope,scope))
   return {status:'stale',changesApplied:false,reason:'Padrão não está mais autorizado.'};
  // Recompute the observation and reject if source IDs, rules or corrections changed.
  this.opportunities.delete(owner+':'+id);
  const fresh=this.scan({...input,filters:saved.criteria},owner);
  const candidate=fresh.opportunities.find(x=>x.id===id);
  if(!candidate)return {status:'stale',changesApplied:false,
   reason:'Dados, regras, conta ou seleção mudaram: faça nova investigação.'};
  const rec=this.opportunities.get(owner+':'+id);
  if(action==='historical'){
   if(candidate.actions.historical!=='preview_explicit_ids'||!rec?.candidateIds.length)
    return {status:'blocked',changesApplied:false,reason:'Histórico parcial, precedência ou seleção não segura.'};
   const proposal=this.proposals.preview('transaction.categorize',{
    category:candidate.category,items:rec.candidateIds},input,owner);
   return {status:proposal.status,contract:'I2-D/ADVISORY-PROPOSAL-V1',changesApplied:false,
    opportunityId:id,action,proposal,warning:'Requer revisar cada ID, impacto e confirmar separadamente. Nenhuma alteração foi aplicada.'};
  }
  if(candidate.precedence.blocking||candidate.actions.future!=='future_exact_rule_candidate')
   return {status:'blocked',changesApplied:false,reason:'Regra futura conflita com precedência atual.'};
  const proposal=this.proposals.preview('rule.create',{
   pattern:candidate.pattern,category:candidate.category,
   accountId:candidate.accountId,nature:candidate.nature,
   matchMode:'exact',scope:'bank',priority:100,futureOnly:true},input,owner);
  return {status:proposal.status,contract:'I2-D/ADVISORY-PROPOSAL-V1',changesApplied:false,
   opportunityId:id,action,proposal,
   warning:'Futuro somente. A proposta pode permanecer bloqueada até existir adapter sintético de restrição por rowid.'};
 }
}
module.exports={ProactiveCategoryAdvisor,likelyNameCollision,distanceAtMostTwo,natureOf,valid,VERSION};