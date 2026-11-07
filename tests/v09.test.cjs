'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const A='22222222-2222-4222-8222-222222222222',ITEM='11111111-1111-4111-8111-111111111111';
function setup(balance=2500){
 const fin=new FinanceDB(':memory:');fin.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:A,name:'Conta teste',type:'BANK',balance},transactions:[]}]});
 return {fin,plan:new PlanningStore(fin)};
}
function planned(plan,date='2026-11-10',amount=100000,kind='expense',certainty='confirmed'){
 return plan.create({title:'Aluguel',kind,amount,dueDate:date,category:kind==='expense'?'Moradia':'Salário',certainty}).ids[0];
}
const TODAY='2026-11-06';
test('simulação utiliza o mesmo fluxo diário e não altera compromissos ou extrato',()=>{
 const {fin,plan}=setup();planned(plan);
 const before=plan.projection({today:TODAY,start:TODAY,end:'2026-12-07'}),count=plan.list({today:TODAY}).length;
 const result=plan.simulatePurchase({today:TODAY,amount:60000,installments:2,firstDueDate:'2026-11-09'});
 assert.equal(result.engine,'planning');assert.equal(result.monthly,30000);assert.equal(result.total,60000);
 assert.equal(result.baselineMinimum,150000);assert.equal(result.minimumAfterPurchase,90000);
 assert.equal(result.worstDay,'2026-12-09');assert.equal(result.schedule.length,2);
 assert.deepEqual(plan.projection({today:TODAY,start:TODAY,end:'2026-12-07'}).rows,before.rows);
 assert.equal(plan.list({today:TODAY}).length,count);assert.equal(fin.bankOverview().transactions.length,0);fin.close();
});
test('compra à vista e juros mensais possuem custos e vencimentos coerentes',()=>{
 const {fin,plan}=setup();let r=plan.simulatePurchase({today:TODAY,amount:10001,installments:3,monthlyRate:0});
 assert.equal(r.schedule.reduce((s,x)=>s+x.amount,0),10001);
 assert.deepEqual(r.schedule.map(x=>x.amount),[3334,3334,3333]);
 r=plan.simulatePurchase({today:TODAY,amount:100000,installments:6,monthlyRate:2});
 assert.ok(r.total>100000);assert.equal(r.interest,r.total-100000);
 let todayBuy=plan.simulatePurchase({today:TODAY,amount:50000,installments:1});
 assert.equal(todayBuy.schedule[0].date,TODAY);assert.equal(todayBuy.minimumAfterPurchase,200000);
 fin.close();
});
test('compromissos previstos e reserva alteram alerta, sem classificação de compra como garantida',()=>{
 const {fin,plan}=setup(2500);
 fin.save('real',{transactions:[],budgets:{},settings:{opening:0,income:0,fixed:0,existing:0,reserve:200000}});
 planned(plan,'2026-11-08',75000);
 const r=plan.simulatePurchase({today:TODAY,amount:100000,installments:1});
 assert.equal(r.minimumAfterPurchase,75000);
 assert.equal(r.risk,'caution');
 assert.equal(r.reserve,200000);
 assert.equal(r.reference.quality,'unverified');
 fin.close();
});
test('receitas incertas não financiam compras no cenário conservador',()=>{
 const {fin,plan}=setup(500);planned(plan,'2026-11-08',50000,'income','estimated');
 const input={today:TODAY,amount:40000,installments:1};
 const base=plan.simulatePurchase(input);const optimistic=plan.simulatePurchase({...input,includeEstimatedIncome:true});
 assert.equal(optimistic.minimumAfterPurchase,base.minimumAfterPurchase); // minimum before the uncertain revenue
 assert.ok(optimistic.rows.at(-1).withPurchase>base.rows.at(-1).withPurchase);
 fin.close();
});
test('dados de banco antigos ou incompletos sinalizam risco sem declarar compra segura',()=>{
 const {fin,plan}=setup();
 fin.db.prepare("UPDATE bank_accounts SET updated_at='2025-01-01T00:00:00.000Z'").run();
 const r=plan.simulatePurchase({today:TODAY,amount:10000,installments:1});
 assert.equal(r.reference.quality,'stale');assert.equal(r.risk,'unknown');
 fin.db.prepare('UPDATE bank_accounts SET balance_cents=NULL').run();
 const incomplete=plan.projection({today:TODAY,start:TODAY,end:TODAY});
 assert.equal(incomplete.source,'manual');
 fin.close();
});
test('validação bloqueia simulações absurdas e períodos inválidos',()=>{
 const {fin,plan}=setup();
 assert.throws(()=>plan.simulatePurchase({today:TODAY,amount:0}),/centavos/);
 assert.throws(()=>plan.simulatePurchase({today:TODAY,amount:10000,installments:61}),/60 parcelas/);
 assert.throws(()=>plan.simulatePurchase({today:TODAY,amount:10000,monthlyRate:-1}),/Juros/);
 assert.throws(()=>plan.simulatePurchase({today:TODAY,amount:10000,firstDueDate:'2026-11-01'}),/vencimento/);
 assert.equal(plan.simulatePurchase({today:TODAY,amount:300000,installments:60}).schedule.length,60);
 fin.close();
});
test('agregação diária usa histórico acima de 2500 transações e respeita naturezas e divisão',()=>{
 const {fin}=setup();
 const tx=[];
 for(let i=0;i<2600;i++)tx.push({id:'old-'+i,date:'2025-06-10',amount:-1,description:'Compra',status:'POSTED',category:'Alimentação'});
 tx.push({id:'salary',date:'2026-11-05',amount:100,description:'Salário',status:'POSTED',category:'Salário'});
 tx.push({id:'transfer',date:'2026-11-05',amount:-50,description:'Minha conta',status:'POSTED',category:'Outros'});
 tx.push({id:'split',date:'2026-11-05',amount:-20,description:'Mercado',status:'POSTED',category:'Alimentação'});
 fin.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:A,name:'Conta teste',balance:2500},transactions:tx}]});
 fin.editBankTransaction({accountId:A,externalId:'transfer',nature:'transfer',merchant:'',note:'',reviewed:true});
 fin.setBankSplits({accountId:A,externalId:'split',parts:[{category:'Alimentação',amount:1000},{category:'Contas',amount:1000}]});
 const view=fin.bankOverview();
 assert.ok(view.truncated);assert.equal(view.transactions.length,2500);
 const old=view.dailyTotals.find(x=>x.date==='2025-06-10');assert.equal(old.expense,260000);
 const curr=view.dailyTotals.find(x=>x.date==='2026-11-05');assert.equal(curr.income,10000);assert.equal(curr.expense,2000);
 assert.equal(curr.categories.find(x=>x.name==='Contas').total,1000);
 fin.close();
});
test('reconexão bancária produz aviso não destrutivo de possível duplicidade e permite ignorar',()=>{
 const {fin}=setup();const B='33333333-3333-4333-8333-333333333333';
 const item2='44444444-4444-4444-8444-444444444444';
 const row={id:'pagamento-x',date:'2026-11-03',amount:-30,description:'Compra comercio XYZ',status:'POSTED',category:'Alimentação'};
 fin.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:A,name:'Conta teste',balance:2500},transactions:[row]}]});
 fin.ingestBank(item2,{item:{status:'UPDATED'},data:[{account:{id:B,name:'Conta teste',balance:2500},transactions:[{...row,id:'pagamento-y'}]}]});
 assert.equal(fin.bankOverview().suspectedDuplicates.length,1);
 const key=fin.bankOverview().suspectedDuplicates[0].pairKey;
 assert.equal(fin.bankOverview().transactions.length,2);
 fin.dismissDuplicate(key);assert.equal(fin.bankOverview().suspectedDuplicates.length,0);
 assert.equal(fin.bankOverview().transactions.length,2);
 fin.close();
});
