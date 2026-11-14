'use strict';
// RC-ALL-01: integration glue; all personal bridges are read-only.
// Synthetic confirmations use a fresh, proven file-backed TEMP SQLite vault.
const {randomUUID}=require('node:crypto');
const {CategoryProposalService}=require('./intelligence-category-proposals.cjs');
const {IntelligenceCategoryBridge,METHODS}=require('./intelligence-category-bridge.cjs');
const {AtomicSyntheticCategoryExecutor}=require('./intelligence-category-atomic.cjs');
const {createSyntheticFinanceVault,assertSyntheticVault}=require('./intelligence-category-vault.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('./financial-intelligence.cjs');
const {PlanningStore}=require('./planning.cjs');
const PERSONAL=new Set(['capabilities','ask','list','analyze','propose','edit','reject','inspectRule']);
const SANDBOX=new Set(METHODS);
const RESERVED=new Set(['owner','environment','verifiedGesture','token','scope','grant','syntheticExecutor']);
function safeInput(input,allowed){
 if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).some(k=>!allowed.has(k)||RESERVED.has(k)))
  throw Error('Comando de categoria inválido.');
 return input;
}
const PERSONAL_FIELDS=new Set(['method','scope','question','conversationId','actions',
 'selectedIds','ruleId','proposalId','action','params','patch','target']);
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
  this.personal=new IntelligenceCategoryBridge({
   proposals:new CategoryProposalService({db,localFinancial,clock:this.clock})
  });
 }
 personalCall(input,owner){
  if(!Number.isInteger(owner))throw Error('Owner inválido.');
  if(!input||typeof input!=='object'||Array.isArray(input)||
     Object.keys(input).some(k=>k!=='scope'&&!PERSONAL_FIELDS.has(k)))
   throw Error('Comando pessoal inválido.');
  if(!PERSONAL.has(input.method))return {contract:'I2-C/ELECTRON-REVIEW-V1',
   version:1,method:input.method,mode:'READ_ONLY_PERSONAL',
   status:'denied',changesApplied:false,reason:'IA sem escrita pessoal.'};
  return this.personal.handle(input,{owner,environment:'personal',verifiedGesture:false});
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
