'use strict';
// I3-01/M1-S1: deterministic, read-only financial investigation.
// The MAIN-owned IC2 gateway validates owner/grant before and after this work.
const {createHash}=require('node:crypto');
const {aggregateFinancePeriod}=require('../shared/finance-period-ledger.mjs');
const {period}=require('./financial-intelligence.cjs');
const taxonomy=require('./d05-taxonomy.json');
const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const months=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const safeCents=n=>Number.isSafeInteger(n)&&Math.abs(n)<=100_000_000_000;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);
function buildTaxonomyIndex(){
 const index=new Map();
 for(const parent of taxonomy.parents||[]){
  const entries=[{id:parent.id,parentId:parent.id,subcategoryId:null,name:parent.name}];
  for(const child of parent.subcategories||[])entries.push({id:child.id,parentId:parent.id,subcategoryId:child.id,name:child.name});
  for(const entry of entries){
   const key=fold(entry.name),v=index.get(key)||[];v.push(entry);index.set(key,v);
  }
 }
 return index;
}
const TAXONOMY_INDEX=buildTaxonomyIndex();
function classifyCategory(name){
 const key=fold(name),found=TAXONOMY_INDEX.get(key)||[];
 if(found.length===1)return {categoryId:found[0].parentId,subcategoryId:found[0].subcategoryId,label:found[0].name,ambiguous:false};
 // Legacy descriptions remain labeled; no silent guessing of a parent/subcategory ID.
 return {categoryId:null,subcategoryId:null,label:String(name||'A classificar').slice(0,80),ambiguous:found.length>1};
}
function parseIntent(question,context={},selectedMonth=''){
 const q=fold(question);
 const mentions=months.map((name,i)=>q.match(new RegExp('(?:^|[^a-z])'+name+'(?:$|[^a-z])'))?i+1:0).filter(Boolean);
 // Generic amount/summary questions belong to existing IC2; do not turn
 // "Quanto gastei?" into a two-period investigation with fabricated coverage.
 const userWants=/por que|porque|investig|analis|aument|variac|compar|cresc|contribu|mudou|subi|caiu|diferenca|recorrent|isolado|pontual|gastando mais|onde .*gastando|estabelec|comerciante/.test(q)||
  (mentions.length>=2&&/mostre|mostrar|liste|exiba|gastei/.test(q));
 const financial=/despes|gast|categoria|estabelec|comerciante|supermercad|mercado|alimentac|transporte|seguro|assinatur|cobranca|mes/.test(q)||mentions.length>=2;
 const followup=!!context?.lastInvestigation&&(/^(e |esse |essa |na |no |e quanto |quanto |me mostre|mostre |onde )/.test(q)||/recorrente|isolado|pontual/.test(q));
 if(!((userWants&&financial)||followup))return null;
 const anchor=String(selectedMonth||'');
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(anchor))return null;
 let previous=period(anchor,-1),current=period(anchor);
 if(mentions.length>=2){
  const year=Number(anchor.slice(0,4)),pairs=mentions.slice(0,2).map(m=>{
   const y=m>Number(anchor.slice(5))?year-1:year;
   return period(String(y)+'-'+String(m).padStart(2,'0'));
  }).sort((a,b)=>a.start.localeCompare(b.start));
  previous=pairs[0];current=pairs[1];
 }else if(followup&&context.lastInvestigation){
  previous=context.lastInvestigation.previous;
  current=context.lastInvestigation.current;
 }
 const seekMerchant=/estabelec|comerciante|loja|supermercad|mercado/.test(q);
 const seekRecurring=/recorrent|isolado|pontual|repetid|assinatura/.test(q);
 return {previous,current,seekMerchant,seekRecurring,question:q,followup};
}
function authorized(local,scope){
 const r=local.query({token:scope.token,month:scope.month,intent:'radar'},scope.owner);
 if(r?.version!==1||r.readOnly!==true||r.changesApplied!==false||r.inferenceCalled!==false||
   r.references?.source!==scope.source||r.references?.profile!==scope.profile)
  throw Error('DENIED: escopo ou resposta do IC-READ inválida.');
 return r;
}
function snapshot(local,scope){
 const db=local?.db;
 if(!db)throw Error('UNAVAILABLE: base financeira não disponível.');
 const bank=scope.source==='bank'?db.bankOverview():null;
 const manual=scope.source==='manual'?db.load(scope.profile):null;
 const originals=bank?.transactions??manual?.transactions??[];
 if(!Array.isArray(originals)||originals.length>100000)throw Error('UNAVAILABLE: volume inválido.');
 const rows=[],seen=new Set();let duplicates=0,missingIds=0,unexpectedStatuses=0;
 for(const r of originals){
  const rawId=String(r?.id??'').trim(),account=String(r?.accountId??'').trim();
  if(!rawId||rawId.length>150||(scope.source==='bank'&&(!account||account.length>150))){
   missingIds++;continue;
  }
  const id=scope.source==='bank'?account+':'+rawId:rawId;
  if(seen.has(id)){duplicates++;continue;}
  seen.add(id);
  if(scope.source==='bank'&&!['POSTED','PENDING'].includes(r?.status))unexpectedStatuses++;
  const row=scope.source==='bank'?{
   date:r.date,status:r.status,nature:r.nature,amountCents:r.amount,
   category:r.splitOutdated?null:r.category,
   splits:!r.splitOutdated&&Array.isArray(r.splits)?r.splits.map(x=>({category:x.category,amountCents:x.amount})):undefined
  }:{date:r.date,kind:r.kind,amountCents:r.amount,category:r.category};
  rows.push({id,merchant:String(r.merchant||r.description||'Não identificado').slice(0,120),row});
 }
 const signature=digest({source:scope.source,profile:scope.profile,records:rows,
   totalTransactions:bank?.totalTransactions??originals.length,last:bank?.last??null,
   duplicates,missingIds,unexpectedStatuses,accounts:bank?.accounts?.map(x=>x.id)});
 const totalTransactions=bank?.totalTransactions??originals.length;
 const truncated=!!bank?.truncated||(Number.isSafeInteger(totalTransactions)&&totalTransactions>originals.length);
 return {rows,signature,duplicates,missingIds,unexpectedStatuses,totalTransactions,
   truncated,lastSyncAt:bank?.last?.completedAt||null};
}
function sameMonth(start,end){return start?.slice(0,7)===end?.slice(0,7);}
function isoLocalDate(clock){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(clock()));
 const part=type=>parts.find(p=>p.type===type)?.value;
 return part('year')+'-'+part('month')+'-'+part('day');
}
function alignedPeriods(intention,clock){
 const today=isoLocalDate(clock),a={...intention.previous},b={...intention.current};
 const currentMonth=today.slice(0,7);
 let incomplete=false;
 if(b.start.slice(0,7)===currentMonth&&today<b.end){
  incomplete=true;b.end=today;
  const day=Number(today.slice(-2)),endDay=Number(a.end.slice(-2));
  a.end=a.start.slice(0,8)+String(Math.min(day,endDay)).padStart(2,'0');
 }
 return {a,b,incomplete,today};
}
function compareSpendingBreakdown({local,scope,intention,clock=Date.now}){
 const access=authorized(local,scope);
 const first=snapshot(local,scope);
 const {a,b,incomplete,today}=alignedPeriods(intention,clock);
 if(b.start>today)return {status:'no_data',message:'O período solicitado ainda não aconteceu.'};
 const records=first.rows.map(x=>x.row);
 const before=aggregateFinancePeriod(records,{...a,source:scope.source});
 const after=aggregateFinancePeriod(records,{...b,source:scope.source});
 const rank=new Map();
 for(const r of before.expenses){rank.set(r.name,{name:r.name,previousCents:r.amountCents,currentCents:0});}
 for(const r of after.expenses){let g=rank.get(r.name)||{name:r.name,previousCents:0,currentCents:0};g.currentCents+=r.amountCents;rank.set(r.name,g);}
 const contributions=[...rank.values()].map(x=>{
  const tax=classifyCategory(x.name);
  return {...tax,previousCents:x.previousCents,currentCents:x.currentCents,
    deltaCents:x.currentCents-x.previousCents};
 }).sort((x,y)=>y.deltaCents-x.deltaCents||x.label.localeCompare(y.label,'pt-BR'));
 const delta=after.expenseCents-before.expenseCents;
 if(!safeCents(delta)||contributions.reduce((sum,x)=>sum+x.deltaCents,0)!==delta)
  throw Error('STALE: variação não reconciliada.');
 // Merchants are exact normalized identity only; never fuzzy-merge unrelated names.
 const merchants=new Map();
 for(const item of first.rows){
  const p=item.row.date>=a.start&&item.row.date<=a.end?a:
    item.row.date>=b.start&&item.row.date<=b.end?b:null;
  if(!p)continue;
  const piece=aggregateFinancePeriod([item.row],{...p,source:scope.source});
  if(piece.expenseCents<=0)continue;
  const name=fold(item.merchant),key=name||'nao identificado';
  const m=merchants.get(key)||{merchant:item.merchant,previousCents:0,currentCents:0,
   previousCount:0,currentCount:0,evidenceIds:[]};
  if(p===a){m.previousCents+=piece.expenseCents;m.previousCount++;}
  else{m.currentCents+=piece.expenseCents;m.currentCount++;}
  if(m.evidenceIds.length<25)m.evidenceIds.push(item.id);
  merchants.set(key,m);
 }
 const evidenceByCategory=new Map();
 for(const entry of first.rows){
  for(const range of [a,b]){
   if(entry.row.date<range.start||entry.row.date>range.end)continue;
   for(const group of aggregateFinancePeriod([entry.row],{...range,source:scope.source}).expenses){
    const ids=evidenceByCategory.get(group.name)||new Set();
    if(ids.size<25)ids.add(entry.id);
    evidenceByCategory.set(group.name,ids);
   }
  }
 }
 for(const contribution of contributions){
  const exact=[...rank.values()].find(r=>r.name===contribution.label);
  contribution.evidenceIds=[...(evidenceByCategory.get(exact?.name)||[])];
 }
 const merchantResults=[...merchants.values()].map(m=>({...m,
  deltaCents:m.currentCents-m.previousCents,
  previousAvgCents:m.previousCount?Math.round(m.previousCents/m.previousCount):null,
  currentAvgCents:m.currentCount?Math.round(m.currentCents/m.currentCount):null
 })).sort((x,y)=>y.deltaCents-x.deltaCents||y.currentCents-x.currentCents);
 authorized(local,scope);
 const second=snapshot(local,scope);
 if(first.signature!==second.signature)return {status:'stale',message:'Os dados financeiros mudaram durante a consulta. Refaça a investigação.'};
 const warning=[];
 if(first.truncated)warning.push('Histórico bancário truncado ou incompleto: há mais movimentações cadastradas que registros carregados pela consulta (a visão bancária pode limitar a 2.500). Os totais não representam todo o histórico.');
 if(first.duplicates)warning.push('Identificadores duplicados detectados e excluídos; é necessário conferir a conciliação.');
 if(first.missingIds)warning.push('Movimentações com ID ou conta ausente foram excluídas; a investigação está incompleta.');
 if(first.unexpectedStatuses)warning.push('Foram encontrados estados bancários inesperados; revisão necessária.');
 if(incomplete)warning.push('Mês em andamento: ambos os períodos foram alinhados até o mesmo dia do mês.');
 if(before.transactionsIncluded===0||after.transactionsIncluded===0)
  warning.push('Um dos períodos não possui lançamentos confirmados carregados; a cobertura pode ser insuficiente.');
 if(contributions.some(x=>!x.categoryId||x.ambiguous))
  warning.push('Há categorias legadas sem correspondência D05 inequívoca; os IDs não foram presumidos.');
 if(access.references?.partial)warning.push('O IC-READ indicou cobertura parcial.');
 if(scope.source==='bank'&&first.lastSyncAt&&first.lastSyncAt.slice(0,10)<b.end)
  warning.push('Sincronização bancária anterior ao fim do período analisado; podem faltar movimentos.');
 if(access.facts&&safeCents(access.facts.expenseCents)&&b.start===period(scope.month).start&&
    b.end===period(scope.month).end&&!first.duplicates&&
    after.expenseCents!==access.facts.expenseCents)
  return {status:'stale',message:'O total não reconciliou com o IC-READ autorizado.'};
 const status=warning.length?'partial':'ready';
 if(before.expenseCents===0&&after.expenseCents===0)
  return {status:'no_data',message:'Não há despesas confirmadas nos dois períodos autorizados.'};
 return {status,previousPeriod:a,currentPeriod:b,previousCents:before.expenseCents,
  currentCents:after.expenseCents,deltaCents:delta,
  percentChange:before.expenseCents===0?null:Math.round(delta*100/before.expenseCents),
  contributions,merchants:merchantResults.slice(0,25),merchantTotal:merchantResults.length,
  coverage:{state:status==='ready'?'complete':'partial',loaded:first.rows.length,
   totalTransactions:first.totalTransactions,truncated:first.truncated,
   periodAPartial:incomplete,periodBPartial:incomplete,lastSyncAt:first.lastSyncAt},
  source:scope.source,profile:scope.profile,asOf:new Date(clock()).toISOString(),
  dataVersion:first.signature,exclusions:['PENDING','TRANSFER','IGNORED'],
  warnings:warning,method:'shared/finance-period-ledger.mjs',
  references:contributions.map(x=>({categoryId:x.categoryId,subcategoryId:x.subcategoryId,label:x.label}))
 };
}
function focusResult(info,intent,previousContext){
 const q=intent.question;
 const known=info.contributions.filter(c=>fold(c.label)&&q.includes(fold(c.label)));
 const seen=known.length===1?known[0]:null;
 const names=info.merchants.filter(m=>fold(m.merchant)&&q.includes(fold(m.merchant)));
 const merchant=names.length===1?names[0]:null;
 const generic=/supermercad|mercado/.test(q)&&!merchant?
  info.merchants.filter(m=>/supermercad|mercado/.test(fold(m.merchant))):[];
 if(generic.length===1)return {merchant:generic[0],category:seen};
 if(generic.length>1)return {ambiguous:true};
 if(!merchant&&intent.followup&&names.length>1)return {ambiguous:true};
 if(!merchant&&!seen&&intent.followup&&previousContext?.focusCategoryId){
  return {category:info.contributions.find(c=>c.categoryId===previousContext.focusCategoryId)||null};
 }
 return {category:seen,merchant};
}
function describeInvestigation(info,intent,focus){
 if(focus?.ambiguous)return 'Encontrei vários estabelecimentos parecidos. Informe o nome exato para não juntar despesas de empresas diferentes.';
 const lines=[];
 if(focus?.merchant){
  const m=focus.merchant;lines.push('Em '+m.merchant+', suas despesas passaram de '+money(m.previousCents)+' para '+money(m.currentCents)+
   ' (variação de '+money(m.deltaCents)+'). Frequência '+m.previousCount+' → '+m.currentCount+
   '; ticket médio '+(m.previousAvgCents===null?'indefinido':money(m.previousAvgCents))+
   ' → '+(m.currentAvgCents===null?'indefinido':money(m.currentAvgCents))+'.');
 }else if(focus?.category){
  const c=focus.category;lines.push('Em '+c.label+', o total passou de '+money(c.previousCents)+' para '+money(c.currentCents)+
   ' (variação de '+money(c.deltaCents)+').');
 }else if(intent.seekMerchant){
  const top=info.merchants.filter(m=>m.deltaCents!==0).slice(0,4);
  if(!top.length)lines.push('Não há variação confirmada por estabelecimento nos períodos carregados.');
  else lines.push('Maiores mudanças por estabelecimento: '+top.map(m=>m.merchant+
   ' '+money(m.previousCents)+' → '+money(m.currentCents)+' ('+money(m.deltaCents)+
   ', frequência '+m.previousCount+' → '+m.currentCount+')').join('; ')+'.');
 }else{
  lines.push('Entre '+info.previousPeriod.start.slice(0,7)+' e '+info.currentPeriod.start.slice(0,7)+
   ', as despesas carregadas passaram de '+money(info.previousCents)+' para '+money(info.currentCents)+
   ' (variação de '+money(info.deltaCents)+(info.percentChange===null?', percentual indefinido':', '+info.percentChange+'%')+').');
  const top=info.contributions.filter(x=>x.deltaCents!==0).slice(0,4);
  if(top.length)lines.push('Contribuições: '+top.map(c=>c.label+' '+money(c.deltaCents)).join('; ')+'.');
 }
 if(intent.seekRecurring){
  const examples=info.merchants.filter(m=>m.previousCount>0&&m.currentCount>0).slice(0,3);
  lines.push(examples.length?'Cobranças observadas nos dois períodos: '+examples.map(m=>m.merchant).join(', ')+
   '. Repetição observada não comprova assinatura nem motivo do gasto.':
   'Não há ocorrências suficientes para confirmar recorrência nos registros carregados.');
 }
 lines.push('Fonte '+(info.source==='bank'?'bancária':'manual')+', período '+info.previousPeriod.start+' a '+info.currentPeriod.end+
  ', motor local determinístico; não é saldo disponível.');
 if(info.warnings.length)lines.push('Limitações: '+info.warnings.join(' '));
 lines.push('Os valores mostram contribuições aritméticas, não a causa pessoal das compras.');
 return lines.join('\n\n');
}
module.exports={parseIntent,classifyCategory,compareSpendingBreakdown,focusResult,describeInvestigation};
