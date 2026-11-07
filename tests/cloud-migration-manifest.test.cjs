'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {inspectLocalBackupManifest}=require('../electron/cloud-migration-manifest.cjs');

test('desktop backup manifest is offline, deterministic, read-only and detects record changes',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-migration-manifest-'));
  const live=path.join(dir,'active.sqlite');
  const before=path.join(dir,'backup-before.sqlite');
  const after=path.join(dir,'backup-after.sqlite');
  const db=new FinanceDB(live);
  try{
    new PlanningStore(db);
    db.db.prepare("INSERT OR IGNORE INTO profiles(profile) VALUES ('real')").run();
    db.db.prepare("INSERT INTO transactions(profile,id,date,description,kind,amount_cents,category,origin) VALUES ('real','example-001','2026-11-07','TRANSAÇÃO FICTÍCIA','expense',2500,'Moradia','manual')").run();
    await db.backupTo(before);
    const beforeBytes=fs.readFileSync(before);
    const first=inspectLocalBackupManifest(before);
    const second=inspectLocalBackupManifest(before);
    assert.deepEqual(first,second);
    assert.equal(first.ok,true);
    assert.equal(first.tableCount,22);
    assert.equal(first.schemaVersion,6);
    assert.equal(first.rowsUploaded,0);
    assert.equal(first.containsRawRecords,false);
    assert.equal(first.migrationApproved,false);
    assert.equal(first.integrityOK,true);
    assert.equal(first.foreignKeyViolationCount,0);
    assert.equal(first.tables.transactions.rows,1);
    assert.equal(first.tables.transactions.sumCents.amount_cents,2500);
    assert.equal(first.manifestSha256.length,64);
    assert.equal(fs.readFileSync(before).equals(beforeBytes),true,'Read-only audit cannot modify backup');
    const rendered=JSON.stringify(first);
    assert.doesNotMatch(rendered,/TRANSAÇÃO FICTÍCIA|example-001|active.sqlite/);
    assert.equal(Object.keys(first.tables).length,22);

    db.db.prepare("UPDATE transactions SET amount_cents=2600 WHERE id='example-001'").run();
    await db.backupTo(after);
    const third=inspectLocalBackupManifest(after);
    assert.equal(third.tables.transactions.rows,1);
    assert.equal(third.tables.transactions.sumCents.amount_cents,2600);
    assert.notEqual(third.tables.transactions.sha256,first.tables.transactions.sha256);
    assert.notEqual(third.manifestSha256,first.manifestSha256);
    assert.equal(inspectLocalBackupManifest(before).manifestSha256,first.manifestSha256,
      'Backup is immutable even after desktop source changes');
  }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('manifest rejects a missing file and a malformed SQLite backup',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-migration-reject-'));
  try{
    const invalid=path.join(dir,'not-a-backup.sqlite');
    fs.writeFileSync(invalid,Buffer.alloc(512));
    assert.throws(()=>inspectLocalBackupManifest(invalid),/cópia válida|inválida|danificada/i);
    assert.throws(()=>inspectLocalBackupManifest(path.join(dir,'missing.sqlite')));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
