'use strict';
// I2-A2: safe planning adapter. Disabled unless explicitly constructed for synthetic fixtures.
// This module contains no fetch, endpoints, API keys, token persistence or external network path.
const {TOOL_NAMES,paramsOf}=require('./intelligence-tools.cjs');
function validatePlan(plan){
 if(!plan||typeof plan!=='object'||Array.isArray(plan)||!Array.isArray(plan.steps)||
    plan.steps.length<1||plan.steps.length>4)throw Error('Plano de investigação inválido.');
 if(Object.keys(plan).some(k=>!['steps','visualKind'].includes(k)))throw Error('Campos do plano não permitidos.');
 const steps=plan.steps.map(s=>{
  if(!s||typeof s!=='object'||Object.keys(s).some(k=>!['tool','params'].includes(k))||
     !TOOL_NAMES.includes(s.tool))throw Error('Ferramenta de planejamento não autorizada.');
  return {tool:s.tool,params:paramsOf(s.tool,s.params||{})};
 });
 const visualKind=plan.visualKind??null;
 if(visualKind!==null&&!['summary','kpi','compare','treemap','sankey','rank','drilldown',
   'table','budget','whatif','quality','state'].includes(visualKind))
  throw Error('Visualização não permitida.');
 return {steps,visualKind};
}
class SyntheticPlanningAdapter{
 constructor({plan,enabled=false,clock=()=>Date.now(),maxCharacters=500,maxMs=1500}={}){
  if(plan!==undefined&&typeof plan!=='function')throw Error('Planejador inválido.');
  this.plan=plan;this.enabled=enabled;this.clock=clock;this.maxCharacters=maxCharacters;this.maxMs=maxMs;
 }
 async propose({question,scope,context}){
  if(!this.enabled||typeof this.plan!=='function')return null;
  if(scope?.profile!=='demo'||scope?.source!=='manual')return null;
  if(typeof question!=='string'||question.length>this.maxCharacters)
   throw Error('Pergunta acima do orçamento de contexto.');
  // Only the short question and non-financial scope metadata go into the mock planner.
  const start=this.clock();
  const proposal=await this.plan({question,month:scope.month,
   allowedTools:[...TOOL_NAMES],lastTools:context?.lastPlan?.steps?.map(x=>x.tool)||[]});
  if(this.clock()-start>this.maxMs)throw Error('Planejador excedeu o tempo limite.');
  return validatePlan(proposal);
 }
}
module.exports={SyntheticPlanningAdapter,validatePlan};