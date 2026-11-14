'use strict';
// RC-ALL-01: versioned IC2-READ-QUERY gateway, kept separate from the IC-v1
// renderer and the existing D01-D04 operational/visual surface.
const {IntelligenceOrchestrator}=require('./intelligence-orchestrator.cjs');
const REQUEST_FIELDS=new Set(['token','source','profile','month','question','conversationId','density']);
const STATUSES=new Set(['ready','partial','denied','stale','unavailable','needs_clarification','unsupported']);
function assertIC2(response,input){
 if(!response||response.version!==2||response.contract!=='I2-A/D02-V3'||
  response.readOnly!==true||response.changesApplied!==false||response.modelCalled!==false||
  !STATUSES.has(response.status)||response.source!==input.source||response.profile!==input.profile||
  response.period!==input.month||typeof response.answer!=='string'||response.answer.length>4000||
  typeof response.conversationId!=='string'||
  !Array.isArray(response.facts)||response.facts.length>4||
  !Array.isArray(response.blocks)||response.blocks.length>3||
  !Array.isArray(response.actions)||response.actions.length!==0||
  !Array.isArray(response.followUps)||!Array.isArray(response.alerts))
  throw Error('Contrato IC2 inválido.');
 const ids=new Set();
 for(const fact of response.facts){
  if(!fact||fact.version!==2||typeof fact.id!=='string'||!fact.id.startsWith('i2a:')||
     fact.source!==input.source||fact.profile!==input.profile||
     fact.period?.start?.slice(0,7)!==input.month||fact.period?.end?.slice(0,7)!==input.month||
     !fact.value||typeof fact.value!=='object')throw Error('Fato IC2 fora do escopo.');
  ids.add(fact.id);
 }
 for(const block of response.blocks){
  if(!block||typeof block.kind!=='string'||typeof block.density!=='string'||
    (block.factRef!==null&&!ids.has(block.factRef)))throw Error('Bloco IC2 sem evidência.');
 }
 return response;
}
class IC2ReadQueryGateway{
 constructor(localFinancial,{clock=()=>Date.now()}={}){
  if(!localFinancial||typeof localFinancial.query!=='function')throw Error('IC-READ necessário.');
  this.local=localFinancial;
  this.orchestrator=new IntelligenceOrchestrator({localFinancial,clock});
 }
 async ask(input,owner){
  if(!input||typeof input!=='object'||Array.isArray(input)||
     Object.keys(input).some(k=>!REQUEST_FIELDS.has(k))||
     !Number.isInteger(owner))throw Error('Consulta IC2 inválida.');
  // The existing authoritative grant is checked before and after asynchronous work.
  const check=()=>{
   const r=this.local.query({token:input.token,month:input.month,intent:'radar'},owner);
   if(r?.version!==1||r.readOnly!==true||r.changesApplied!==false||
      r.inferenceCalled!==false||r.references?.source!==input.source||
      r.references?.profile!==input.profile||
      r.references?.period?.start?.slice(0,7)!==input.month)
     throw Error('Concessão financeira inválida.');
  };
  check();
  const response=assertIC2(await this.orchestrator.ask(input,owner),input);
  check();
  // Never serialize a grant or token into a financial answer or fact reference.
  if(JSON.stringify(response).includes(input.token))throw Error('IC2 expôs credencial.');
  return response;
 }
}
module.exports={IC2ReadQueryGateway,assertIC2};