import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ingestPluggyToStaging,ensureBankStaging} from '../src/finance-bank-ingestion.js';
import {readBankTransactionsPage} from '../src/finance-bank-read.js';
import {readFinancePreviewPeriod} from '../src/finance-period-preview.js';

const item='85129070-9cb6-46a5-8c1c-928ced5ab953';
const account='3675ff9e-7adc-4fd2-8fad-a0a8a46d093e';
const tx='1486b2cf-0c13-4eb5-ac3d-b2984e4dcc4d';
const config={PLUGGY_SERVER_ENABLED:'true',PERSONAL_QUARANTINE_ENABLED:'true',
 PLUGGY_CLIENT_ID:'long-fake-app-id',PLUGGY_CLIENT_SECRET:'long-fake-secret-never-used',
 PLUGGY_ITEM_IDS:item};
function memory(){
 const db=new DatabaseSync(':memory:');
 const store={sql:{exec(q,...args){
  if(/^\s*SELECT\b/i.test(q)){
   const rows=db.prepare(q).all(...args);
   return {toArray:()=>rows,one:()=>rows[0]};
  }
  if(args.length)db.prepare(q).run(...args);else db.exec(q);
  return {toArray:()=>[],one:()=>undefined};
 }},transactionSync(fn){
  db.exec('BEGIN IMMEDIATE');
  try{const value=fn();db.exec('COMMIT');return value;}
  catch(error){db.exec('ROLLBACK');throw error;}
 }};
 ensureBankStaging(store);
 db.exec("CREATE TABLE mf_transfer_session(import_id TEXT,state TEXT,created_at TEXT)");
 db.exec("CREATE TABLE mf_transfer_rows(import_id TEXT,table_name TEXT,row_json TEXT,ordinal INTEGER)");
 db.prepare("INSERT INTO mf_transfer_session VALUES('confirmed','verified','2026-11-07')").run();
 let ord=0;
 const add=(table,row)=>db.prepare('INSERT INTO mf_transfer_rows VALUES(?,?,?,?)')
   .run('confirmed',table,JSON.stringify(row),ord++);
 add('categories',{name:'Alimentação',kind:'expense'});
 add('categories',{name:'Outros',kind:'both'});
 return {db,store,add};
}
function provider(originalCategory,{fail=false}={}){
 return {
  async listAccounts(){return [{id:account,type:'BANK',currencyCode:'BRL',name:'Fictícia',balance:750}]},
  async listTransactions(){
   if(fail)throw Error('DUMMY SECRET MUST NOT LEAK');
   return [{id:tx,accountId:account,date:'2026-11-07',amount:-25.33,
    description:'Mercado TESTE',status:'POSTED',category:originalCategory}];
  }
 };
}
test('additive Pluggy category sidecar restores desktop mapping without rewriting original history',async()=>{
 const m=memory();
 try{
  const first=await ingestPluggyToStaging(m.store,config,{provider:provider('Groceries')});
  assert.equal(first.ok,true);
  assert.equal(first.financialSyncEnabled,false);
  const raw=m.db.prepare('SELECT description,amount_cents FROM mf_bank_staging_transactions').get();
  assert.equal(raw.amount_cents,-2533);
  const meta=m.db.prepare('SELECT category_original FROM mf_bank_staging_categories').get();
  assert.equal(meta.category_original,'Groceries');
  const page=readBankTransactionsPage(m.store);
  assert.equal(page.rows[0].category,'Alimentação');
  assert.equal(page.rows[0].categorySource,'bank');
  assert.equal(page.rows[0].description,'Mercado TESTE');
  const aggregate=readFinancePreviewPeriod(m.store,
   {start:'2026-11-01',end:'2026-11-07',source:'bank'});
  assert.equal(aggregate.expenseCategories[0].name,'Alimentação');
  assert.equal(aggregate.expenseCents,2533);
  assert.equal(aggregate.unclassifiedCents,0);
  assert.equal(aggregate.cloudCutoverAllowed,false);
  m.add('bank_category_overrides',{account_id:account,external_id:tx,category:'Outros'});
  const override=readBankTransactionsPage(m.store);
  assert.equal(override.rows[0].category,'Outros');
  assert.equal(override.rows[0].categorySource,'manual');
  const failed=await ingestPluggyToStaging(m.store,config,{provider:provider('Salary',{fail:true})});
  assert.equal(failed.ok,false);
  assert.equal(m.db.prepare('SELECT category_original FROM mf_bank_staging_categories').get().category_original,'Groceries');
  assert.equal(m.db.prepare('SELECT COUNT(*) AS n FROM mf_bank_staging_transactions').get().n,1);
 }finally{m.db.close();}
});
test('provider category absent never claims category parity, refresh remains idempotent',async()=>{
 const m=memory();try{
  const first=await ingestPluggyToStaging(m.store,config,{provider:provider(undefined)});
  assert.equal(first.ok,true);
  assert.equal(m.db.prepare('SELECT category_original FROM mf_bank_staging_categories').get().category_original,null);
  const noMeta=readBankTransactionsPage(m.store);
  assert.equal(noMeta.rows[0].category,null);
  assert.equal(noMeta.rows[0].categorySource,'pending_provider_category');
  const next=await ingestPluggyToStaging(m.store,config,{provider:provider('Salary')});
  assert.equal(next.ok,true);
  assert.equal(readBankTransactionsPage(m.store).rows[0].category,'Outros',
   'Income provider label falls back like desktop when target is unavailable');
  assert.equal(m.db.prepare('SELECT COUNT(*) AS n FROM mf_bank_staging_transactions').get().n,1);
  assert.equal(m.db.prepare('SELECT COUNT(*) AS n FROM mf_bank_staging_categories').get().n,1);
 }finally{m.db.close();}
});
