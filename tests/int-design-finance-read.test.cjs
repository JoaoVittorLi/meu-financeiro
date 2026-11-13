'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
const period='2026-11';
const tx=(id,kind,amount,category)=>({id,date:'2026-11-12',description:'Compra '+id,kind,amount,category});
function service({manual=[],bank=[],truncated=false}={}){
 const db={
  load:()=>({transactions:manual,budgets:{}}),
  bankOverview:()=>({transactions:bank,truncated})
 };
 return new LocalFinancialIntelligence(db,{list:()=>[]},{clock:()=>Date.parse('2026-11-13T10:00:00Z')});
}
function query(s,source='manual',profile='demo'){
 const grant=s.authorize({consent:CONSENT,source,profile,planning:false},17);
 return s.query({token:grant.token,month:period,intent:'radar'},17);
}
test('INT-DESIGN data — six categories, cent reconciliation and count',()=>{
 const manual=[tx('inc','income',300000,'Salário'),
  tx('mor','expense',100000,'Moradia'),tx('ali','expense',76000,'Alimentação'),
  tx('laz','expense',38000,'Lazer'),tx('tra','expense',24000,'Transporte'),
  tx('sau','expense',22800,'Saúde'),tx('ser','expense',11900,'Serviços')];
 const r=query(service({manual}));
 assert.equal(r.changesApplied,false);assert.equal(r.readOnly,true);
 assert.equal(r.facts.expenseCents,272700);
 assert.equal(r.facts.incomeCents,300000);
 assert.equal(r.facts.netCents,27300);
 assert.equal(r.facts.expenseCategories.length,6);
 assert.equal(r.facts.visualSource,'finance-period-ledger-v1');
 assert.equal(r.facts.expenseCategories.reduce((n,c)=>n+c.amountCents,0),272700);
 assert.equal(r.facts.expenseCategories.every(c=>c.movementCount===1&&c.movements.length===1),true);
});
test('INT-DESIGN data — excludes PENDING, transfer, ignore, includes correct posted splits',()=>{
 const bank=[
  {id:'a',accountId:'account-1',date:'2026-11-12',status:'POSTED',nature:'expense',amount:-10000,
    category:'Outro',splits:[{category:'Alimentação',amount:6000},{category:'Lazer',amount:4000}]},
  {id:'b',accountId:'account-1',date:'2026-11-12',status:'PENDING',amount:-60000,category:'Alimentação'},
  {id:'c',accountId:'account-1',date:'2026-11-12',status:'POSTED',nature:'transfer',amount:-25000,category:'Transferência'},
  {id:'d',accountId:'account-1',date:'2026-11-12',status:'POSTED',nature:'ignore',amount:-1000,category:'Ignorado'},
  {id:'e',accountId:'account-1',date:'2026-11-12',status:'POSTED',amount:30000,category:'Salário'}
 ];
 const r=query(service({bank}),'bank','real');
 assert.equal(r.facts.expenseCents,10000);
 assert.equal(r.facts.incomeCents,30000);
 assert.equal(r.facts.netCents,20000);
 assert.equal(r.facts.expenseCategories.length,2);
 assert.deepEqual(r.facts.expenseCategories.map(x=>x.amountCents),[6000,4000]);
 assert.equal(r.facts.expenseCategories.every(x=>x.movementCount===1),true);
 assert.equal(r.facts.expenseCategories.some(x=>x.name==='Transferência'),false);
 assert.equal(r.facts.visualSource,'finance-period-ledger-v1');
});
test('INT-DESIGN data — duplicate IDs block visual provenance, without rewriting ledger',()=>{
 const one=tx('repeated','expense',7000,'Alimentação');
 const r=query(service({manual:[one,{...one}]}));
 assert.equal(r.facts.expenseCents,14000);
 assert.equal(r.facts.visualSource,null);
 assert.match(r.facts.visualLimitation,/duplicados/);
});
test('INT-DESIGN data — missing ID blocks visual provenance',()=>{
 const item=tx('ok','expense',2000,'Moradia');delete item.id;
 const r=query(service({manual:[item]}));
 assert.equal(r.facts.visualSource,null);
});
test('INT-DESIGN data — incomplete bank history is marked partial',()=>{
 const bank=[{id:'p',accountId:'account-1',date:'2026-11-12',status:'POSTED',amount:-1000,category:'Serviços'}];
 const r=query(service({bank,truncated:true}),'bank','real');
 assert.equal(r.references.partial,true);
 assert.equal(r.facts.expenseCategories[0].amountCents,1000);
});
test('INT-DESIGN data — invalid split falls back to parent category, never multiplies',()=>{
 const bank=[{id:'s1',accountId:'account-1',date:'2026-11-12',status:'POSTED',
  amount:-10000,category:'Original',splits:[{category:'Comida',amount:6000},{category:'Lazer',amount:7000}]}];
 const r=query(service({bank}),'bank','real');
 assert.equal(r.facts.expenseCents,10000);
 assert.equal(r.facts.expenseCategories.length,1);
 assert.equal(r.facts.expenseCategories[0].name,'Original');
});
test('INT-DESIGN data — consent is required, expired and wrong-owner grants refused',()=>{
 const s=service({manual:[tx('a','expense',1000,'Alimentação')]});
 assert.throws(()=>s.query({token:'missing',month:period,intent:'radar'},17));
 const g=s.authorize({consent:CONSENT,source:'manual',profile:'demo',planning:false},17);
 assert.throws(()=>s.query({token:g.token,month:period,intent:'radar'},18));
 s.revoke(g.token,17);
 assert.throws(()=>s.query({token:g.token,month:period,intent:'radar'},17));
});
