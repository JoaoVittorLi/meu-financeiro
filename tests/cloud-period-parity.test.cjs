'use strict';
// Golden agreement between existing Windows finance ledger and shared PWA core
// on synthetic bank rows. No connection to Pluggy or the user's SQLite.
const test=require('node:test');
const assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs');
test('Windows bankOverview daily totals equal the shared PWA source-separated ledger',async()=>{
 const {aggregateFinancePeriod,cashflowBuckets}=await import('../shared/finance-period-ledger.mjs');
 const fin=new FinanceDB(':memory:');
 try{
  const db=fin.db;
  db.prepare("INSERT INTO bank_items(item_id,institution,status,last_sync_at) VALUES('fake-item','Fictício','UPDATED','2026-11-07')").run();
  db.prepare("INSERT INTO bank_accounts(account_id,item_id,name,currency,balance_cents,updated_at) VALUES('fake-account','fake-item','Teste','BRL',250000,'2026-11-07')").run();
  const add=db.prepare('INSERT INTO bank_transactions(account_id,external_id,date,description,amount_cents,status,category,updated_at) VALUES(?,?,?,?,?,?,?,?)');
  add.run('fake-account','tx-food','2026-11-05','Supermercado fictício',-10000,'POSTED','Groceries','2026-11-07');
  add.run('fake-account','tx-salary','2026-11-06','Salário fictício',50000,'POSTED','Salary','2026-11-07');
  add.run('fake-account','tx-transfer','2026-11-06','Transferência própria',-8000,'POSTED','Transfers','2026-11-07');
  add.run('fake-account','tx-split','2026-11-07','Compra dividida',-3000,'POSTED','Shopping','2026-11-07');
  add.run('fake-account','tx-pending','2026-11-07','Compra pendente',-5000,'PENDING','Shopping','2026-11-07');
  db.prepare("INSERT INTO bank_transaction_notes(account_id,external_id,nature) VALUES('fake-account','tx-transfer','transfer')").run();
  const split=db.prepare('INSERT INTO bank_transaction_splits(account_id,external_id,position,category,amount_cents) VALUES(?,?,?,?,?)');
  split.run('fake-account','tx-split',0,'Alimentação',1000);
  split.run('fake-account','tx-split',1,'Transporte',2000);
  const existing=fin.bankOverview();
  const rows=existing.transactions.map(t=>({
    date:t.date,amountCents:t.amount,status:t.status,
    nature:t.nature,category:t.category,
    splits:t.splits?.map(p=>({category:p.category,amountCents:p.amount}))||[]
  }));
  const shared=aggregateFinancePeriod(rows,{
    start:'2026-11-01',end:'2026-11-07',source:'bank'
  });
  const totals=existing.dailyTotals.reduce((sum,d)=>({
    income:sum.income+d.income,expense:sum.expense+d.expense
  }),{income:0,expense:0});
  assert.equal(shared.incomeCents,totals.income);
  assert.equal(shared.expenseCents,totals.expense);
  assert.equal(shared.incomeCents,50000);
  assert.equal(shared.expenseCents,13000);
  const desktopExpenses=new Map();
  for(const d of existing.dailyTotals)
    for(const category of d.categories)
      desktopExpenses.set(category.name,(desktopExpenses.get(category.name)||0)+category.total);
  assert.deepEqual(
    Object.fromEntries(shared.expenses.map(r=>[r.name,r.amountCents])),
    Object.fromEntries(desktopExpenses)
  );
  const buckets=cashflowBuckets(shared.daily,'2026-11-01','2026-11-07');
  assert.equal(buckets.reduce((n,b)=>n+b.incomeCents,0),totals.income);
  assert.equal(buckets.reduce((n,b)=>n+b.expenseCents,0),totals.expense);
  assert.equal(existing.accounts.length,1);
  assert.equal(shared.netCents,37000);
 }finally{fin.close();}
});
