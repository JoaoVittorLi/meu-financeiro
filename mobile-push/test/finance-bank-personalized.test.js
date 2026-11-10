import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readBankTransactionsPage} from '../src/finance-bank-read.js';
import {ensureBankStaging} from '../src/finance-bank-ingestion.js';
function memory(){
 const db=new DatabaseSync(':memory:');
 const storage={sql:{exec(query,...args){
  if(/^\s*SELECT\b/i.test(query)){
    const rows=db.prepare(query).all(...args);
    return {toArray:()=>rows,one:()=>rows[0]};
  }
  if(args.length)db.prepare(query).run(...args);else db.exec(query);
  return {toArray:()=>[],one:()=>undefined};
 }}};
 ensureBankStaging(storage);
 db.exec("CREATE TABLE mf_transfer_session(import_id TEXT,state TEXT,created_at TEXT)");
 db.exec("CREATE TABLE mf_transfer_rows(import_id TEXT,table_name TEXT,row_json TEXT,ordinal INTEGER)");
 db.prepare("INSERT INTO mf_transfer_session VALUES('verified-import','verified','2026-11-07')").run();
 return {db,storage,insert(table,row,n=0){
  db.prepare('INSERT INTO mf_transfer_rows VALUES(?,?,?,?)').run('verified-import',table,JSON.stringify(row),n);
 },addBank(row){
  db.prepare('INSERT INTO mf_bank_staging_transactions(account_id,external_id,date,description,amount_cents,status,source_updated_at,ingested_at) VALUES(?,?,?,?,?,?,?,?)').run(
    row.account_id,row.external_id,row.date,row.description,row.amount_cents,row.status,'2026-11-07','2026-11-07'
  );
 }};
}
test('bank preview reuses exact title, manual override, merchant and review while hiding IDs',()=>{
 const db=memory();
 try{
  db.addBank({account_id:'acc',external_id:'tx-1',date:'2026-11-06',description:'COMPRA MERCADO',amount_cents:-1234,status:'POSTED'});
  db.insert('bank_custom_titles',{account_id:'acc',external_id:'tx-1',title:'Feira semanal'});
  db.insert('bank_category_overrides',{account_id:'acc',external_id:'tx-1',category:'Alimentação'});
  db.insert('bank_transaction_notes',{account_id:'acc',external_id:'tx-1',merchant:'Supermercado pessoal',reviewed_at:'2026-11-07T10:00Z',nature:'expense'});
  db.insert('bank_transaction_splits',{account_id:'acc',external_id:'tx-1',position:0,category:'Compras',amount_cents:600},0);
  db.insert('bank_transaction_splits',{account_id:'acc',external_id:'tx-1',position:1,category:'Alimentação',amount_cents:634},1);
  db.insert('bank_manual_links',{account_id:'acc',external_id:'tx-1',manual_id:'manual-1'});
  const result=readBankTransactionsPage(db.storage);
  assert.equal(result.total,1);
  const row=result.rows[0];
  assert.equal(row.description,'COMPRA MERCADO');
  assert.equal(row.customTitle,'Feira semanal');
  assert.equal(row.merchant,'Supermercado pessoal');
  assert.equal(row.category,'Alimentação');
  assert.equal(row.categorySource,'manual');
  assert.equal(row.reviewed,true);
  assert.equal(row.splitCount,2);
  assert.equal(row.splitRequiresReview,false);
  assert.equal(row.hasManualLink,true);
  assert.equal(row.hasPlannedLink,false);
  assert.equal(result.cloudCutoverAllowed,false);
  assert.doesNotMatch(JSON.stringify(result),/"account_id"|"external_id"|"manual_id"|"item_id"/);
 }finally{db.db.close();}
});
test('deterministic local rules apply without falsely guessing missing Pluggy categories',()=>{
 const db=memory();
 try{
  db.addBank({account_id:'acc',external_id:'tx-2',date:'2026-11-06',description:'IFOOD RESTAURANTE',amount_cents:-3000,status:'POSTED'});
  db.addBank({account_id:'acc',external_id:'tx-3',date:'2026-11-06',description:'OUTRO DESTINATÁRIO',amount_cents:-1000,status:'POSTED'});
  db.insert('category_rules',{id:2,scope:'bank',enabled:1,pattern:'IFOOD',match_mode:'contains',priority:5,category:'Alimentação'});
  const page=readBankTransactionsPage(db.storage);
  assert.equal(page.rows.find(r=>r.description==='IFOOD RESTAURANTE')?.category,'Alimentação');
  const uncategorized=page.rows.find(r=>r.description==='OUTRO DESTINATÁRIO');
  assert.equal(uncategorized.category,null);
  assert.equal(uncategorized.categorySource,'pending_provider_category');
  assert.equal(uncategorized.nature,'auto');
 }finally{db.db.close();}
});
test('outdated split never claims to be valid after changing original bank amount',()=>{
 const db=memory();
 try{
  db.addBank({account_id:'a',external_id:'one',date:'2026-11-07',description:'TESTE',amount_cents:-1000,status:'POSTED'});
  db.insert('bank_transaction_splits',{account_id:'a',external_id:'one',position:0,category:'Compras',amount_cents:900});
  const result=readBankTransactionsPage(db.storage);
  assert.equal(result.rows[0].splitRequiresReview,true);
  assert.equal(result.rows[0].splitCount,0);
 }finally{db.db.close();}
});
