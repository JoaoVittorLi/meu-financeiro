'use strict';
// RC-ALL-01: integration glue; all personal bridges are read-only.
// Synthetic confirmations use a fresh, proven file-backed TEMP SQLite vault.
const {randomUUID}=require('node:crypto');
const {CategoryProposalService}=require('./intelligence-category-proposals.cjs');
const {IntelligenceCategoryBridge,METHODS}=require('./intelligence-category-bridge.cjs');
const {ProactiveCategoryAdvisor}=require('./intelligence-category-opportunities.cjs');
const {ProactiveCategoryBridge}=require('./intelligence-category-advisor-bridge.cjs');
const {EvidenceQualityService}=require('./intelligence-category-quality.cjs');
const {EvidenceQualityBridge}=require('./intelligence-category-quality-bridge.cjs');
const {D05CategoryService}=require('./d05-category-service.cjs');
const {normalizeLabel}=require('./db.cjs');
const {AtomicSyntheticCategoryExecutor}=require('./intelligence-category-atomic.cjs');
const {createSyntheticFinanceVault,assertSyntheticVault}=require('./intelligence-category-vault.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('./financial-intelligence.cjs');
const {PlanningStore}=require('./planning.cjs');
const PERSONAL=new Set(['capabilities','ask','list','analyze','propose','edit','reject','inspectRule',
 'qualityCapabilities','qualityScan','qualityDetail','qualityDraft','qualityCompose']);
const SANDBOX=new Set(METHODS);
const RESERVED=new Set(['owner','environment','verifiedGesture','token','scope','grant','syntheticExecutor']);
function safeInput(input,allowed){
 if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).some(k=>!allowed.has(k)||RESERVED.has(k)))
  throw Error('Comando de categoria inválido.');
 return input;
}
const PERSONAL_FIELDS=new Set(['method','scope','question','conversationId','actions',
 'selectedIds','ruleId','proposalId','action','params','patch','target','qualityId','filters','items']);
const SANDBOX_FIELDS=new Set(['sessionId','method','question','conversationId','actions',
 'selectedIds','ruleId','proposalId','action','params','patch','target','confirmationNonce']);
