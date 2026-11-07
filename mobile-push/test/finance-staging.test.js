import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {runSyntheticMigrationDryRun,ensureStagingSchema,STAGING_TABLES} from '../src/finance-staging.js';
import {PushHome} from '../src/worker.js';

function fakeDurableObjectStorage(){
  const db=new DatabaseSync(':memory:');
  const sql={
    exec(query,...params){
      const select=/^\s*SELECT\b/i.test(query);
      if(select){
        const rows=db.prepare(query).all(...params);
        return {toArray:()=>rows,one:()=>rows[0]};
      }
      if(params.length)db.prepare(query).run(...params);
      else db.exec(query);
      return {toArray:()=>[],one:()=>undefined};
    }
  };
  return {
    sql,close:()=>db.close(),
    transactionSync(fn){
      db.exec('BEGIN IMMEDIATE');
      try{
        const result=fn();
        db.exec('COMMIT');
        return result;
      }catch(error){db.exec('ROLLBACK');throw error;}
    }
  };
}

test('migration staging preserves a complete 22-table v0.9.4 shape with only synthetic values',()=>{
  assert.equal(STAGING_TABLES.length,22);
  const storage=fakeDurableObjectStorage();
  try{
    const a=runSyntheticMigrationDryRun(storage);
    assert.equal(a.ok,true);
    assert.equal(a.schemaVersion,1);
    assert.equal(a.tableCount,22);
    assert.equal(a.mode,'synthetic_only');
    assert.equal(a.realFinancialDataAccepted,false);
    assert.equal(a.financialMigrationActivated,false);
    assert.equal(a.recordsImportedFromDevice,0);
    assert.equal(a.bankRecordCount,3);
    assert.equal(a.canonicalCashflowCents,4000);
    assert.equal(a.originalCashflowCents,4000);
    assert.equal(a.manualLinkedCount,1);
    assert.equal(a.splitReconciled,true);
    assert.equal(a.plannedReconciled,true);
    assert.equal(a.originalDescriptionPreserved,true);
    const count=storage.sql.exec('SELECT COUNT(*) AS n FROM mf_stage_bank_transactions').one().n;
    const b=runSyntheticMigrationDryRun(storage);
    assert.deepEqual(b,a,'Repeat dry-run must be idempotent');
    assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_stage_bank_transactions').one().n,count);
    assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_stage_planned_bank_links').one().n,1);
    assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_stage_bank_manual_links').one().n,1);
    assert.equal(storage.sql.exec("SELECT COUNT(*) AS n FROM sync_documents").toArray?.()?.[0]?.n||0,0);
  }finally{storage.close();}
});

test('staging refuses a financial reconciliation drift without accepting outside data',()=>{
  const storage=fakeDurableObjectStorage();
  try{
    runSyntheticMigrationDryRun(storage);
    storage.sql.exec("UPDATE mf_stage_bank_transaction_splits SET amount_cents=1499 WHERE external_id='test-bank-2' AND position=1");
    assert.throws(()=>runSyntheticMigrationDryRun(storage),/divisão|divis|conferir/i);
  }finally{storage.close();}
});

test('schema version is checked independently of PRAGMA user_version',()=>{
  const storage=fakeDurableObjectStorage();
  try{
    ensureStagingSchema(storage);
    storage.sql.exec('UPDATE mf_stage_version SET version=77');
    assert.throws(()=>ensureStagingSchema(storage),/incompatível/);
  }finally{storage.close();}
});

test('private Durable Object staging route never accepts client-imported records',async()=>{
  const storage=fakeDurableObjectStorage();
  try{
    const home=new PushHome({storage},{});
    const response=await home.fetch(new Request('https://internal/migration/dry-run',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({records:[{real:true,amount_cents:99999}]})
    }));
    assert.equal(response.status,200);
    const payload=await response.json();
    assert.equal(payload.ok,true);
    assert.equal(payload.recordsImportedFromDevice,0);
    assert.equal(payload.canonicalCashflowCents,4000);
    assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_stage_bank_transactions').one().n,3);
  }finally{storage.close();}
});
