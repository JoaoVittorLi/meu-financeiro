'use strict';
// I2-E D01/D04 consumption contract; no Electron IPC registration or write rights.
const {stripSensitive,taxonomyGate}=require('./intelligence-category-bridge.cjs');
const CONTRACT='I2-E/QUALITY-BRIDGE-V1';
const METHODS=['qualityCapabilities','qualityScan','qualityDetail','qualityDraft','qualityCompose'];
class EvidenceQualityBridge{
 constructor({quality,baseBridge}={}){
  if(!quality?.analysis||!quality?.draft||!baseBridge?.handle||
     quality.advisor!==baseBridge.advisor)
   throw Error('I2-E e I2-D devem compartilhar o mesmo advisor e serviço IC-READ.');
  this.quality=quality;this.base=baseBridge;
 }
 async handle(request,host){
  const method=request?.method;
  if(!METHODS.includes(method))return this.base.handle(request,host);
  const reply=(status,data=null,reason=null)=>({
   contract:CONTRACT,version:1,method,status,mode:'READ_ONLY_PERSONAL',
   changesApplied:false,modelCalled:false,reason,data:data?stripSensitive(data):null});
  const owner=host?.owner;
  if(!Number.isInteger(owner)||owner<0)return reply('denied',null,'Identidade MAIN inválida.');
  if(method==='qualityCapabilities')return reply('ready',{
   readOnly:true,personalWrites:false,syntheticExecutionExposed:false,
   commands:METHODS.slice(1),requires:['IC-READ','trusted_owner','active_bank_account'],
   evidenceLevels:['insufficient','medium','high'],percentConfidenceSupported:false,
   scope:{accountBound:true,monthBound:true,profileBound:true,grantBound:true},
   d05:{designApproved:true,subcategorySqlReady:false,subcategoryActions:false},
   integrationOwner:'INTEGRATOR_MAIN_IPC_D01_D04',
   disclaimer:'Análise de qualidade nunca confirma, executa ou encadeia alterações.'});
  if(!request?.scope)return reply('denied',null,'Escopo IC-READ ausente.');
  const taxonomy=taxonomyGate(request.target);
  if(taxonomy)return reply('unsupported',taxonomy,taxonomy.reason);
  const scope=request.scope;
  if(scope.source==='bank'&&
    (typeof host?.activeAccountId!=='string'||!host.activeAccountId))
   return reply('denied',null,'Conta ativa confiável é obrigatória.');
  if(scope.source==='bank'&&request.filters?.accountId&&
     request.filters.accountId!==host.activeAccountId)
   return reply('denied',null,'Filtro solicita conta diferente da conta MAIN.');
  const filtered=scope.source==='bank'?
   {...(request.filters||{}),accountId:host.activeAccountId}:request.filters||{};
  const input={...scope,filters:filtered};
  try{
   if(method==='qualityScan'){
    const result=this.quality.analysis(input,owner);
    return reply(result.status,result);
   }
   if(method==='qualityDetail'){
    const result=this.quality.detail(request.qualityId,input,owner);
    if(result.status==='ready'&&scope.source==='bank'&&
       result.quality.accountId!==host.activeAccountId)
     return reply('denied',null,'Análise pertence a outra conta.');
    return reply(result.status,result);
   }
   if(method==='qualityDraft'){
    const existing=this.quality.detail(request.qualityId,input,owner);
    if(existing.status!=='ready')return reply('stale',existing);
    if(scope.source==='bank'&&existing.quality.accountId!==host.activeAccountId)
     return reply('denied',null,'Análise pertence a outra conta.');
    const result=this.quality.draft(request.qualityId,request.action,input,owner);
    return reply(result.status,result);
   }
   if(method==='qualityCompose'){
    if(!Array.isArray(request.items))return reply('denied',null,'Plano tipado obrigatório.');
    for(const item of request.items){
     const existing=this.quality.detail(item?.qualityId,input,owner);
     if(existing.status!=='ready')return reply('stale',existing);
     if(scope.source==='bank'&&existing.quality.accountId!==host.activeAccountId)
      return reply('denied',null,'Plano combina contas distintas.');
    }
    const result=this.quality.compose(input,owner,request.items);
    return reply(result.status,result);
   }
   return reply('unsupported');
  }catch(err){
   const reason=String(err?.message||'');
   const status=/autoriza|escopo|conta|inválid|proibid|permitid/i.test(reason)?'denied':
    /stale|expirad|desatualizad/i.test(reason)?'stale':'unavailable';
   return reply(status,null,'Não foi possível validar o pedido; nenhuma movimentação foi alterada.');
  }
 }
}
module.exports={EvidenceQualityBridge,METHODS,CONTRACT};