const SETTINGS={opening:0,income:0,fixed:0,existing:0,reserve:0};
class RCCategoryGateway{
 constructor({db,localFinancial,clock=()=>Date.now()}={}){
  this.clock=clock;this.sandbox=null;
  this.bindPersonal(db,localFinancial);
 }
 bindPersonal(db,localFinancial){
  if(!db||!localFinancial)throw Error('FinanceDB e IC-READ necessários.');
  const base=new IntelligenceCategoryBridge({
   proposals:new CategoryProposalService({db,localFinancial,clock:this.clock})
  });
  const advisor=new ProactiveCategoryAdvisor({proposals:base.proposals,clock:this.clock});
  const advisory=new ProactiveCategoryBridge({advisor,baseBridge:base});
  const quality=new EvidenceQualityService({advisor,clock:this.clock});
  this.personal=new EvidenceQualityBridge({quality,baseBridge:advisory});
  this.quality=quality;this.qualityBase=base;this.finance=db;
 }
 async personalCall(input,owner,mainHost={}){
  if(!Number.isInteger(owner))throw Error('Owner inválido.');
  if(!input||typeof input!=='object'||Array.isArray(input)||
     Object.keys(input).some(k=>k!=='scope'&&!PERSONAL_FIELDS.has(k)))
   throw Error('Comando pessoal inválido.');
  if(!PERSONAL.has(input.method))return {contract:'I2-C/ELECTRON-REVIEW-V1',
   version:1,method:input.method,mode:'READ_ONLY_PERSONAL',
   status:'denied',changesApplied:false,reason:'IA sem escrita pessoal.'};
  // Do not let the legacy flat-name B1 path generate ambiguous bank/rule
  // proposals once the D05 14x61 hierarchy is active. Proactive plans must
  // go through qualityDraft with a resolved categoryId/subcategoryId.
  const ambiguity=(input.method==='propose'&&
    (/^(transaction\.|rule\.)/.test(String(input.action||''))))||
   (input.method==='ask'&&(
    input.actions?.some?.(x=>/^(transaction\.|rule\.)/.test(String(x?.type||'')))||
    /^\s*(categorize|reclassifique|crie.*regra|criar.*regra)/i.test(String(input.question||''))));
  if(ambiguity)return {contract:'I2-E/D05-HIERARCHY-GATE-V1',
   status:'review_required',mode:'READ_ONLY_PERSONAL',changesApplied:false,
   reason:'Destino D05 deve ser validado por categoryId e subcategoryId (null permitido) após evidência I2-E; prévia plana bloqueada.'};
  const host={owner,environment:'personal',verifiedGesture:false,
   activeAccountId:typeof mainHost.activeAccountId==='string'?mainHost.activeAccountId:null};
  if(input.method==='qualityDraft'&&input.target)
   return this.d05QualityDraft(input,host);
  if(input.method==='qualityCompose'&&input.items?.some?.(v=>v?.target))
   return this.d05QualityCompose(input,host);
  return this.personal.handle(input,host);
 }
 async d05QualityDraft(input,host){
  const deny=(status,reason,data=null)=>({contract:'I2-E/D05-RESOLVED-PREVIEW-V1',
   status,changesApplied:false,modelCalled:false,mode:'READ_ONLY_PERSONAL',reason,data});
  if(input.action!=='historical')
   return deny('review_required','Regra bancária futura ainda não possui limite por conta/afterRowid no contrato D05.');
  const scope=input.scope;
  if(scope?.source!=='bank'||!host.activeAccountId)
   return deny('denied','Prévia proativa exige fonte bancária e conta autorizada no MAIN.');
  const target=input.target;
  if(!target||typeof target!=='object'||Array.isArray(target)||
     Object.keys(target).some(k=>!['categoryId','subcategoryId'].includes(k))||
     typeof target.categoryId!=='string'||!Object.prototype.hasOwnProperty.call(target,'subcategoryId'))
   return deny('review_required','Selecione categoria-pai e filho explícito ou null; não inferir texto.');
  let resolved;
  try{resolved=new D05CategoryService(this.finance).resolve(target);}
  catch{return deny('review_required','Destino D05 ausente, inativo ou incompatível.');}
  const detail=await this.personal.handle({method:'qualityDetail',scope,qualityId:input.qualityId},host);
  const q=detail?.data?.quality;
  if(detail.status!=='ready'||!q||q.accountId!==host.activeAccountId)
   return deny('stale','Evidência de qualidade ausente ou vinculada a outra conta.');
  // The old advisor label may refer to a child ("Delivery"), not a parent.
  const label=resolved.child?.name||resolved.parentName;
  if(normalizeLabel(label)!==normalizeLabel(q.category))
   return deny('review_required','Destino não corresponde à categoria comprovada pelos ajustes manuais.');
  const reasons=(q.reasons||[]).filter(x=>!['unsupported_source','d05_hierarchy_target_unresolved'].includes(x));
  const n=q.candidateSummary?.count;
  if(reasons.length||q.anchorSummary?.count<2||q.anchorSummary?.independentDates<2||
     !Number.isSafeInteger(n)||n<1||n>10||
     q.candidateSummary?.examples?.length!==n||
     !Number.isSafeInteger(q.candidateSummary?.amountCents)||
     q.duplicateWarnings?.length||q.rulePrecedence?.willShadowFutureRule)
   return deny('review_required','Evidência insuficiente ou lote acima de dez IDs verificáveis; não gerar prévia.',{reasons});
  const fresh=this.quality.analysis({...scope,filters:{accountId:host.activeAccountId}},host.owner);
  const now=fresh.quality?.find(v=>v.qualityId===q.qualityId);
  if(!now||now.evidenceHash!==q.evidenceHash)
   return deny('stale','Evidências ou regras mudaram desde a análise de qualidade.');
  const items=q.candidateSummary.examples.map(r=>{
   let pair;
   try{pair=JSON.parse(String(r.id||''));}catch{throw Error('Evidência I2-E com ID inválido');}
   if(!Array.isArray(pair)||pair.length!==2||pair[0]!==host.activeAccountId||
      typeof pair[1]!=='string'||!pair[1])
    throw Error('ID de evidência fora da conta ativa');
   return {accountId:host.activeAccountId,externalId:pair[1]};
  });
  const preview=new D05CategoryService(this.finance).previewBankBatch({items,target});
  if(preview.count!==items.length)
   return deny('stale','A prévia D05 não corresponde aos IDs da análise de qualidade.');
  return deny('ready','Prévia D05 de leitura: requer um gateway pessoal homologado para executar.',{
   quality:q,action:'historical',target:{categoryId:resolved.categoryId,subcategoryId:resolved.subcategoryId},
   previewVersion:preview.previewVersion,items,
   count:preview.count,amountCents:preview.amountCents,
   personalWriteAuthorized:false,requiresExplicitConfirmation:true
  });
 }
 async d05QualityCompose(input,host){
  const base={contract:'I2-E/D05-COMPOSITE-PREVIEW-V1',changesApplied:false,
   modelCalled:false,mode:'READ_ONLY_PERSONAL'};
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>3)
   return {...base,status:'denied',reason:'Plano de 1 a 3 ações obrigatório.'};
  const steps=[],seen=new Set();
  for(const item of input.items){
   const result=await this.d05QualityDraft({...input,qualityId:item?.qualityId,
    action:item?.action,target:item?.target},host);
   const ids=result.data?.items||[];
   if(ids.some(v=>seen.has(v.accountId+'|'+v.externalId))){
    steps.push({...result,status:'blocked_dependency',data:null});continue;
   }
   for(const v of ids)seen.add(v.accountId+'|'+v.externalId);
   steps.push(result);
  }
  return {...base,status:steps.every(x=>x.status==='ready')?'proposed':'partial',
   steps,requiresIndividualConfirmation:true};
 }
 startSandbox(month,owner){
  if(!Number.isInteger(owner)||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))
   throw Error('Selecione o mês de demonstração válido.');
  this.stopAll();
  const vault=createSyntheticFinanceVault();
  try{
   assertSyntheticVault(vault,vault.db);
   // Data invented inside the vault. NEVER import user or Pluggy records here.
   vault.db.save('demo',{version:5,transactions:[
    {id:'demo-market',date:month+'-05',description:'Mercado de demonstração',kind:'expense',amount:4500,category:'Alimentação'},
    {id:'demo-delivery',date:month+'-08',description:'Delivery de demonstração',kind:'expense',amount:2190,category:'Alimentação'},
    {id:'demo-transport',date:month+'-12',description:'Transporte de demonstração',kind:'expense',amount:1200,category:'Transporte'}
   ],budgets:{Alimentação:15000},settings:SETTINGS});
   const local=new LocalFinancialIntelligence(vault.db,new PlanningStore(vault.db),{clock:this.clock});
   const grant=local.authorize({consent:CONSENT,source:'manual',profile:'demo',planning:false},owner);
   const scope={token:grant.token,source:'manual',profile:'demo',month};
   const proposals=new CategoryProposalService({db:vault.db,localFinancial:local,clock:this.clock});
   const session={id:randomUUID(),owner,vault,local,grant,scope,proposals,
    bridge:null,approval:null,confirmBusy:false};
   const executor=new AtomicSyntheticCategoryExecutor({proposals,vault,clock:this.clock,
    authorizer:async request=>session.approval===request.proposalId&&
     session.owner===request.owner&&this.sandbox===session});
   session.bridge=new IntelligenceCategoryBridge({proposals,syntheticExecutor:executor});
   this.sandbox=session;
   return {sessionId:session.id,month,source:'manual',profile:'demo',
    expiresAt:grant.expiresAt,mode:'SYNTHETIC_PREVIEW',
    notice:'Somente três movimentações inventadas, em SQLite TEMP independente. Sem importação bancária.'};
  }catch(err){vault.destroy();throw err;}
 }
 requireSandbox(sessionId,owner){
  const s=this.sandbox;
  if(!s||s.id!==sessionId||s.owner!==owner||s.grant.expiresAt<=this.clock())
   throw Error('Laboratório sintético ausente ou expirado. Inicie nova sessão.');
  assertSyntheticVault(s.vault,s.vault.db);
  // Revalidate the read grant on every operation, including a confirmation.
  s.local.query({token:s.scope.token,month:s.scope.month,intent:'radar'},owner);
  return s;
 }
 async sandboxCall(input,owner,verifyConfirmation){
  safeInput(input,SANDBOX_FIELDS);
  const s=this.requireSandbox(input.sessionId,owner);
  if(!SANDBOX.has(input.method))throw Error('Método do laboratório inválido.');
  const request={...input,scope:s.scope};
  delete request.sessionId;
  const host={owner,environment:'synthetic',verifiedGesture:false};
  if(input.method!=='confirm'){
   const result=await s.bridge.handle(request,host);
   if(this.sandbox!==s)return {contract:'I2-C/ELECTRON-REVIEW-V1',version:1,
    status:'stale',mode:'SYNTHETIC_PREVIEW',changesApplied:false};
   return result;
  }
  if(s.confirmBusy)return {contract:'I2-C/ELECTRON-REVIEW-V1',version:1,
   status:'denied',changesApplied:false,reason:'Outra confirmação já está em andamento.'};
  s.confirmBusy=true;
  try{
   const p=s.proposals.previews.get(input.proposalId);
   if(!p||p.owner!==owner||p.expiresAt<=this.clock()||
      p.confirmationNonce!==input.confirmationNonce||p.state.conflicts.length)
    return {contract:'I2-C/ELECTRON-REVIEW-V1',version:1,
     status:'stale',changesApplied:false,reason:'Prévia não confirmável.'};
   if(typeof verifyConfirmation!=='function')throw Error('Confirmação nativa obrigatória.');
   const approved=await verifyConfirmation({action:p.state.action,
    proposalId:p.id,changes:p.state.impact?.count??0,amountCents:p.state.impact?.amountCents??null,
    before:p.state.before,after:p.state.after,syntheticOnly:true});
   if(approved!==true||this.sandbox!==s)return {contract:'I2-C/ELECTRON-REVIEW-V1',
    version:1,status:'denied',changesApplied:false,reason:'Confirmação cancelada.'};
   this.requireSandbox(s.id,owner);
   s.approval=p.id;
   return await s.bridge.handle(request,{...host,verifiedGesture:true});
  }finally{s.approval=null;s.confirmBusy=false;}
 }
 stopSandbox(sessionId,owner){
  const s=this.sandbox;
  if(!s||s.owner!==owner||s.id!==sessionId)
   return {closed:false};
  this.stopAll();return {closed:true};
 }
 stopAll(){
  const s=this.sandbox;this.sandbox=null;
  if(s){s.approval=null;s.vault.destroy();}
 }
}
module.exports={RCCategoryGateway,PERSONAL,SANDBOX};
