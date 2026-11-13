'use strict';
// I2-A financial read tools: never accepts SQL, writes, or a grant issued by a model.
const {createHash}=require('node:crypto');
const {aggregateFinancePeriod}=require('../shared/finance-period-ledger.mjs');
const {period}=require('./financial-intelligence.cjs');
const TOOL_NAMES=Object.freeze(['summary','compare','categories','merchants','transactions','budgets','commitments','simulate','quality']);
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const cents=n=>Number.isSafeInteger(n)&&Math.abs(n)<=100_000_000_000;
const factId=(scope,name,suffix='')=>'i2a:'+createHash('sha256')
 .update([scope.owner,scope.source,scope.profile,scope.month,name,suffix].join('|')).digest('hex').slice(0,20);
function paramsOf(name,raw){
 if(!TOOL_NAMES.includes(name))throw Error('Ferramenta não autorizada: somente leitura.');
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Parâmetros inválidos.');
 const allowed=new Set(['category','excludedCategories','ids','percent']);
 if(Object.keys(raw).some(k=>!allowed.has(k)))throw Error('Parâmetro não autorizado.');
 const category=raw.category===undefined?null:String(raw.category).trim();
 if(category!==null&&(!category||category.length>80))throw Error('Categoria inválida.');
 const excluded=raw.excludedCategories??[];
 if(!Array.isArray(excluded)||excluded.length>20||excluded.some(x=>typeof x!=='string'||!x.trim()||x.length>80))
  throw Error('Exclusões inválidas.');
 const ids=raw.ids??[];
 if(!Array.isArray(ids)||ids.length>25||ids.some(x=>typeof x!=='string'||!x||x.length>160))
  throw Error('IDs inválidos.');
 const percent=raw.percent??null;
 if(percent!==null&&(!Number.isInteger(percent)||percent<0||percent>100))throw Error('Percentual inválido.');
 return {category,excludedCategories:[...new Set(excluded.map(fold))],ids:[...new Set(ids)],percent};
}
function mappedRecords(records,source){
 return records.map(r=>source==='bank'?{
  id:String(r.accountId)+':'+String(r.id),merchant:String(r.merchant||r.description||'Não identificado').slice(0,120),
  row:{date:r.date,status:r.status,nature:r.nature,amountCents:r.amount,category:r.category,
   splits:!r.splitOutdated&&Array.isArray(r.splits)?r.splits.map(p=>({category:p.category,amountCents:p.amount})):undefined}
 }:{
  id:String(r.id),merchant:String(r.description||'Não identificado').slice(0,120),
  row:{date:r.date,kind:r.kind,amountCents:r.amount,category:r.category}
 });
}
function adjust(summary,excluded){
 const excludedCents=summary.expenses.filter(e=>excluded.includes(fold(e.name))).reduce((s,e)=>s+e.amountCents,0);
 const expenses=summary.expenses.filter(e=>!excluded.includes(fold(e.name)));
 const expenseCents=summary.expenseCents-excludedCents;
 if(![expenseCents,excludedCents,summary.incomeCents].every(cents)||
    expenses.reduce((s,e)=>s+e.amountCents,0)!==expenseCents)
  throw Error('Agregação financeira não reconciliada.');
 return {incomeCents:summary.incomeCents,expenseCents,netCents:summary.incomeCents-expenseCents,
  excludedCents,expenses,transactionsIncluded:summary.transactionsIncluded,skipped:summary.excluded};
}
class FinancialReadTools{
 constructor({localFinancial,clock=()=>Date.now()}={}){
  if(!localFinancial||typeof localFinancial.query!=='function')throw Error('IC-READ obrigatório.');
  this.local=localFinancial;this.clock=clock;
 }
 execute(name,raw,scope){
  const p=paramsOf(name,raw);
  if(!scope||!Number.isInteger(scope.owner)||!scope.token)throw Error('Escopo não autorizado.');
  const query=intent=>this.local.query({token:scope.token,month:scope.month,intent,
   ...(intent==='category'?{category:p.category}: {})},scope.owner);
  // EVERY access, including raw drilldown, is preceded by the authoritative IC-READ check.
  const guard=query(name==='commitments'?'commitments':name==='budgets'?'budgets':'radar');
  if(guard?.version!==1||guard?.readOnly!==true||guard?.changesApplied!==false||
    guard?.inferenceCalled!==false||guard?.references?.source!==scope.source||
    guard?.references?.profile!==scope.profile)
   throw Error('Contrato de leitura ou escopo divergente.');
  const ref=guard.references,base={source:ref.source,profile:ref.profile,month:scope.month,
   period:ref.period,asOf:ref.readAt,coverage:ref.partial?'partial_local':'unknown',
   loaded:ref.loaded,engine:ref.engine,excludedCategories:p.excludedCategories};
  const wrap=(status,kind,payload={},warning=null)=>({
   tool:name,status,kind,reference:base,factRef:factId(scope,name,
    JSON.stringify({category:p.category,excluded:p.excludedCategories,ids:p.ids,percent:p.percent,asOf:ref.readAt})),
   facts:payload,warning,readOnly:true});
  if(name==='budgets'){
   const budgets=guard.facts?.budgets;
   return Array.isArray(budgets)?wrap('ready','budget',{budgets:budgets.filter(x=>cents(x.spentCents)&&cents(x.limitCents))}):
    wrap('unavailable','state',{},'Orçamentos indisponíveis nesta fonte.');
  }
  if(name==='commitments'){
   const c=guard.facts?.commitments;
   return c&&cents(c.totalCents)?wrap(c.partial?'partial':'ready','recurring',{commitments:c}):
    wrap('unavailable','state',{},'Planejamento sem cobertura autorizada.');
  }
  // Use exactly the same SQLite read surface and canonical ledger as LocalFinancialIntelligence.
  const db=this.local.db;
  if(!db||typeof db.load!=='function'||typeof db.bankOverview!=='function')
   return wrap('unavailable','state',{},'Leitura detalhada indisponível.');
  const bank=scope.source==='bank'?db.bankOverview():null;
  const manual=scope.source==='manual'?db.load(scope.profile):null;
  const records=bank?.transactions??manual?.transactions??[];
  if(!Array.isArray(records)||records.length>100000)return wrap('unavailable','state',{},'Histórico inválido.');
  const rows=mappedRecords(records,scope.source),source=scope.source;
  const current=aggregateFinancePeriod(rows.map(r=>r.row),{...period(scope.month),source});
  if(!cents(guard.facts?.expenseCents)||!cents(guard.facts?.incomeCents)||
     current.expenseCents!==guard.facts.expenseCents||current.incomeCents!==guard.facts.incomeCents)
   return wrap('stale','state',{},'Fonte alterada durante a consulta; recalcule.');
  const now=adjust(current,p.excludedCategories);
  const coverage=ref.partial?'partial': 'ready';
  const details={...now,category:p.category??null};
  const categoryMatch=e=>!p.category||fold(e.name)===fold(p.category);
  if(name==='summary'||name==='categories'){
   const selected=now.expenses.filter(categoryMatch),selectedCents=selected.reduce((s,e)=>s+e.amountCents,0);
   return wrap(coverage,name==='categories'?'treemap':'summary',
    {...details,categories:selected,selectedCents,
     // A monthly surplus is not a bank balance.
     notAvailableBalance:true},ref.partial?'Cache bancário truncado: totais não representam o histórico integral.':null);
  }
  if(name==='quality')return wrap(coverage,'quality',{loaded:ref.loaded,
   partial:ref.partial,excluded:current.excluded,unclassifiedCents:current.unclassifiedCents,
   categoryCoverageComplete:current.categoryCoverageComplete});
  if(name==='compare'){
   const previous=period(scope.month,-1);
   const prior=aggregateFinancePeriod(rows.map(r=>r.row),{...previous,source});
   const before=adjust(prior,p.excludedCategories);
   const names=new Set([...before.expenses,...now.expenses].map(e=>e.name));
   const rank=[...names].map(category=>{
    const a=now.expenses.find(x=>x.name===category)?.amountCents||0;
    const b=before.expenses.find(x=>x.name===category)?.amountCents||0;
    return {category,nowCents:a,previousCents:b,deltaCents:a-b,percentChange:b===0?null:Math.round(100*(a-b)/b)};
   }).filter(x=>categoryMatch({name:x.category}))
    .sort((a,b)=>b.deltaCents-a.deltaCents||a.category.localeCompare(b.category,'pt-BR'));
   if(rank.reduce((s,r)=>s+r.deltaCents,0)!==now.expenseCents-before.expenseCents&&!p.category)
    throw Error('Ranking não reconciliado.');
   return wrap(coverage,'rank',{current:now,previous:before,previousPeriod:previous,
    deltaExpenseCents:now.expenseCents-before.expenseCents,rank,
    explanation:'Contribuição aritmética, não prova de causalidade.'},ref.partial?'Comparação parcial do histórico carregado.':null);
  }
  if(name==='merchants'||name==='transactions'){
   const detail=[];
   for(const entry of rows){
    if(entry.row.date<current.start||entry.row.date>current.end)continue;
    const item=aggregateFinancePeriod([entry.row],{...period(scope.month),source});
    const a=adjust(item,p.excludedCategories);
    const amountCents=a.expenses.filter(categoryMatch).reduce((s,e)=>s+e.amountCents,0);
    if(amountCents>0)detail.push({id:entry.id,merchant:entry.merchant,
     date:entry.row.date,amountCents,
     categories:a.expenses.filter(categoryMatch),source});
   }
   if(name==='transactions')return wrap(coverage,'table',{items:detail.filter(x=>p.ids.includes(x.id)).slice(0,25),
    missingIds:p.ids.filter(id=>!detail.some(x=>x.id===id))});
   const groups=new Map();
   for(const item of detail){
    const key=fold(item.merchant),g=groups.get(key)||{merchant:item.merchant,amountCents:0,ids:[],count:0};
    g.amountCents+=item.amountCents;g.count++;if(g.ids.length<25)g.ids.push(item.id);groups.set(key,g);
   }
   return wrap(coverage,'drilldown',{merchants:[...groups.values()].sort((a,b)=>b.amountCents-a.amountCents).slice(0,25),
    totalCents:detail.reduce((s,x)=>s+x.amountCents,0)},
    ref.partial?'Drill-down parcial do histórico carregado.':null);
  }
  if(name==='simulate'){
   if(!p.category||p.percent===null)return wrap('needs_clarification','state',{},
    'Informe categoria e percentual inteiro entre 0 e 100.');
   const amount=now.expenses.find(e=>fold(e.name)===fold(p.category))?.amountCents;
   if(amount===undefined)return wrap('unavailable','state',{},'Sem base confirmada para esta categoria.');
   const savingsCents=Math.round(amount*p.percent/100);
   if(!cents(savingsCents))throw Error('Simulação inválida.');
   return wrap(coverage,'whatif',{category:p.category,baselineCents:amount,percent:p.percent,
    hypotheticalSavingsCents:savingsCents,hypotheticalExpenseCents:amount-savingsCents,
    assumption:'Redução hipotética do gasto do mês selecionado; não prevê poupança futura.'});
  }
  throw Error('Ferramenta não reconhecida.');
 }
}
module.exports={FinancialReadTools,TOOL_NAMES,paramsOf,adjust};