'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {REQUIRED_TABLES}=require('../electron/cloud-migration-audit.cjs');
const {TABLE_KEYS,BUSINESS_INVARIANTS,inspectMigrationContract}=require('../electron/cloud-migration-contract.cjs');

test('migration manifest fully maps every persisted v0.9.4 table to primary keys',()=>{
  assert.equal(Object.keys(TABLE_KEYS).length,22);
  assert.deepEqual(new Set(Object.keys(TABLE_KEYS)),new Set(REQUIRED_TABLES));
  assert.deepEqual(TABLE_KEYS.bank_transaction_splits,['account_id','external_id','position']);
  assert.deepEqual(TABLE_KEYS.planned_bank_links,['account_id','external_id']);
  assert.deepEqual(TABLE_KEYS.transactions,['profile','id']);
  assert.ok(BUSINESS_INVARIANTS.some(x=>x.includes('não entram na migração')));
});

test('contract matches real SQLite schema without exporting any information',()=>{
  const db=new FinanceDB(':memory:');
  try{
    new PlanningStore(db);
    const report=inspectMigrationContract(db);
    assert.equal(report.structuralContractOK,true,JSON.stringify(report));
    assert.equal(report.tableCount,22);
    assert.deepEqual(report.unmappedTables,[]);
    assert.deepEqual(report.unexpectedTables,[]);
    assert.deepEqual(report.wrongPrimaryKeys,[]);
    assert.equal(report.migrationApproved,false);
    assert.equal(report.recordsExported,0);
    assert.equal(report.financialDataIncluded,false);
  }finally{db.close();}
});

test('contract fails closed with missing planning tables',()=>{
  const db=new FinanceDB(':memory:');
  try{
    const report=inspectMigrationContract(db);
    assert.equal(report.structuralContractOK,false);
    assert.ok(report.missingTables.includes('planned_items'));
    assert.equal(report.migrationApproved,false);
  }finally{db.close();}
});

test('contract reports unexpected primary-key shape without reading records',()=>{
  const db=new FinanceDB(':memory:');
  try{
    new PlanningStore(db);
    // Tamper with the schema in a disposable in-memory database.
    db.db.exec('ALTER TABLE bank_duplicate_dismissals RENAME TO original_dismissals');
    db.db.exec('CREATE TABLE bank_duplicate_dismissals (pair_key TEXT NOT NULL, dismissed_at TEXT NOT NULL)');
    const report=inspectMigrationContract(db);
    assert.equal(report.structuralContractOK,false);
    assert.ok(report.wrongPrimaryKeys.some(x=>x.table==='bank_duplicate_dismissals'));
    assert.equal(report.recordsExported,0);
  }finally{db.close();}
});
