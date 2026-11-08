'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {PERSONAL_TABLES}=require('../electron/cloud-data-routing.cjs');
const {TABLE_KEYS}=require('../electron/cloud-migration-contract.cjs');
const {createPersonalSnapshotFromBackup,personalSnapshotSummary}
  =require('../electron/cloud-personal-snapshot.cjs');

test('creates full 17-table personal snapshot from immutable backup with exact values and no bank rows',async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-snapshot-'));
  const live=path.join(temp,'live.sqlite'),backup=path.join(temp,'backup.sqlite');
  const fin=new FinanceDB(live);
  try{
    new PlanningStore(fin);
    fin.db.prepare("INSERT INTO profiles(profile,initialized_at) VALUES ('real','2026-11-07')").run();
    fin.db.prepare("INSERT INTO profiles(profile,initialized_at) VALUES ('demo','2026-11-07')").run();
    fin.db.prepare("INSERT INTO transactions(profile,id,date,description,kind,amount_cents,category,origin) VALUES ('real','local-123','2026-11-07','Texto privado de teste','expense',1077,'Moradia','manual')").run();
    fin.db.prepare("INSERT INTO budgets(profile,category,amount_cents) VALUES ('real','Moradia',70000)").run();
    fin.db.prepare("INSERT INTO bank_items(item_id,institution,status) VALUES ('private-item','BANCO FICTÍCIO','UPDATED')").run();
    fin.db.prepare("INSERT INTO bank_accounts(account_id,item_id,name,currency,balance_cents,updated_at) VALUES ('private-bank','private-item','Conta','BRL',10000,'2026-11-07')").run();
    fin.db.prepare("INSERT INTO bank_transactions(account_id,external_id,date,description,amount_cents,status,category,updated_at) VALUES ('private-bank','original-bank-id','2026-11-07','Descrição da instituição',-1077,'POSTED','Outros','2026-11-07')").run();
    fin.db.prepare("INSERT INTO bank_manual_links(account_id,external_id,manual_id,linked_at) VALUES ('private-bank','original-bank-id','local-123','2026-11-07')").run();
    fin.db.prepare("INSERT INTO planned_items(id,title,kind,amount_cents,due_date,category,created_at,updated_at) VALUES ('planned-123','Despesa planejada','expense',5000,'2026-12-01','Moradia','2026-11-07','2026-11-07')").run();
    await fin.backupTo(backup);
    const bytes=fs.readFileSync(backup);
    const first=createPersonalSnapshotFromBackup(backup);
    const second=createPersonalSnapshotFromBackup(backup);
    assert.deepEqual(first,second);
    assert.equal(first.manifest.tables,17);
    assert.deepEqual(new Set(Object.keys(first.tables)),new Set(PERSONAL_TABLES));
    assert.equal(first.tables.transactions.rows.length,1);
    assert.equal(first.tables.transactions.rows[0].description,'Texto privado de teste');
    assert.equal(first.tables.transactions.rows[0].amount_cents,1077);
    assert.equal(first.tables.planned_items.rows[0].title,'Despesa planejada');
    assert.equal(first.tables.bank_manual_links.rows[0].external_id,'original-bank-id');
    assert.equal(first.tables.budgets.rows[0].amount_cents,70000);
    assert.equal(first.tables.profiles.rows.length,2);
    assert.equal(first.tables.bank_transactions,undefined,'Pluggy records are not copied into personal payload');
    assert.equal(first.tables.bank_items,undefined);
    assert.equal(first.tables.bank_accounts,undefined);
    assert.equal(first.tables.bank_sync_history,undefined);
    assert.equal(first.tables.app_meta,undefined);
    assert.equal(first.manifest.cloudTransferred,false);
    assert.equal(first.manifest.cutoverReady,false);
    assert.equal(first.manifest.digest.length,64);
    assert.ok(first.manifest.rows>=7);
    assert.equal(fs.readFileSync(backup).equals(bytes),true,'Snapshot must not modify backup');
    const summary=personalSnapshotSummary(first);
    assert.equal(summary.packageVerified,true);
    assert.equal(summary.personalTables,17);
    assert.equal(summary.sentToCloud,false);
    assert.doesNotMatch(JSON.stringify(summary),/local-123|Texto privado|70000|original-bank-id|private-item/);
    for(const table of PERSONAL_TABLES){
      const expected=TABLE_KEYS[table];
      for(const col of expected)assert.ok(first.tables[table].columns.includes(col));
    }
    fin.db.prepare("UPDATE transactions SET description='Depois do backup' WHERE id='local-123'").run();
    assert.equal(createPersonalSnapshotFromBackup(backup).manifest.digest,first.manifest.digest);
  }finally{fin.close();fs.rmSync(temp,{recursive:true,force:true});}
});

test('refuses snapshot if backup misses planning tables or has invalid sqlite bytes',async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-snapshot-invalid-'));
  const fin=new FinanceDB(path.join(temp,'live.sqlite'));
  try{
    const backup=path.join(temp,'before-planning.sqlite');
    await fin.backupTo(backup);
    assert.throws(()=>createPersonalSnapshotFromBackup(backup),/incompatível/);
    const broken=path.join(temp,'broken.sqlite');
    fs.writeFileSync(broken,'not a sqlite database');
    assert.throws(()=>createPersonalSnapshotFromBackup(broken));
  }finally{fin.close();fs.rmSync(temp,{recursive:true,force:true});}
});

test('snapshot summary rejects malicious objects or wrong version',()=>{
  assert.throws(()=>personalSnapshotSummary({format:'wrong'}));
  assert.throws(()=>personalSnapshotSummary({format:'mf-personal-snapshot-v1',schemaVersion:99,manifest:{tables:17}}));
});
