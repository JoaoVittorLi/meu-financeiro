'use strict';
// Local read-only application service. No SQL writes, inference, network or stored grants.
const {randomUUID}=require('node:crypto');
const {aggregateFinancePeriod,budgetProgress}=require('../shared/finance-period-ledger.mjs');
const {isoToday}=require('./planning.cjs');
const CONSENT='LOCAL_FINANCIAL_READ_V1';
const INTENTS=['radar','category','largest','budgets','commitments','compare','review','purchase'];
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
function period(month,offset=0){
 if(typeof month!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('Selecione um mês válido.');
 const [y,m]=month.split('-').map(Number),start=new Date(Date.UTC(y,m-1+offset,1)),end=new Date(Date.UTC(y,m+offset,0));
 return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
class LocalFinancialIntelligence{
 constructor(db,planner,{clock=()=>Date.now()}={}){this.db=db;this.planner=planner;this.clock=clock;this.grants=new Map();}
 authorize(input,owner){
 if(input?.consent!==CONSENT||!['bank','manual'].includes(input.source)||!['real','demo'].includes(input.profile)||!Number.isInteger(owner))throw Error('Autorize explicitamente a fonte e o perfil para leitura local.');
 if(input.profile==='demo'&&(input.source==='bank'||input.planning===true))throw Error('Perfil demonstração permite somente lançamentos manuais do próprio perfil.');
 for(const [token,g] of this.grants)if(g.owner===owner||g.expiresAt<=this.clock())this.grants.delete(token);
 const token=randomUUID(),grant={owner,source:input.source,profile:input.profile,planning:input.planning===true,expiresAt:this.clock()+15*60*1000};
 this.grants.set(token,grant);return {token,source:grant.source,profile:grant.profile,planning:grant.planning,expiresAt:grant.expiresAt};
 }
 revoke(token,owner){if(this.grants.get(token)?.owner===owner)this.grants.delete(token);return {revoked:true};}
 query(input,owner){
 const g=this.grants.get(input?.token);
 if(!g||g.owner!==owner||g.expiresAt<=this.clock()){if(g?.expiresAt<=this.clock())this.grants.delete(input.token);throw Error('Autorização local ausente ou expirada. Autorize novamente.');}
 if(!INTENTS.includes(input.intent))throw Error('Consulta não suportada. Esta sessão é somente de leitura.');
 const p=period(input.month),previous=period(input.month,-1),next=period(input.month,1);
 if(input.intent==='commitments'&&!g.planning)throw Error('Autorize também a leitura do Planejamento.');
 const manual=this.db.load(g.profile)||{transactions:[],budgets:{}};
 const bank=g.source==='bank'?this.db.bankOverview():null;
 const records=bank?bank.transactions:manual.transactions;
 const rows=records.map(r=>bank?{date:r.date,status:r.status,nature:r.nature,amountCents:r.amount,category:r.category,splits:!r.splitOutdated&&Array.isArray(r.splits)?r.splits.map(p=>({category:p.category,amountCents:p.amount})):undefined}:{date:r.date,kind:r.kind,amountCents:r.amount,category:r.category});
 const current=aggregateFinancePeriod(rows,{...p,source:g.source});
 const limits=Object.entries(manual.budgets||{}).map(([category,amountCents])=>({category,amountCents}));
 const budgets=budgetProgress(limits,current.expenses);
 const warnings=['Uma única origem; valores apenas dos registros locais carregados.','Receitas menos despesas não representam saldo disponível.'];
 if(bank?.truncated)warnings.push('Histórico bancário parcial: a lista local tem limite de 2.500 registros; não representa todo o extrato.');
 const references={engine:'shared/finance-period-ledger.mjs',source:g.source,profile:g.profile,period:p,loaded:records.length,partial:!!bank?.truncated,readAt:new Date(this.clock()).toISOString(),planningRead:false};
 // INT-DESIGN-01 / VR07–08: additive read-only visual evidence for exactly
 // the selected authorized source and month. No SQL writes or new IPC.
 // Per-row deterministic ledger prevents PENDING, transfer, ignore, invalid
 // split, and duplicate amounts from leaking into category drilldowns.
 const categoryDetails=new Map();
 if(input.intent==='radar'){
  for(let i=0;i<rows.length;i++){
   const item=aggregateFinancePeriod([rows[i]],{...p,source:g.source});
   if(!item.expenses.length)continue;
   const rec=records[i];
   for(const cat of item.expenses){
    let value=categoryDetails.get(cat.name);
    if(!value){value={count:0,items:[]};categoryDetails.set(cat.name,value);}
    value.count++;
    if(value.items.length<20)value.items.push({
      id:String(rec.id||rec.externalId||i).slice(0,100),
      date:String(rec.date||'').slice(0,10),
      description:String(rec.merchant||rec.description||'Movimentação').slice(0,120),
      amountCents:cat.amountCents
    });
   }
  }
 }
 let facts={kind:input.intent,transactionsIncluded:current.transactionsIncluded,excluded:current.excluded,incomeCents:current.incomeCents,expenseCents:current.expenseCents,netCents:current.netCents};
 if(input.intent==='radar')facts={...facts,
   expenseCategories:current.expenses.map(x=>{
     const detail=categoryDetails.get(x.name)||{count:0,items:[]};
     return {name:x.name,amountCents:x.amountCents,movementCount:detail.count,
       movements:detail.items,detailsPartial:detail.items.length<detail.count};
   }),
   visualSource:'finance-period-ledger-v1'
 };
 let title='Resumo financeiro local',text='Valores calculados dos registros autorizados.',table=[],headers=['Informação','Valor'],metrics=[];
 const counts=(value,label)=>({label,value:String(value),tone:'neutral'});
 if(input.intent==='category'){
 const name=String(input.category||'').trim();if(!name||name.length>50)throw Error('Informe uma categoria válida.');
 const amount=current.expenses.filter(c=>fold(c.name)===fold(name)).reduce((s,c)=>s+c.amountCents,0);
 facts={...facts,category:name,amountCents:amount};title='Gastos em '+name;text=money(amount)+' em '+name+' no período selecionado.';table=[{col1:name,col2:money(amount)}];
 }else if(input.intent==='budgets'||input.intent==='radar'){
 facts={...facts,budgets:budgets.map(b=>({category:b.category,spentCents:b.spentCents,limitCents:b.limitCents,pct:b.pct})),alertCount:budgets.filter(b=>b.spentCents>b.limitCents||(b.limitCents>0&&b.pct>=80)).length};
 title=input.intent==='radar'?'O que merece atenção neste mês':'Orçamentos excedidos';
 table=budgets.filter(b=>input.intent==='budgets'?b.spentCents>b.limitCents:b.spentCents>b.limitCents||(b.limitCents>0&&b.pct>=80)).sort((a,b)=>b.spentCents-b.limitCents-(a.spentCents-a.limitCents)).map(b=>({col1:b.category,col2:money(b.spentCents)+' / '+money(b.limitCents),col3:b.limitCents===0?'Limite zero':b.spentCents>b.limitCents?'Excedido':b.pct+'% · atenção'}));headers=['Categoria','Gasto / limite','Situação'];
 text=table.length?'Consumo confirmado; atenção a partir de 80% do limite.':'Nenhum limite excedido ou próximo do limite nos registros consultados. Isso não prevê despesas futuras.';
 metrics=[counts(current.transactionsIncluded,'Movimentos considerados'),counts(current.excluded,'Pendentes/desconsiderados')];
 }else if(input.intent==='compare'){
 const old=aggregateFinancePeriod(rows,{...previous,source:g.source});facts={...facts,previousPeriod:previous,previousExpenseCents:old.expenseCents,deltaExpenseCents:current.expenseCents-old.expenseCents};
 title='Despesas: mês atual × anterior';headers=['Categoria','Atual / anterior','Variação'];
 const names=new Set([...current.expenses,...old.expenses].map(c=>c.name));
 table=[...names].map(name=>{const now=current.expenses.find(c=>c.name===name)?.amountCents||0,before=old.expenses.find(c=>c.name===name)?.amountCents||0;return {name,now,before,delta:now-before};}).sort((a,b)=>b.delta-a.delta).slice(0,12).map(c=>({col1:c.name,col2:money(c.now)+' / '+money(c.before),col3:money(c.delta)}));
 text='Variação absoluta entre '+p.start+' e '+previous.start+'. Sem extrapolação nem percentual sobre base zero.';
 }else if(input.intent==='largest'){
 title='Maiores despesas do período';headers=['Descrição','Data','Valor'];
 table=records.map((r,i)=>({r,expense:aggregateFinancePeriod([rows[i]],{...p,source:g.source}).expenseCents})).filter(x=>x.expense>0).sort((a,b)=>b.expense-a.expense).slice(0,10).map(({r,expense})=>({col1:String(r.merchant||r.description||'Movimentação').slice(0,120),col2:r.date,col3:money(expense)}));
 text='Valores totais das movimentações; divisões não multiplicam lançamentos.';
 }else if(input.intent==='review'){
 title='Movimentações a revisar';headers=['Descrição','Data','Estado'];
 if(!bank){text='Revisão bancária não se aplica à fonte manual.';}else{const review=records.filter(r=>r.date>=p.start&&r.date<=p.end&&!r.reviewed);facts={...facts,review:{count:review.length,postedCount:review.filter(r=>r.status==='POSTED').length,pendingBankCount:review.filter(r=>r.status!=='POSTED').length}};table=review.slice(0,20).map(r=>({col1:String(r.merchant||r.description).slice(0,120),col2:r.date,col3:r.status==='POSTED'?'Confirmada · a revisar':'Pendente · a revisar'}));text=review.length+' movimentação(ões) carregada(s) ainda não revisada(s).';}
 }else if(input.intent==='commitments'){
 references.planningRead=true;references.planningPeriod=next;title='Compromissos do próximo mês';headers=['Compromisso','Vencimento','Restante'];
 const today=isoToday(),items=this.planner.list({today,start:next.start,end:next.end});
 const confirmed=items.filter(p=>p.kind==='expense'&&p.status==='planned'&&p.certainty==='confirmed'&&p.remaining>0);
 const total=confirmed.reduce((s,p)=>s+p.remaining,0);table=confirmed.slice(0,20).map(p=>({col1:p.title,col2:p.dueDate,col3:money(p.remaining)}));
 facts={...facts,commitments:{count:confirmed.length,totalCents:total,period:next,partial:items.length===5000}};
 text='Total confirmado a pagar: '+money(total)+'. Valores restantes calculados pelo Planejamento; pagos/cancelados e estimativas fora desse total.';
 if(items.length===5000)warnings.push('Planejamento pode estar parcial: limite de registros atingido.');
 }else{
 title='O que falta para avaliar uma compra?';text='Não é possível concluir quanto está livre apenas pelo resultado mensal.';
 table=[{col1:'Conferir no Simulador',col2:'Saldo inicial e data, reserva, compromissos, preço, juros e parcelas'},{col1:'Cobertura dos dados',col2:bank?.truncated?'Extrato local parcial':'Histórico completo não certificado'},{col1:'Receitas futuras',col2:'Não tratar estimativas como dinheiro recebido'}];
 }
 if(!table.length)table=[{col1:'Sem registros aplicáveis',col2:'Nenhum resultado para este filtro.'}];
 return {version:1,readOnly:true,inferenceCalled:false,changesApplied:false,text,references,facts,card:{title,subtitle:input.month+' · '+(g.source==='bank'?'Banco':'Manual')+' · '+(g.profile==='demo'?'Perfil demonstração':'Perfil pessoal'),metrics,headers,rows:table,footnote:warnings.join(' ')}};
 }
}
module.exports={LocalFinancialIntelligence,CONSENT,INTENTS,period};
