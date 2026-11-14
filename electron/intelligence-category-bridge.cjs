'use strict';
// I2-C C2: main-side adapter contract, not registered as Electron IPC.
// Integration owner must bind owner/verifiedGesture from a trusted Electron MAIN
// handler; renderer and LLM text must never manufacture either value.
const {CategoryConversation}=require('./intelligence-category-conversation.cjs');
const {OPS}=require('./intelligence-category-proposals.cjs');
const {WRITE_CONSENT}=require('./intelligence-category-actions.cjs');
const VERSION='I2-C/ELECTRON-REVIEW-V1';
const METHODS=Object.freeze(['capabilities','ask','list','analyze','propose','edit',
 'reject','inspectRule','confirm','receipt','recovery','history']);
function stripSensitive(value){
 return JSON.parse(JSON.stringify(value,(key,v)=>{
  if(['token','grant','grantToken','scopeHash','nonceHash','secret','accessToken',
   'apiKey','credential','password','rawSql','sql'].includes(key))return undefined;
  return v;
 }));
}
function taxonomyGate(target){
 if(!target)return null;
 if(Object.prototype.hasOwnProperty.call(target,'subcategoryId')||
    Object.prototype.hasOwnProperty.call(target,'categoryId'))
  return {status:'unsupported',reason:'Destino {categoryId,subcategoryId} D05 ainda não implementado no SQLite; não converter implicitamente para nome de categoria.',
   needs:'D05_SUBCATEGORY_APPROVED_SCHEMA',changesApplied:false};
 if(target.level===undefined||target.level==='category')return null;
 if(target.level==='subcategory')return {status:'unsupported',
  reason:'Subcategorias aguardam contrato e homologação D05. Nenhuma migração ou escrita foi feita.',
  needs:'D05_SUBCATEGORY_APPROVED_SCHEMA',changesApplied:false};
 return {status:'denied',reason:'Tipo de classificação inválido.',changesApplied:false};
}
class IntelligenceCategoryBridge{
 constructor({proposals,conversation,syntheticExecutor=null}={}){
  if(!proposals)throw Error('Serviço de propostas obrigatório.');
  this.proposals=proposals;
  this.conversation=conversation||new CategoryConversation({proposals});
  this.syntheticExecutor=syntheticExecutor;
 }
 capabilities(){
  return {version:1,contract:VERSION,read:'READ_ONLY_PERSONAL',
   write:this.syntheticExecutor?'SYNTHETIC_WRITE_ONLY':'DISABLED',
   commands:[...METHODS],
   taxonomy:{supported:['category'],subcategory:{
    state:'awaiting_approved_D05_contract',schemaVersion:null,writeEnabled:false,
    parentBinding:'not_defined',migration:'not_authorized'}},
   notice:'Ações pessoais da IA permanecem desabilitadas; o IPC do MAIN pertence ao Integrador.'};
 }
 async handle(request,host){
  const method=request?.method;
  const owner=host?.owner;
  const base={contract:VERSION,version:1,method,mode:'READ_ONLY_PERSONAL',
   changesApplied:false,status:'unavailable'};
  if(!Number.isInteger(owner)||owner<0)
   return {...base,status:'denied',reason:'Identidade MAIN inválida.'};
  if(!METHODS.includes(method))
   return {...base,status:'unsupported',reason:'Comando não permitido.'};
  if(method==='capabilities')
   return {...base,status:'ready',capabilities:this.capabilities()};
  if(!request?.scope||typeof request.scope!=='object')
   return {...base,status:'denied',reason:'Autorização IC-READ obrigatória.'};
  // Subcategory is never silently coerced into a parent category.
  const taxonomy=taxonomyGate(request.target);
  if(taxonomy)return {...base,...taxonomy};
  try{
   const scope=request.scope;
   let result;
   switch(method){
    case 'ask':
     result=this.conversation.ask({...scope,question:request.question,
      conversationId:request.conversationId,actions:request.actions,
      selectedIds:request.selectedIds,ruleId:request.ruleId,
      proposalId:request.proposalId},owner);
     break;
    case 'list':
    case 'analyze':
     result=this.conversation.ask({...scope,conversationId:request.conversationId,
      question:method==='list'?'Liste categorias e regras':'Quais categorias estão duplicadas ou sem uso?'},owner);
     break;
    case 'propose':
     if(!OPS.includes(request.action))return {...base,status:'unsupported'};
     result=this.proposals.preview(request.action,request.params,scope,owner);break;
    case 'edit':
     result=this.proposals.revise(request.proposalId,request.patch,scope,owner);break;
    case 'reject':
     result=this.proposals.discard(request.proposalId,scope,owner);break;
    case 'inspectRule':
     result=this.proposals.inspectRule(scope,owner,
      {proposalId:request.proposalId,ruleId:request.ruleId});break;
    case 'confirm':
     if(!this.syntheticExecutor)return {...base,status:'denied',
      reason:'Execução pessoal pela IA não autorizada.'};
     if(host?.verifiedGesture!==true||host?.environment!=='synthetic')
      return {...base,status:'denied',reason:'Gesto humano no MAIN e ambiente sintético obrigatórios.'};
     result=await this.syntheticExecutor.confirm({scope,proposalId:request.proposalId,
      nonce:request.confirmationNonce,consent:WRITE_CONSENT},owner);
     return {...base,mode:'SYNTHETIC_WRITE_ONLY',status:result.status,
      changesApplied:result.changesApplied??null,data:stripSensitive(result)};
    case 'receipt':
    case 'recovery':
     if(!this.syntheticExecutor||host?.environment!=='synthetic')
      return {...base,status:'denied',reason:'Recibo sintético indisponível neste ambiente.'};
     result=this.syntheticExecutor.readReceipt({scope,proposalId:request.proposalId},owner);
     return {...base,mode:'SYNTHETIC_WRITE_ONLY',status:result.status,
      changesApplied:result.changesApplied,data:stripSensitive(result)};
    case 'history':
     if(!this.syntheticExecutor||host?.environment!=='synthetic')
      return {...base,status:'denied'};
     result=this.syntheticExecutor.listReceipts(scope,owner);
     return {...base,mode:'SYNTHETIC_WRITE_ONLY',status:'ready',data:stripSensitive(result)};
    default:return {...base,status:'unsupported'};
   }
   return {...base,status:result.status??'ready',data:stripSensitive(result)};
  }catch(err){
   const str=String(err?.message||'');
   const status=/expirad|desatualizad|não pertence|escopo/.test(str)?'stale':
    /autoriza|consent|perfil|proibid|inválid/.test(str)?'denied':'unavailable';
   return {...base,status,reason:'A operação não pôde ser validada. Nenhum comando pessoal foi executado.'};
  }
 }
}
module.exports={IntelligenceCategoryBridge,METHODS,VERSION,taxonomyGate,stripSensitive};