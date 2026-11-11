'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs');
const ITEM='11111111-1111-4111-8111-111111111111';
const ACCOUNT='22222222-2222-4222-8222-222222222222';
const ACCOUNT2='55555555-5555-4555-8555-555555555555';
const PURCHASE='33333333-3333-4333-8333-333333333333';
const PAYMENT='44444444-4444-4444-8444-444444444444';
function data(amount=-180.00){return {item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'Itaú',balance:400.25},transactions:[{id:PURCHASE,date:'2026-11-06',amount,description:'IFOOD Restaurante',status:'POSTED',category:'Outros'},{id:PAYMENT,date:'2026-11-06',amount:180.00,description:'Pix próprio',status:'POSTED',category:'Outros'}]}]};}
function base(){const db=new FinanceDB(':memory:');db.ingestBank(ITEM,data());return db;}
function manual(){return {transactions:[{id:'local_1',date:'2026-11-06',description:'IFOOD',kind:'expense',amount:18000,category:'Alimentação',origin:'manual'}],budgets:{},settings:{opening:0,income:0,fixed:0,existing:0,reserve:0}};}
test('caixa de revisão guarda notas e natureza, sem alterar importação nem perder em sync',()=>{
  const db=base();const key={accountId:ACCOUNT,externalId:PURCHASE};
  db.editBankTransaction({...key,merchant:'iFood',note:'Refeição com amigos',nature:'expense',reviewed:true});
  let tx=db.bankOverview().transactions.find(x=>x.id===PURCHASE);
  assert.equal(tx.merchant,'iFood');assert.equal(tx.reviewed,true);
  assert.equal(tx.amount,-18000);assert.equal(tx.description,'IFOOD Restaurante');
  db.ingestBank(ITEM,data());
  tx=db.bankOverview().transactions.find(x=>x.id===PURCHASE);
  assert.equal(tx.note,'Refeição com amigos');assert.equal(tx.nature,'expense');
  db.editBankTransaction({...key,merchant:'iFood 2',note:'Mais detalhes',nature:'expense'});
  assert.equal(db.bankOverview().transactions.find(x=>x.id===PURCHASE).reviewed,true);
  db.close();
});
test('divisão exige igualdade exata e preserva valor original',()=>{
  const db=base();const key={accountId:ACCOUNT,externalId:PURCHASE};
  assert.throws(()=>db.setBankSplits({...key,parts:[{category:'Alimentação',amount:14000},{category:'Contas',amount:3999}]}),/soma/);
  assert.deepEqual(db.bankOverview().transactions.find(x=>x.id===PURCHASE).splits,[]);
  db.setBankSplits({...key,parts:[{category:'Alimentação',amount:14000},{category:'Contas',amount:4000}]});
  let tx=db.bankOverview().transactions.find(x=>x.id===PURCHASE);
  assert.equal(tx.splits.reduce((a,x)=>a+x.amount,0),18000);
  assert.equal(tx.amount,-18000);
  db.ingestBank(ITEM,data(-190));
  tx=db.bankOverview().transactions.find(x=>x.id===PURCHASE);
  assert.equal(tx.splitOutdated,true);
  assert.deepEqual(tx.splits,[]);
  db.setBankSplits({...key,parts:[]});
  assert.deepEqual(db.bankOverview().transactions.find(x=>x.id===PURCHASE).splits,[]);
  db.close();
});
test('vínculo manual é explícito, exclusivo, preservado e só removido após desvinculação',()=>{
  const db=base();db.save('real',manual());
  const key={accountId:ACCOUNT,externalId:PURCHASE};
  db.linkManualTransaction({...key,manualId:'local_1'});
  assert.equal(db.bankOverview().transactions.find(x=>x.id===PURCHASE).linkedManualId,'local_1');
  db.save('real',manual());
  assert.equal(db.bankOverview().transactions.find(x=>x.id===PURCHASE).linkedManualId,'local_1');
  assert.throws(()=>db.linkManualTransaction({accountId:ACCOUNT,externalId:PAYMENT,manualId:'local_1'}),/Valores ou tipos diferentes/);
  assert.throws(()=>db.save('real',{...manual(),transactions:[]}),/Desvincule antes/);
  assert.equal(db.bankOverview().transactions.find(x=>x.id===PURCHASE).linkedManualId,'local_1');
  db.linkManualTransaction({...key,manualId:null});
  db.save('real',{...manual(),transactions:[]});
  assert.equal(db.bankOverview().transactions.find(x=>x.id===PURCHASE).linkedManualId,null);
  db.close();
});
test('estabelecimentos padronizados e revisão em lote não modificam o extrato bruto',()=>{
  const db=base();
  db.saveMerchantAlias({pattern:'IFOOD',displayName:'iFood'});
  assert.equal(db.bankOverview().transactions.find(x=>x.id===PURCHASE).merchant,'iFood');
  const keys=[PURCHASE,PAYMENT].map(externalId=>({accountId:ACCOUNT,externalId}));
  db.batchBankChanges({items:keys,reviewed:true,category:'Alimentação'});
  const tx=db.bankOverview().transactions;
  assert(tx.every(x=>x.reviewed));
  assert(tx.every(x=>x.category==='Alimentação'));
  assert.equal(tx.find(x=>x.id===PAYMENT).amount,18000);
  assert.throws(()=>db.batchBankChanges({items:[{accountId:ACCOUNT,externalId:'unknown'}],reviewed:true}),/encontrada/);
  assert(db.bankOverview().transactions.every(x=>x.reviewed));
  db.close();
});
test('migração aditiva mantém categorias e lançamentos existentes',()=>{
  const db=base();db.save('real',manual());
  const totals=db.bankOverview().transactions.length;
  db.editBankTransaction({accountId:ACCOUNT,externalId:PURCHASE,merchant:'',note:'',nature:'transfer',reviewed:true});
  assert.equal(db.load('real').transactions.length,1);
  assert.equal(db.bankOverview().transactions.length,totals);
  assert.deepEqual(db.integrity(),['ok']);
  db.close();
});
test('mudanças no banco reabrem a revisão e evitam conciliação desatualizada',()=>{
  const db=base();db.save('real',manual());
  const key={accountId:ACCOUNT,externalId:PURCHASE};
  db.linkManualTransaction({...key,manualId:'local_1'});
  db.editBankTransaction({...key,nature:'auto',merchant:'iFood',note:'teste',reviewed:true});
  assert.equal(db.bankOverview().transactions.find(x=>x.id===PURCHASE).reviewed,true);
  db.ingestBank(ITEM,data(-181));
  const after=db.bankOverview().transactions.find(x=>x.id===PURCHASE);
  assert.equal(after.reviewed,false);
  assert.equal(after.linkedManualId,null);
  assert.equal(after.merchant,'iFood');
  db.close();
});
test('editar a data de um lançamento vinculado exige desvinculação explícita',()=>{
  const db=base();db.save('real',manual());
  const key={accountId:ACCOUNT,externalId:PURCHASE};
  db.linkManualTransaction({...key,manualId:'local_1'});
  const changed=manual();changed.transactions[0].date='2026-10-20';
  assert.throws(()=>db.save('real',changed),/Desvincule antes/);
  assert.equal(db.load('real').transactions[0].date,'2026-11-06','Rollback preserves the original manual date');
  assert.equal(db.bankOverview().transactions.find(x=>x.id===PURCHASE).linkedManualId,'local_1');
  db.linkManualTransaction({...key,manualId:null});
  db.save('real',changed);
  assert.equal(db.bankOverview().transactions.find(x=>x.id===PURCHASE).linkedManualId,null);
  assert.equal(db.load('real').transactions[0].date,'2026-10-20');db.close();
});
