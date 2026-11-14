'use strict';
// I2-B natural-language entrypoint, deliberately conservative. Models may propose
// strictly typed intents, never execute actions or create authorization.
const {ConversationContextStore}=require('./intelligence-context.cjs');
const {OPS}=require('./intelligence-category-proposals.cjs');
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const COLOR_NAMES=Object.freeze({verde:'#2aa898',azul:'#4489ba',vermelho:'#cb6d76',
 amarelo:'#d6934b',laranja:'#d6934b',roxo:'#8b6cb9',cinza:'#87929c'});
function parseCategoryIntent(question,{selectedIds=[],selectedAccountId=null,lastCategory=null}={}){
 const q=String(question||'').trim(),f=fold(q);
 if(!q||q.length>700)throw Error('Pergunta inválida.');
 const nameGroup='([\\p{L}\\p{N}][\\p{L}\\p{N} _-]{0,49})';
 if(/categorias?.*(duplicad|sem uso|nao utilizad|organiza|melhoria|sugest)|melhor.*categorias/.test(f))
  return {type:'category.analyze_usage'};
 if(/^(liste|mostre|quais sao|ver).*(categorias|regras)/.test(f))
  return {type:'category.list'};
 let m=q.match(new RegExp('^(?:crie|criar|adicione|adicionar)\\s+(?:uma?\\s+)?categoria\\s+'+nameGroup+'(?=\\s+na cor\\b|\\s+com a cor\\b|\\s+de cor\\b|[.!?]?$)','iu'));
 if(m){
  const name=m[1].trim(),colorWord=f.match(/(?:na cor|com a cor|de cor)\s+(verde|azul|vermelho|amarelo|laranja|roxo|cinza)\b/);
  return {type:'category.create',params:{name,color:colorWord?COLOR_NAMES[colorWord[1]]:'#87929c',
   kind:'expense',emoji:'✨'}};
 }
 m=q.match(new RegExp('^(?:mude|alter[eoa]|renomeie)\\s+(?:o nome\\s+da\\s+)?categoria\\s+'+nameGroup+'\\s+para\\s+'+nameGroup+'\\s*[.!?]?$','iu'));
 if(m)return {type:'category.update',params:{name:m[1].trim(),newName:m[2].trim()}};
 if(/^(mude|alter|renomeie).*(categoria)/.test(f))
  return {status:'needs_clarification',answer:'Informe o nome atual e o nome desejado para a categoria.'};
 m=q.match(/^categorize\s+(?:minhas?\s+)?(?:compras?\s+)?(?:do|da|de)\s+(.+?)\s+como\s+([\p{L}\p{N} _-]+)[.!?]?$/iu);
 if(m)return {type:'transaction.categorize',params:{selector:m[1].trim(),category:m[2].trim()}};
 if(/(?:categorize|reclassifique).*(?:estas|essas|selecionad)/.test(f)){
  if(!selectedIds.length||!lastCategory)return {status:'needs_clarification',
   answer:'Selecione os IDs das movimentações e informe a categoria desejada.'};
  return {type:'transaction.categorize',params:{category:lastCategory,items:selectedIds}};
 }
 m=q.match(/^(?:exclua|apague|delete)\s+(?:a\s+)?categoria\s+([\p{L}\p{N} _-]+)[.!?]?$/iu);
 if(m)return {type:'category.delete',params:{name:m[1].trim()}};
 if(/regra.*(?:futura|futuras|proximas|pr[oó]ximas)|crie.*regra/.test(f))
  return {status:'needs_clarification',
   answer:'Para propor a regra futura, informe padrão EXATO, categoria, conta autorizada e natureza da movimentação. A prévia não altera o histórico.'};
 if(/movimentac.*(?:alterad|afetad).*(regra)|impacto.*regra/.test(f))
  return {status:'needs_clarification',answer:'Selecione o ID da regra para verificar sua abrangência e precedência.'};
 return {status:'unsupported',
  answer:'Posso investigar categorias ou preparar propostas. Especifique a categoria, a regra ou os lançamentos por ID.'};
}
function validateTypedActions(actions){
 if(!Array.isArray(actions)||!actions.length||actions.length>3)throw Error('Plano de categorias excede três ações.');
 return actions.map(a=>{
  if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['type','params'].includes(k))||
     !OPS.includes(a.type)||!a.params||typeof a.params!=='object'||Array.isArray(a.params))
   throw Error('Plano de categorias inválido.');
  return {type:a.type,params:a.params};
 });
}
class CategoryConversation{
 constructor({proposals,contexts}={}){
  if(!proposals)throw Error('Serviço B1 obrigatório.');
  this.proposals=proposals;this.contexts=contexts||new ConversationContextStore();
 }
 ask(input,owner){
  const opened=this.contexts.open(input,owner),ctx=opened.context;
  const answer=(status,body,extra={})=>({version:1,contract:'I2-B/CHAT-PLANS-V1',
   status,answer:body,conversationId:opened.id,contextReset:opened.wasReset,
   modelCalled:false,changesApplied:false,proposals:[],...extra});
  const selections=Array.isArray(input.selectedIds)?input.selectedIds:[];
  if(selections.length>100)throw Error('Seleção acima do limite.');
  const resolved=input.actions?{actions:validateTypedActions(input.actions)}:
   parseCategoryIntent(input.question||'',{selectedIds:selections,
    selectedAccountId:input.selectedAccountId,lastCategory:ctx.lastCategory});
  if(resolved.status)return answer(resolved.status,resolved.answer);
  if(['category.list','category.analyze_usage'].includes(resolved.type)){
   const catalog=this.proposals.catalog(input,owner);
   const likelyUnused=catalog.categories.filter(c=>c.probablyUnused).map(c=>c.name);
   const duplicates=catalog.possibleDuplicates;
   this.contexts.update(opened.id,owner,ctx,{lastQuestion:input.question});
   return answer('ready',resolved.type==='category.analyze_usage'?
    'Categorias sem referência explícita identificadas: '+likelyUnused.length+
    '. Possíveis nomes repetidos: '+duplicates.length+'. Revisão manual antes de qualquer exclusão.':
    catalog.categories.length+' categorias e '+catalog.rules.length+' regras cadastradas.',
    {catalog,recommendations:{unusedCandidates:likelyUnused,possibleDuplicates:duplicates,
     caveat:catalog.caveat}});
  }
  const actions=resolved.actions??[{type:resolved.type,params:resolved.params}];
  const proposals=[];
  let dependency=null;
  for(const [index,a] of actions.entries()){
   if(dependency){
    proposals.push({actionType:a.type,status:'blocked_dependency',
     dependsOn:dependency,reason:'Confirme primeiro a ação anterior; gere uma nova prévia com o estado atualizado.'});
    continue;
   }
   const proposal=this.proposals.preview(a.type,a.params,input,owner);
   proposals.push(proposal);
   if(a.type==='category.create'&&index<actions.length-1)dependency=proposal.proposalId;
  }
  this.contexts.update(opened.id,owner,ctx,{lastQuestion:input.question,
   lastCategory:actions.at(-1).params.category??actions.at(-1).params.name??ctx.lastCategory,
   lastProposalIds:proposals.map(p=>p.proposalId).filter(Boolean)});
  const blocked=proposals.some(p=>p.status==='blocked');
  return answer(blocked?'partial':'proposed',
   proposals.length+' etapa(s) preparada(s) para revisão; nenhuma alteração foi aplicada.',
   {proposals,requiresExplicitConfirmation:true});
 }
}
module.exports={CategoryConversation,parseCategoryIntent,validateTypedActions};