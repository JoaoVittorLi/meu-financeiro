'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {localE1Evidence}=require('../electron/cloud-e1-audit.cjs');

function staging(){
  const db=new DatabaseSync(':memory:');
  const storage={sql:{exec(query,...params){
    if(/^\s*SELECT\b/i.test(query)){
      const rows=db.prepare(query).all(...params);
      return {toArray:()=>rows,one:()=>rows[0]};
    }
    if(params.length)db.prepare(query).run(...params);else db.exec(query);
    return {toArray:()=>[],one:()=>undefined};
  }}};
  return {db,storage};
}
test('actual cloud and Windows account/category hashes match, including absent provider category default',async()=>{
  const {cloudE1Evidence}=await import('../mobile-push/src/finance-e1-audit.js');
  const {ensureBankStaging}=await import('../mobile-push/src/finance-bank-ingestion.js');
  const finance=new FinanceDB(':memory:'),cloud=staging();
  try{
    // Mirror real desktop initialization before collecting E1 evidence.
    new PlanningStore(finance);
    ensureBankStaging(cloud.storage);
    finance.db.prepare('INSERT INTO bank_items(item_id,institution,status) VALUES(?,?,?)')
      .run('synthetic-item','Banco fictício','UPDATED');
    finance.db.prepare('INSERT INTO bank_accounts(account_id,item_id,name,currency,balance_cents,updated_at) VALUES(?,?,?,?,?,?)')
      .run('synthetic-account','synthetic-item','Teste','BRL',125000,'2026-11-07');
    cloud.storage.sql.exec('INSERT INTO mf_bank_staging_accounts(account_id,item_id,name,currency,balance_cents,updated_at) VALUES(?,?,?,?,?,?)',
      'synthetic-account','synthetic-item','Teste','BRL',125000,'2026-11-07');
    for(const row of [
      {id:'tx-synthetic-1',date:'2026-11-06',amount:-1500,category:'Groceries'},
      {id:'tx-synthetic-2',date:'2026-11-07',amount:20000,category:null}
    ]){
      finance.db.prepare('INSERT INTO bank_transactions(account_id,external_id,date,description,amount_cents,status,category,updated_at) VALUES(?,?,?,?,?,?,?,?)')
        .run('synthetic-account',row.id,row.date,'Lançamento de teste',row.amount,'POSTED',
          row.category||'Outros','2026-11-07');
      cloud.storage.sql.exec('INSERT INTO mf_bank_staging_transactions(account_id,external_id,date,description,amount_cents,status,source_updated_at,ingested_at) VALUES(?,?,?,?,?,?,?,?)',
        'synthetic-account',row.id,row.date,'Lançamento de teste',row.amount,'POSTED','2026-11-07','2026-11-07');
      cloud.storage.sql.exec('INSERT INTO mf_bank_staging_categories(account_id,external_id,category_original,observed_at) VALUES(?,?,?,?)',
        'synthetic-account',row.id,row.category,'2026-11-07');
    }
    const local=localE1Evidence(finance,'/nonexistent-synthetic-test-path');
    const remote=await cloudE1Evidence(cloud.storage);
    assert.equal(remote.cloud.categoryMetadataComplete,true);
    assert.equal(remote.fingerprints.accountIdentities,local.accountIdentities);
    assert.equal(remote.fingerprints.accountBalancesUndated,local.accountBalancesUndated);
    assert.equal(remote.fingerprints.providerCategories,local.providerCategories);
    assert.equal(remote.cloudCutoverAllowed,false);
    assert.equal(remote.balanceAsOfVerified,false);
  }finally{cloud.db.close();finance.close();}
});
