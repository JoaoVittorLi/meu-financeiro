'use strict';
// I2-E — stricter evidence review on top of I2-D; no financial writes or second category ledger.
const {createHash}=require('node:crypto');
const {normalizeLabel,matchRule}=require('./db.cjs');
const {sameScope}=require('./intelligence-context.cjs');
const CONTRACT='I2-E/EVIDENCE-QUALITY-V1';
const sha=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
const key=r=>JSON.stringify([r.accountId,r.id]);
const kind=r=>r.nature&&r.nature!=='auto'?r.nature:r.amount<0?'expense':'income';
const hasFlag=r=>r.status!=='POSTED'||!['income','expense'].includes(kind(r))||
 !Number.isSafeInteger(r.amount)||r.amount===0||!!r.splits?.length||
 !!r.splitOutdated||!!r.linkedManualId||!!r.supervisedOutdated;
function duplicateHeuristics(rows){
 const groups=new Map();
 for(const row of rows){
  const stamp=JSON.stringify([row.accountId,row.date,row.amount,normalizeLabel(row.description)]);
  if(!groups.has(stamp))groups.set(stamp,[]);
  groups.get(stamp).push(row);
 }
 return [...groups.values()].filter(g=>g.length>1).map(g=>({
  type:'potential_duplicate',count:g.length,accountId:g[0].accountId,
  date:g[0].date,amountCents:Math.abs(g[0].amount),
  recordIds:g.slice(0,10).map(r=>key(r)),
  explanation:'Mesma conta, data, valor e descrição. Pode ser compra repetida legítima; revisar antes de recomendar.'
 })).slice(0,20);
}
function evidenceVerdict({anchors,distinctDates,suspiciousDuplicates,ruleCollision,partial,
 candidates,unsupported,amountCents}){
 const reasons=[];
 if(unsupported)reasons.push('unsupported_source');
 if(partial)reasons.push('partial_history');
 if(anchors<2)reasons.push('insufficient_explicit_overrides');
 if(distinctDates<2)reasons.push('same_day_evidence');
 if(suspiciousDuplicates>0)reasons.push('potential_duplicate_records');
 if(ruleCollision)reasons.push('existing_rule_precedence');
 if(candidates>100)reasons.push('bulk_limit_100');
 if(candidates<1)reasons.push('no_eligible_candidates');
 if(!Number.isSafeInteger(amountCents)||amountCents<0)reasons.push('unverifiable_amounts');
 return {status:reasons.length?'review_required':'eligible_for_preview',
  reasons,confidence:anchors>=3&&distinctDates>=3?'high':anchors>=2&&distinctDates>=2?'medium':'insufficient',
  probabilityCalibrated:false,
  explanation:reasons.length?'Revisão humana necessária; a evidência não autoriza preparar uma ação automática.':
   'Histórico local e evidências atendem aos critérios mínimos; a proposta ainda exige conferência e confirmação independentes.'};
}
// D05 introduces categoryId+subcategoryId rather than category names alone.
// Block legacy name-only drafts until the Integrator provides a verified resolver.
function unresolvedHierarchy(db){
 const sql=db?.db;
 if(!sql?.prepare)throw Error('SQLite indisponível para verificação D05.');
 return !!sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='subcategories'").get();
}
function sourceLabels(db){
 const sql=db?.db;
 if(!sql?.prepare)throw Error('FinanceDB e SQLite obrigatórios.');
 const exists=sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='category_review_applied_labels'").get();
 if(!exists)return new Set();
 return new Set(sql.prepare('SELECT account_id AS accountId,external_id AS externalId FROM category_review_applied_labels').all()
  .map(x=>JSON.stringify([x.accountId,x.externalId])));
}
class EvidenceQualityService{
 constructor({advisor,clock=()=>Date.now(),ttlMs=300000,maxEntries=100}={}){
  if(!advisor?.scan||!advisor?.propose||!advisor?.proposals?.authorize)
   throw Error('Motor I2-D e IC-READ são obrigatórios.');
  this.advisor=advisor;this.proposals=advisor.proposals;this.db=this.proposals.db;
  this.clock=clock;this.ttlMs=ttlMs;this.maxEntries=maxEntries;this.entries=new Map();
 }
 analysis(input,owner){
  const {scope,references}=this.proposals.authorize(input,owner);
  const scan=this.advisor.scan(input,owner),base={
   contract:CONTRACT,version:1,source:scope.source,profile:scope.profile,month:scope.month,
   accountId:scan.accountId??null,changesApplied:false,readOnly:true,modelCalled:false,
   coverage:scan.coverage,asOf:scan.asOf,status:scan.status,
   quality:[],classificationIssues:scan.classificationIssues,catalog:scan.catalog,
   conflicts:scan.conflicts,diagnostics:scan.diagnostics,
   notice:'Score é heurístico, não é uma probabilidade ou recomendação executada.'};
  if(scope.source!=='bank'||!scan.opportunities.length)return base;
  const overview=this.db.bankOverview(),records=overview.transactions;
  const labels=sourceLabels(this.db),rules=this.db.listCategories().rules;
  const rulesVersion=sha(rules);
  const partial=!!overview.truncated||!!references.partial;
  const hierarchyPending=unresolvedHierarchy(this.db);
  const out=[];
  for(const opportunity of scan.opportunities){
   const related=records.filter(r=>r.accountId===opportunity.accountId&&
    r.date>=references.period.start&&r.date<=references.period.end&&
    kind(r)===opportunity.nature&&normalizeLabel(r.description)===opportunity.pattern);
   const eligible=related.filter(r=>!hasFlag(r));
   const anchors=eligible.filter(r=>r.categorySource==='manual'&&r.category===opportunity.category&&
    !labels.has(key(r)));
   const candidates=eligible.filter(r=>r.categorySource==='bank'&&r.category!==opportunity.category);
   const dupes=duplicateHeuristics(eligible);
   const anchorDays=[...new Set(anchors.map(r=>r.date))].sort();
   const existingRule=matchRule(opportunity.pattern,'bank',rules,
    {accountId:opportunity.accountId,nature:opportunity.nature,
     rowid:Number.MAX_SAFE_INTEGER,status:'POSTED',hasSplits:false});
   const cents=candidates.reduce((s,r)=>s+Math.abs(r.amount),0);
   const safeCents=Number.isSafeInteger(cents)?cents:-1;
   const verdict=evidenceVerdict({anchors:anchors.length,distinctDates:anchorDays.length,
    suspiciousDuplicates:dupes.length,ruleCollision:existingRule!==null,
    partial,candidates:candidates.length,unsupported:hierarchyPending,amountCents:safeCents});
   if(hierarchyPending){
    verdict.status='review_required';
    verdict.reasons.push('d05_hierarchy_target_unresolved');
    verdict.explanation='D05 usa categoryId e subcategoryId; nenhuma ação pode usar categoria plana sem resolver pai e filho.';
   }
   const factual={owner,scope,opportunityId:opportunity.id,accountId:opportunity.accountId,
    pattern:opportunity.pattern,category:opportunity.category,nature:opportunity.nature,
    anchorIds:anchors.map(key).sort(),candidateIds:candidates.map(key).sort(),
    anchorsByDay:anchorDays,duplicateGroups:dupes,ruleVersion:rulesVersion,
    partial,amountCents:safeCents,coverage:scan.coverage};
   const evidenceHash=sha(factual);
   const qualityId=sha([scope.owner,scope.token,opportunity.id,evidenceHash]).slice(0,32);
   const entry={contract:CONTRACT,qualityId,opportunityId:opportunity.id,
    accountId:opportunity.accountId,nature:opportunity.nature,
    pattern:opportunity.pattern,category:opportunity.category,
    originalConfidence:opportunity.confidence,
    qualityConfidence:verdict.confidence,qualityStatus:verdict.status,
    reasons:verdict.reasons,probabilityCalibrated:false,
    anchorSummary:{count:anchors.length,independentDates:anchorDays.length,dates:anchorDays.slice(0,12),
     source:'local_override_actor_unverified',
     examples:anchors.slice(0,6).map(r=>({id:key(r),date:r.date,amountCents:Math.abs(r.amount)}))},
    candidateSummary:{count:candidates.length,amountCents:safeCents,
     examples:candidates.slice(0,10).map(r=>({id:key(r),date:r.date,amountCents:Math.abs(r.amount),
      category:r.category}))},
    duplicateWarnings:dupes,rulePrecedence:{
     willShadowFutureRule:existingRule!==null,
     effectiveExistingCategory:existingRule,
     affectedRules:rules.filter(r=>r.enabled&&r.scope!=='manual'&&
      matchRule(opportunity.pattern,'bank',[r],{
       accountId:opportunity.accountId,nature:opportunity.nature,rowid:Number.MAX_SAFE_INTEGER,
       status:'POSTED',hasSplits:false})!==null).slice(0,12)
      .map(r=>({id:r.id,category:r.category,priority:r.priority,matchMode:r.matchMode,scope:r.scope}))
    },evidenceHash,expiresAt:this.clock()+this.ttlMs,coverage:scan.coverage,
    safeForDraft:verdict.status==='eligible_for_preview',
    explanation:verdict.explanation,changesApplied:false};
   out.push(entry);
   this.entries.set(owner+':'+qualityId,{scope,qualityId,opportunityId:opportunity.id,evidenceHash,
    expiresAt:entry.expiresAt,filters:input?.filters||{},accountId:opportunity.accountId,
    report:entry});
  }
  while(this.entries.size>this.maxEntries)this.entries.delete(this.entries.keys().next().value);
  return {...base,quality:out,status:partial?'partial':scan.status};
 }
 detail(qualityId,input,owner){
  const {scope}=this.proposals.authorize(input,owner);
  const saved=this.entries.get(owner+':'+qualityId);
  if(!saved||saved.expiresAt<=this.clock()||!sameScope(saved.scope,scope))
   return {status:'stale',changesApplied:false,reason:'Reavalie a evidência sob a autorização atual.'};
  return {status:'ready',changesApplied:false,quality:saved.report};
 }
 draft(qualityId,action,input,owner){
  if(!['historical','future'].includes(action))throw Error('Ação não autorizada.');
  const {scope}=this.proposals.authorize(input,owner);
  if(unresolvedHierarchy(this.db))return {status:'review_required',changesApplied:false,
   reasons:['d05_hierarchy_target_unresolved'],reason:'Destino D05 pai/filho não homologado para propostas I2-D/E.'};
  const stored=this.entries.get(owner+':'+qualityId);
  if(!stored||stored.expiresAt<=this.clock()||!sameScope(stored.scope,scope))
   return {status:'stale',changesApplied:false,reason:'Evidência expirada ou pertencente a outro escopo.'};
  // Re-read all facts before granting a preview; stale means no new proposal.
  const fresh=this.analysis({...input,filters:stored.filters},owner);
  const current=fresh.quality.find(q=>q.qualityId===qualityId);
  if(!current||current.evidenceHash!==stored.evidenceHash)
   return {status:'stale',changesApplied:false,reason:'Contas, regras, evidências ou valores mudaram.'};
  if(!current.safeForDraft)
   return {status:'review_required',changesApplied:false,
    quality:current,reasons:current.reasons,reason:'Conflitos ou amostra insuficiente; não gerar prévia operacional.'};
  const proposed=this.advisor.propose(current.opportunityId,action,input,owner);
  return {contract:'I2-E/QUALITY-DRAFT-V1',status:proposed.status,changesApplied:false,
   qualityId,action,quality:current,advisoryProposal:proposed,
   warning:'O comando apenas prepara prévia B1 e não confirma nem altera movimentações.'};
 }
 compose(input,owner,items){
  if(unresolvedHierarchy(this.db))return {contract:'I2-E/COMPOSITE-PLAN-V1',status:'review_required',
   changesApplied:false,steps:[],reasons:['d05_hierarchy_target_unresolved']};
  if(!Array.isArray(items)||!items.length||items.length>3||
   items.some(i=>!i||typeof i.qualityId!=='string'||!['historical','future'].includes(i.action)))
   throw Error('Plano composto inválido (1 a 3 ações tipadas).');
  const steps=[],seen=new Set();
  for(const item of items){
   const detail=this.detail(item.qualityId,input,owner);
   if(detail.status!=='ready'){steps.push({status:'stale',changesApplied:false});continue;}
   const p=detail.quality,group=JSON.stringify([p.accountId,p.pattern,p.nature]);
   if(seen.has(group)){
    steps.push({qualityId:item.qualityId,status:'blocked_dependency',changesApplied:false,
     reason:'Outro passo modifica o mesmo padrão; reconstrua as prévias após confirmar o passo anterior.'});
    continue;
   }
   seen.add(group);
   steps.push(this.draft(item.qualityId,item.action,input,owner));
  }
  return {contract:'I2-E/COMPOSITE-PLAN-V1',status:steps.every(s=>s.status==='ready')?'proposed':'partial',
   steps,changesApplied:false,requiresIndividualConfirmation:true,
   notice:'Propostas são independentes; nenhum passo aplica ou confirma outro automaticamente.'};
 }
}
module.exports={EvidenceQualityService,duplicateHeuristics,evidenceVerdict,sourceLabels,unresolvedHierarchy,CONTRACT};
