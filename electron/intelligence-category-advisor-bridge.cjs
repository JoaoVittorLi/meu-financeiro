'use strict';
// I2-D D2: conversational continuation for evidence-backed opportunities only.
// Reuses the I2-A scoped/ephemeral ConversationContextStore, I2-B proposals,
// and I2-C bridge; no free-form model writes or external inference.
const {ConversationContextStore}=require('./intelligence-context.cjs');
const {IntelligenceCategoryBridge,taxonomyGate,stripSensitive}=require('./intelligence-category-bridge.cjs');
const CONTRACT='I2-D/ADVISORY-BRIDGE-V1';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const ORDINALS={primeira:0,primeiro:0,segunda:1,segundo:1,terceira:2,terceiro:2};
function intentOf(question){
 const q=normalize(question);
 if(q.length>500)throw Error('Pergunta excede limite de contexto.');
 if(!q)return {status:'needs_clarification',answer:'Descreva o que deseja investigar nas categorias.'};
 const ordinal=Object.entries(ORDINALS).find(([word])=>new RegExp('\\b'+word+'\\b').test(q));
 const action=/(?:crie|criar|prepare|proponha|proposta|regra)/.test(q)&&/regra|futuras|proximas/.test(q)?
  'future':/reclassifi|categorize|compras|lancamentos|movimentacoes/.test(q)?'historical':null;
 if(action)return {action,ordinal:ordinal?.[1]??null};
 if(/categorias|classificac|padroes|estabelec|duplicad|sem uso|organiz|sugest|i?food|inconsisten/.test(q))
  return {action:'discover'};
 return {status:'needs_clarification',
  answer:'Posso investigar categorias ou preparar uma proposta para uma sugestão específica por ID.'};
}
class ProactiveCategoryConversation{
 constructor({advisor,contexts}={}){
  if(!advisor?.scan||!advisor?.propose)throw Error('Motor de oportunidades obrigatório.');
  this.advisor=advisor;this.contexts=contexts||new ConversationContextStore();
 }
 ask(input,owner){
  const opened=this.contexts.open(input,owner),ctx=opened.context;
  const intent=intentOf(input?.question),format=(status,answer,extra={})=>({
   contract:'I2-D/ADVISORY-CHAT-V1',status,answer,conversationId:opened.id,
   contextReset:opened.wasReset,changesApplied:false,modelCalled:false,...extra});
  if(intent.status)return format(intent.status,intent.answer);
  if(intent.action==='discover'){
   const data=this.advisor.scan(input,owner);
   this.contexts.update(opened.id,owner,ctx,{lastOpportunityIds:data.opportunities.map(o=>o.id),
    lastQuestion:input.question,lastFilters:input.filters||{}});
   return format(data.status,'Investigação baseada em correções humanas e registros locais. Nenhuma alteração foi aplicada.',
    {data,followUps:data.opportunities.slice(0,3).flatMap((o,i)=>[
     {intent:'inspect',opportunityId:o.id,label:'Examinar padrão '+(i+1)},
     {intent:'draft_future',opportunityId:o.id,label:'Preparar regra futura '+(i+1)}])});
  }
  const ids=ctx.lastOpportunityIds||[];
  const id=input?.opportunityId||((intent.ordinal!==null&&intent.ordinal!==undefined)?ids[intent.ordinal]:
   ids.length===1?ids[0]:null);
  if(!id)return format('needs_clarification',
   'Escolha o ID da sugestão ou diga "primeira/segunda" após uma investigação.');
  const result=this.advisor.propose(id,intent.action,input,owner);
  this.contexts.update(opened.id,owner,ctx,{lastQuestion:input.question});
  return format(result.status,result.status==='ready'?
   'Prévia preparada. Revise todos os IDs e confirme separadamente na Central de Revisão.':
   'Não é seguro preparar a alteração com a evidência atual.',{proposal:result});
 }
}
class ProactiveCategoryBridge{
 constructor({advisor,baseBridge,conversation}={}){
  if(!advisor?.scan||!baseBridge?.handle)throw Error('I2-D requer I2-B e I2-C.');
  this.advisor=advisor;this.base=baseBridge;
  this.conversation=conversation||new ProactiveCategoryConversation({advisor});
 }
 async handle(request,host){
  const method=request?.method;
  if(!['discover','inspectOpportunity','draftOpportunity','advice'].includes(method))
   return this.base.handle(request,host);
  const owner=host?.owner,reply=(status,data,reason='')=>({
   contract:CONTRACT,version:1,method,status,mode:'READ_ONLY_PERSONAL',
   changesApplied:false,modelCalled:false,reason,data:stripSensitive(data||{})});
  if(!Number.isInteger(owner)||owner<0||!request?.scope)return reply('denied',null,'Autorização IC-READ necessária.');
  const taxonomy=taxonomyGate(request.target);
  if(taxonomy)return reply('unsupported',taxonomy,taxonomy.reason);
  try{
   if(method==='discover')return reply('ready',this.advisor.scan({...request.scope,filters:request.filters},owner));
   if(method==='inspectOpportunity'){
    const r=this.advisor.detail(request.opportunityId,request.scope,owner);
    return reply(r.status,r);
   }
   if(method==='advice'){
    const result=this.conversation.ask({...request.scope,question:request.question,
     conversationId:request.conversationId,filters:request.filters,
     opportunityId:request.opportunityId},owner);
    return reply(result.status,result);
   }
   if(!['historical','future'].includes(request.action))return reply('denied',null,'Tipo de proposta inválido.');
   const inspected=this.advisor.detail(request.opportunityId,request.scope,owner);
   if(inspected.status!=='ready')return reply('stale',inspected);
   if(typeof host?.activeAccountId!=='string'||host.activeAccountId!==inspected.opportunity.accountId)
    return reply('denied',null,'A conta ativa no MAIN difere da sugestão.');
   const result=this.advisor.propose(request.opportunityId,request.action,request.scope,owner);
   if(result.proposal?.status==='ready'&&host?.environment==='synthetic'&&this.base.syntheticExecutor){
    this.base.syntheticExecutor.armProposal(result.proposal.proposalId,request.scope,owner);
    result.proposal={...result.proposal,capability:'synthetic_hardened',mayExecuteSynthetic:true};
   }
   return reply(result.status,result);
  }catch(err){
   const m=String(err?.message||'');
   const status=/Autoriz|autoriza|escopo|Conta|conta|inválid|proibid/.test(m)?'denied':'unavailable';
   return reply(status,null,'Não foi possível validar os dados ou a autorização; nenhuma alteração aplicada.');
  }
 }
}
module.exports={ProactiveCategoryConversation,ProactiveCategoryBridge,intentOf,CONTRACT};