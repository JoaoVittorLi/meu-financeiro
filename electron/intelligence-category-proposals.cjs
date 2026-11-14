'use strict';
// I2-B B1: deterministic, read-only category investigations and proposals.
// No SQL writes here; FinanceDB remains the single source of validation and truth.
const {createHash,randomUUID}=require('node:crypto');
const {scopeOf,sameScope}=require('./intelligence-context.cjs');
const {normalizeLabel,categoryEmoji}=require('./db.cjs');
const OPS=Object.freeze([
 'category.create','category.update','category.delete',
 'transaction.categorize','rule.create','rule.update','rule.delete'
]);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const safeName=value=>{const name=String(value||'').trim();if(!name||name.length>50||/[\x00-\x1f<>]/.test(name))throw Error('Nome de categoria inválido.');return name;};
const color=value=>{if(typeof value!=='string'||!/^#[0-9a-fA-F]{6}$/.test(value))throw Error('Cor hexadecimal inválida.');return value.toLowerCase();};
const isKind=value=>['expense','income','both'].includes(value);
const matchKind=(categoryKind,rowKind)=>categoryKind==='both'||categoryKind===rowKind;
const allowKeys=(obj,keys)=>{if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(k=>!keys.includes(k)))throw Error('Parâmetros não autorizados.');};
const statementCount=(sql,query,args=[])=>sql.prepare(query).get(...args)?.n||0;
function usage(sql,name){
 const run=(table,column)=>statementCount(sql,'SELECT COUNT(*) AS n FROM '+table+' WHERE '+column+'=?',[name]);
 const has=table=>!!sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
 return {
  manualReal:statementCount(sql,"SELECT COUNT(*) AS n FROM transactions WHERE profile='real' AND category=?",[name]),
  manualDemo:statementCount(sql,"SELECT COUNT(*) AS n FROM transactions WHERE profile='demo' AND category=?",[name]),
  budgets:run('budgets','category'),rules:run('category_rules','category'),
  overrides:run('bank_category_overrides','category'),splits:run('bank_transaction_splits','category'),
  planning:has('planned_items')?run('planned_items','category'):0,
  bankProviderRaw:run('bank_transactions','category')
 };
}
const referenceCount=u=>Object.entries(u).filter(([k])=>k!=='bankProviderRaw').reduce((s,[,v])=>s+v,0);
function readGuard(local,scope){
 const r=local.query({token:scope.token,month:scope.month,intent:'radar'},scope.owner);
 if(r?.readOnly!==true||r?.changesApplied!==false||r?.inferenceCalled!==false||
    r?.references?.source!==scope.source||r?.references?.profile!==scope.profile)
  throw Error('Autorização IC-READ inválida.');
 return r.references;
}
function normalizeAction(action,raw){
 if(!OPS.includes(action))throw Error('Ação de categoria não suportada.');
 const params=raw??{};allowKeys(params,['name','previousName','newName','kind','color','emoji','category',
  'ruleId','pattern','matchMode','scope','priority','accountId','nature','futureOnly','items','selector','replaceManual']);
 if(action.startsWith('category.')){
  if(action==='category.create'){
   const name=safeName(params.name),chosen=color(params.color);
   const kind=params.kind??'expense';if(!isKind(kind))throw Error('Tipo inválido.');
   const emoji=categoryEmoji(params.emoji??'✨');
   return {name,color:chosen,kind,emoji};
  }
  const name=safeName(params.name);
  if(action==='category.delete')return {name};
  const newName=safeName(params.newName??params.name);
  const chosen=params.color==null?null:color(params.color);
  if(params.kind!=null&&!isKind(params.kind))throw Error('Tipo inválido.');
  if(params.emoji!=null)categoryEmoji(params.emoji);
  return {name,newName,color:chosen,emoji:params.emoji??null,kind:params.kind??null};
 }
 if(action==='transaction.categorize'){
  const category=safeName(params.category);
  const items=params.items??[];
  if(!Array.isArray(items)||items.length>100||items.some(x=>!x||typeof x!=='object'||
     Array.isArray(x)||Object.keys(x).some(k=>!['id','accountId','externalId'].includes(k))))
   throw Error('Seleção inválida.');
  const selector=params.selector==null?null:String(params.selector).trim();
  if(selector!==null&&(!selector||selector.length>100))throw Error('Filtro inválido.');
  if(!items.length&&!selector)throw Error('Informe IDs ou um filtro de descrição.');
  if(typeof params.replaceManual!=='boolean'&&params.replaceManual!==undefined)throw Error('Substituição inválida.');
  return {category,items,selector,replaceManual:params.replaceManual===true};
 }
 if(action==='rule.delete'||action==='rule.update'){
  if(!Number.isInteger(params.ruleId)||params.ruleId<=0)throw Error('ID de regra inválido.');
  if(action==='rule.delete')return {ruleId:params.ruleId};
 }
 const pattern=params.pattern===undefined?null:String(params.pattern).trim();
 if(pattern!==null&&(!pattern||pattern.length>120||/[\x00-\x1f]/.test(pattern)))throw Error('Padrão de regra inválido.');
 const matchMode=params.matchMode??'exact';
 const scope=params.scope??'bank',priority=params.priority??100;
 if(!['contains','starts','exact'].includes(matchMode)||!['bank','manual','both'].includes(scope)||
    !Number.isInteger(priority)||priority<1||priority>999)throw Error('Regra inválida.');
 return {ruleId:params.ruleId??null,pattern,category:params.category?safeName(params.category):null,
  matchMode,scope,priority,accountId:params.accountId??null,nature:params.nature??'expense',
  futureOnly:params.futureOnly!==false};
}
class CategoryProposalService{
 constructor({db,localFinancial,clock=()=>Date.now(),ttlMs=5*60*1000}={}){
  if(!db?.db||typeof db.listCategories!=='function'||!localFinancial?.query)
   throw Error('FinanceDB e IC-READ obrigatórios.');
  this.db=db;this.local=localFinancial;this.clock=clock;this.ttlMs=ttlMs;this.previews=new Map();
 }
 authorize(input,owner){const scope=scopeOf(input,owner),references=readGuard(this.local,scope);return {scope,references};}
 catalog(input,owner){
  const {scope,references}=this.authorize(input,owner),config=this.db.listCategories(),sql=this.db.db;
  const groups=new Map();
  const categories=config.categories.map(c=>{
   const u=usage(sql,c.name),key=normalizeLabel(c.name);
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c.name);
   return {...c,usage:u,referenceCount:referenceCount(u),probablyUnused:referenceCount(u)===0&&u.bankProviderRaw===0};
  });
  return {contract:'I2-B/CATEGORY-CATALOG-V1',status:'ready',source:scope.source,profile:scope.profile,
   month:scope.month,coverage:references.partial?'partial_local':'unknown',asOf:references.readAt,
   categories,rules:config.rules,possibleDuplicates:[...groups.values()].filter(g=>g.length>1),
   caveat:'Sem uso = sem referência explícita local; classificação implícita e extratos externos podem existir.'};
 }
 preview(action,raw,input,owner){
  const {scope,references}=this.authorize(input,owner),params=normalizeAction(action,raw);
  const id=randomUUID(),now=this.clock(),sql=this.db.db,config=this.db.listCategories();
  const cats=config.categories,rules=config.rules;
  const categoryFor=name=>cats.find(c=>normalizeLabel(c.name)===normalizeLabel(name));
  const capability=this.db.filename===':memory:'?'synthetic_candidate':'proposal_only';
  let before=null,after=null,affected=[],conflicts=[],notes=[],impact={count:0,amountCents:0},
      targetIds=[],status='ready',resolved={...params},requiredDependencies=[];
  const categoryDetails=name=>{const cat=categoryFor(name);if(!cat)throw Error('Categoria não encontrada.');return cat;};
  if(action==='category.create'){
   if(categoryFor(params.name))conflicts.push('Já existe categoria com esse nome.');
   before=null;after=params;
  }else if(action==='category.update'||action==='category.delete'){
   const cat=categoryDetails(params.name),u=usage(sql,cat.name);
   before={...cat,usage:u};targetIds=[cat.name];
   if(action==='category.delete'){
    if(cat.builtIn)conflicts.push('Categoria padrão: exclusão proibida.');
    if(referenceCount(u)||u.bankProviderRaw)conflicts.push('Categoria em uso: remova dependências mediante operações separadas.');
    after=null;
   }else{
    after={...cat,name:params.newName,color:params.color??cat.color,
     emoji:params.emoji??cat.emoji,kind:params.kind??cat.kind};
    if(cat.builtIn&&cat.name!==after.name)conflicts.push('Categoria padrão não pode ser renomeada.');
    if(cat.builtIn&&cat.kind!==after.kind)conflicts.push('Categoria padrão não pode trocar de tipo.');
    if(categoryFor(after.name)&&normalizeLabel(after.name)!==normalizeLabel(cat.name))
     conflicts.push('Nome de destino já existe.');
    if(after.kind!==cat.kind&&referenceCount(u)>0)conflicts.push('Troca de tipo em categoria utilizada requer migração supervisionada.');
    if(cat.name!==after.name){
     impact={count:referenceCount(u),amountCents:0};
     notes.push('Renomear altera também referências existentes em todos os perfis, orçamentos e planejamento. Revisar impacto explícito.');
    }
   }
  }else if(action.startsWith('rule.')){
   const previous=action==='rule.create'?null:rules.find(r=>r.id===params.ruleId);
   if(action!=='rule.create'&&!previous)throw Error('Regra não encontrada.');
   before=previous||null;targetIds=previous?[String(previous.id)]:[];
   if(action==='rule.delete'){after=null;}
   else{
    const next={id:previous?.id??null,
     pattern:params.pattern??previous?.pattern,category:params.category??previous?.category,
     matchMode:params.pattern===null&&previous?previous.matchMode:params.matchMode,
     scope:params.pattern===null&&previous?previous.scope:params.scope,
     priority:params.pattern===null&&previous?previous.priority:params.priority,
     enabled:previous?.enabled??1,
     constraint:previous?.constraint??null};
    if(!next.pattern||!next.category)throw Error('Informe padrão e categoria.');
    const target=categoryDetails(next.category);
    if(next.scope!=='bank'||next.matchMode!=='exact')conflicts.push('B2 permite apenas regra bancária exata supervisionada.');
    if(previous&&!previous.constraint)conflicts.push('Regra existente sem limite futuro: edição exige avaliação histórica.');
    if(action==='rule.create'){
     if(!params.futureOnly||typeof params.accountId!=='string'||!params.accountId||
        !['income','expense'].includes(params.nature))conflicts.push('Regra futura exige conta e natureza explícitas.');
     if(!sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='category_rule_constraints'").get())
      conflicts.push('Mecanismo de limite histórico ainda indisponível nesta base.');
     const account=sql.prepare('SELECT 1 FROM bank_accounts WHERE account_id=?').get(params.accountId);
     if(!account)conflicts.push('Conta bancária não encontrada.');
     if(!matchKind(target.kind,params.nature))conflicts.push('Categoria incompatível com a natureza da regra.');
     const maxRowid=statementCount(sql,'SELECT COALESCE(MAX(rowid),0) AS n FROM bank_transactions');
     next.constraint={accountId:params.accountId,nature:params.nature,afterRowid:maxRowid};
    }
    const collisions=rules.filter(r=>r.id!==previous?.id&&r.enabled&&r.scope!=='manual'&&
     normalizeLabel(next.pattern).includes(normalizeLabel(r.pattern))&&r.priority<=next.priority);
    if(collisions.length){notes.push('Regras anteriores podem ter prioridade sobre esta regra.');requiredDependencies=collisions.map(r=>r.id);}
    after=next;notes.push('Regra futura com limite de importação: não reclassifica histórico.');
    if(action==='rule.create'&&next.constraint)targetIds=[next.constraint.accountId];
   }
  }else if(action==='transaction.categorize'){
   const target=categoryDetails(params.category),bank=scope.source==='bank';
   const rows=bank?this.db.bankOverview().transactions:(this.db.load(scope.profile)?.transactions||[]);
   const keys=new Set(params.items.map(x=>bank?String(x.accountId)+':'+String(x.externalId):String(x.id)));
   const matches=rows.filter(r=>{
    const key=bank?String(r.accountId)+':'+String(r.id):String(r.id);
    return keys.has(key)||(params.selector&&normalizeLabel(r.description||r.merchant).includes(normalizeLabel(params.selector)));
   });
   const matchedKeys=new Set(matches.map(r=>bank?String(r.accountId)+':'+String(r.id):String(r.id)));
   if(keys.size&&[...keys].some(k=>!matchedKeys.has(k)))conflicts.push('Uma ou mais movimentações não pertencem à seleção ou ao histórico visível.');
   if(matches.length>100)conflicts.push('Seleção acima de 100 lançamentos.');
   if(params.selector&&bank&&this.db.bankOverview().truncated)conflicts.push('Histórico bancário parcial: seleção por texto não é exaustiva.');
   for(const r of matches.slice(0,100)){
    const date=r.date,kind=bank?(r.nature&&r.nature!=='auto'?r.nature:r.amount<0?'expense':'income'):r.kind;
    const id=bank?{accountId:r.accountId,externalId:r.id}:{id:r.id};
    const key=bank?r.accountId+':'+r.id:r.id;
    if(date<references.period.start||date>references.period.end){
     conflicts.push('Movimentação fora do período autorizado: '+key);continue;
    }
    if(bank&&(r.status!=='POSTED'||!['income','expense'].includes(kind))){
     conflicts.push('Movimentação pendente, transferência ou ignorada: '+key);continue;
    }
    if(bank&&r.splits?.length){conflicts.push('Movimentação dividida exige edição específica: '+key);continue;}
    if(!matchKind(target.kind,kind)){conflicts.push('Categoria incompatível com natureza: '+key);continue;}
    if(bank&&r.categorySource==='manual'&&!params.replaceManual){
     conflicts.push('Correção manual preexistente: escolha explicitamente a substituição ('+key+').');continue;
    }
    const amountCents=Math.abs(r.amount);
    affected.push({id:key,target:id,date,kind,amountCents,beforeCategory:r.category,
     afterCategory:target.name,status:bank?r.status:'manual',
     hadManualOverride:bank&&r.categorySource==='manual',hadSplits:!!r.splits?.length});
   }
   if(!affected.length)conflicts.push('Nenhuma movimentação elegível.');
   impact={count:affected.length,amountCents:affected.reduce((s,r)=>s+r.amountCents,0)};
   targetIds=affected.map(r=>r.id);before=affected.map(r=>({id:r.id,category:r.beforeCategory}));
   after=affected.map(r=>({id:r.id,category:r.afterCategory}));
   resolved={...params,items:affected.map(r=>r.target),selector:null};
   notes.push('Reclassificação muda alocação por categoria, não o total financeiro. Não marcar automaticamente como revisado.');
  }
  if(conflicts.length)status='blocked';
  const version=sql.prepare('SELECT total_changes() AS n').get().n;
  const state={action,params:resolved,scope,version,affected,impact,before,after,targetIds,conflicts,
   notes,requiredDependencies,coverage:references.partial?'partial_local':'unknown'};
  const digest=hash(state),expiresAt=now+this.ttlMs;
  if(this.previews.size>=100)this.previews.delete(this.previews.keys().next().value);
  const confirmationNonce=randomUUID();
  const record={id,owner,scope,state,digest,expiresAt,confirmationNonce};
  this.previews.set(id,record);
  return {contract:'I2-B/PROPOSAL-V1',proposalId:id,actionType:action,status,capability,
   readOnly:true,requiresExplicitConfirmation:true,confirmationNonce,beforeVersion:version,fingerprint:digest,
   expiresAt,source:scope.source,profile:scope.profile,month:scope.month,coverage:state.coverage,
   before,after,targetIds,affected,impact,conflicts,notes,requiredDependencies,
   mayExecuteSynthetic:status==='ready'&&capability==='synthetic_candidate'};
 }
 revise(proposalId,patch,input,owner){
  const {scope}=this.authorize(input,owner),old=this.previews.get(proposalId);
  if(!old||old.owner!==owner||!sameScope(old.scope,scope)||old.expiresAt<=this.clock())throw Error('Prévia expirada.');
  const next=this.preview(old.state.action,{...old.state.params,...patch},input,owner);
  this.previews.delete(proposalId);return next;
 }
}
module.exports={CategoryProposalService,normalizeAction,usage,referenceCount,readGuard,hash,OPS};