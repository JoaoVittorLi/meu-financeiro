import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {readFinancePreviewPeriod} from '../src/finance-period-preview.js';
import {ensureBankStaging} from '../src/finance-bank-ingestion.js';
import {aggregateFinancePeriod,cashflowBuckets,budgetProgress} from '../../shared/finance-period-ledger.mjs';
import worker from '../src/worker.js';

function memory(){
 const db=new DatabaseSync(':memory:');
 const storage={sql:{exec(q,...args){
  if(/^\s*SELECT\b/i.test(q)){
    const rows=db.prepare(q).all(...args);
    return {toArray:()=>rows,one:()=>rows[0]};
  }
  if(args.length)db.prepare(q).run(...args);else db.exec(q);
  return {toArray:()=>[],one:()=>undefined};
 }}};
 ensureBankStaging(storage);
 db.exec("CREATE TABLE mf_transfer_session(import_id TEXT,state TEXT,created_at TEXT)");
 db.exec("CREATE TABLE mf_transfer_rows(import_id TEXT,table_name TEXT,row_json TEXT,ordinal INTEGER)");
 db.prepare("INSERT INTO mf_transfer_session VALUES('verified-set','verified','2026-11-07')").run();
 let ord=0;
 return {db,storage,
   addBank(externalId,date,description,amount,status='POSTED'){
     db.prepare('INSERT INTO mf_bank_staging_transactions(account_id,external_id,date,description,amount_cents,status,source_updated_at,ingested_at) VALUES(?,?,?,?,?,?,?,?)')
       .run('account-a',externalId,date,description,amount,status,'2026-11-07','2026-11-07');
   },
   add(table,row){db.prepare('INSERT INTO mf_transfer_rows VALUES(?,?,?,?)').run('verified-set',table,JSON.stringify(row),ord++);}
 };
}
test('deterministic cashflow splits revenue and expenses without mixing manual and bank',()=>{
 const bank=[
  {date:'2026-11-05',status:'POSTED',amountCents:-10000,nature:'expense',category:'Alimentação'},
  {date:'2026-11-05',status:'POSTED',amountCents:10000,nature:'transfer',category:'Transferências'},
  {date:'2026-11-06',status:'PENDING',amountCents:-7000,nature:'expense',category:'Outros'},
  {date:'2026-11-07',status:'POSTED',amountCents:-1000,nature:'expense',category:'Lazer',
    splits:[{category:'Compras',amountCents:600},{category:'Alimentação',amountCents:400}]},
  {date:'2026-11-07',status:'POSTED',amountCents:5000,nature:'income',category:'Salário'}
 ];
 const summary=aggregateFinancePeriod(bank,{start:'2026-11-01',end:'2026-11-07',source:'bank'});
 assert.deepEqual([summary.incomeCents,summary.expenseCents,summary.netCents],[5000,11000,-6000]);
 assert.equal(summary.excluded,2);
 assert.equal(summary.transactionsIncluded,3);
 assert.equal(summary.expenses.find(x=>x.name==='Alimentação').amountCents,10400);
 assert.equal(summary.expenses.find(x=>x.name==='Compras').amountCents,600);
 assert.equal(summary.categoryCoverageComplete,true);
 const buckets=cashflowBuckets(summary.daily,'2026-11-01','2026-11-07',7);
 assert.equal(buckets.length,7);
 assert.equal(buckets.reduce((v,x)=>v+x.incomeCents,0),summary.incomeCents);
 assert.equal(buckets.reduce((v,x)=>v+x.expenseCents,0),summary.expenseCents);
 const manual=aggregateFinancePeriod(
  [{date:'2026-11-07',kind:'expense',amountCents:900,category:'Lazer'}],
  {start:'2026-11-01',end:'2026-11-07',source:'manual'}
 );
 assert.equal(manual.expenseCents,900);
 assert.equal(summary.expenseCents,11000,'Bank and manual sources are not combined');
 assert.deepEqual(budgetProgress([{category:'Alimentação',amountCents:30000}],summary.expenses)[0],
  {category:'Alimentação',limitCents:30000,spentCents:10400,pct:35});
});
test('dashboard uses all POSTED bank staging rows and verified personal overlays, without changing balances',()=>{
 const s=memory();
 try{
  s.addBank('t1','2026-11-05','Compras do mês',-10000);
  s.addBank('t2','2026-11-06','PIX própria',250000);
  s.addBank('t3','2026-11-06','Não categorizado',-2000);
  s.addBank('t4','2026-11-06','Pendente',-1500,'PENDING');
  s.addBank('t5','2026-11-07','Recebimento',5000);
  s.addBank('t6','2026-11-07','Compra dividida',-1000);
  s.add('bank_category_overrides',{account_id:'account-a',external_id:'t1',category:'Alimentação'});
  s.add('bank_transaction_notes',{account_id:'account-a',external_id:'t2',nature:'transfer',reviewed_at:'2026-11-07'});
  s.add('bank_category_overrides',{account_id:'account-a',external_id:'t5',category:'Salário'});
  s.add('bank_transaction_splits',{account_id:'account-a',external_id:'t6',position:0,amount_cents:600,category:'Transporte'});
  s.add('bank_transaction_splits',{account_id:'account-a',external_id:'t6',position:1,amount_cents:400,category:'Compras'});
  s.add('transactions',{profile:'real',id:'m1',date:'2026-11-07',kind:'expense',amount_cents:3000,category:'Lazer'});
  s.add('transactions',{profile:'real',id:'m2',date:'2026-11-06',kind:'income',amount_cents:11000,category:'Salário'});
  s.add('transactions',{profile:'demo',id:'demo',date:'2026-11-05',kind:'income',amount_cents:150000,category:'Salário'});
  s.add('budgets',{profile:'real',category:'Alimentação',amount_cents:30000});
  s.add('budgets',{profile:'real',category:'Transporte',amount_cents:0});
  s.add('categories',{name:'Alimentação',kind:'expense'});
  s.add('categories',{name:'Transporte',kind:'expense'});
  const before=s.db.prepare('SELECT COUNT(*) AS n FROM mf_bank_staging_transactions').get().n;
  const bank=readFinancePreviewPeriod(s.storage,{start:'2026-11-01',end:'2026-11-07',source:'bank'});
  assert.deepEqual([bank.incomeCents,bank.expenseCents,bank.netCents],[5000,13000,-8000]);
  assert.equal(bank.transactionsIncluded,4);
  assert.equal(bank.excluded,2);
  assert.equal(bank.unclassifiedCents,2000);
  assert.equal(bank.categoryCoverageComplete,false);
  assert.equal(bank.budgets.find(x=>x.category==='Alimentação').spentCents,10000);
  assert.equal(bank.budgets.find(x=>x.category==='Transporte').limitCents,0);
  assert.equal(bank.budgetCategoryCoverageComplete,false);
  assert.equal(bank.financialSyncEnabled,false);
  assert.equal(bank.cloudCutoverAllowed,false);
  assert.equal(bank.balanceVerified,false);
  assert.equal(bank.bankProviderCategoriesVerified,false);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM mf_bank_staging_transactions').get().n,before);
  const manual=readFinancePreviewPeriod(s.storage,{start:'2026-11-01',end:'2026-11-07',source:'manual'});
  assert.deepEqual([manual.incomeCents,manual.expenseCents],[11000,3000]);
  assert.equal(manual.transactionsIncluded,2);
  assert.equal(manual.unclassifiedCents,0);
  assert.doesNotMatch(JSON.stringify(bank),/account-a|Compras do mês|PIX própria|m1|verified-set/);
 }finally{s.db.close();}
});
test('period engine fails closed for bad dates, sources, amounts and overlong intervals',()=>{
 for(const args of [
  {start:'2026-02-30',end:'2026-03-03',source:'bank'},
  {start:'2026-11-07',end:'2026-11-01',source:'bank'},
  {start:'2024-01-01',end:'2026-11-01',source:'manual'},
  {start:'2026-11-01',end:'2026-11-07',source:'both'}
 ])assert.throws(()=>aggregateFinancePeriod([],args));
 assert.throws(()=>aggregateFinancePeriod([
   {date:'2026-11-01',status:'POSTED',amountCents:1.5}
 ],{start:'2026-11-01',end:'2026-11-07',source:'bank'}));
 assert.throws(()=>cashflowBuckets([], '2026-11-01','2026-11-07',0));
});
test('financial period route requires owner session and Access in Preview',async()=>{
 const origin='https://example.test';
 const env={APP_ACCESS_TOKEN:'sample-login-secret-synthetic-000001',ASSETS:{fetch:()=>new Response('ok')}};
 const url=origin+'/api/finance/period-summary?start=2026-11-01&end=2026-11-07&source=bank';
 const anon=await worker.fetch(new Request(url),env);
 assert.equal(anon.status,401);
 const login=await worker.fetch(new Request(origin+'/api/login',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({code:env.APP_ACCESS_TOKEN})
 }),env);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const prod=await worker.fetch(new Request(url,{headers:{Cookie:cookie}}),env);
 assert.equal(prod.status,403);
 const noJwt=await worker.fetch(new Request(url,{headers:{Cookie:cookie}}),{
  ...env,PERSONAL_QUARANTINE_ENABLED:'true',
  TEAM_DOMAIN:'https://dummy.cloudflareaccess.com',POLICY_AUD:'f'.repeat(64),
  ACCESS_ALLOWED_EMAIL:'owner@example.test'
 });
 assert.equal(noJwt.status,403);
});
test('frontend connects protected read-only summaries and keeps the user informed',()=>{
 const page=readFileSync(new URL('../public/finance.html',import.meta.url),'utf8');
 const client=readFileSync(new URL('../public/finance-analytics.js',import.meta.url),'utf8');
 for(const id of ['analyticsFilters','cashIncome','cashExpense','cashNet','financeFlow','financeCategoryList','budgetProgressList'])
  assert.match(page,new RegExp('id="'+id+'"'));
 assert.match(client,/\/api\/finance\/period-summary/);
 assert.match(client,/balanceVerified!==false/);
 assert.doesNotMatch(client,/localStorage|indexedDB|sessionStorage|caches\.open|PLUGGY_CLIENT/);
});
