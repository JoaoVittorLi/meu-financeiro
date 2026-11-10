import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {stagePersonalSnapshot,discardPersonalQuarantine} from '../src/finance-personal-quarantine.js';
const require=createRequire(import.meta.url);
const {FinanceDB}=require('../../electron/db.cjs');
const {PlanningStore}=require('../../electron/planning.cjs');
const {createPersonalSnapshotFromBackup}=require('../../electron/cloud-personal-snapshot.cjs');
const ID='3328ad50-f838-4cad-9f92-21498a326b60',OTHER='39b7d61e-6547-45d1-a59b-269f63ec36ee';

function memoryDO(){
  const db=new DatabaseSync(':memory:');
  const sql={exec(query,...params){
    if(/^\s*SELECT\b/i.test(query)){
      const rows=db.prepare(query).all(...params);
      return {toArray:()=>rows,one:()=>rows[0]};
    }
    if(params.length)db.prepare(query).run(...params);
    else db.exec(query);
    return {toArray:()=>[],one:()=>undefined};
  }};
  return {sql,close:()=>db.close(),
    transactionSync(fn){
      db.exec('BEGIN IMMEDIATE');
      try{const result=fn();db.exec('COMMIT');return result;}
      catch(error){db.exec('ROLLBACK');throw error;}
    }
  };
}
async function syntheticPackage(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-import-test-'));
  const file=path.join(dir,'backup.sqlite');
  const fin=new FinanceDB(path.join(dir,'active.sqlite'));
  try{
    new PlanningStore(fin);
    fin.db.prepare("INSERT INTO profiles(profile,initialized_at) VALUES ('real','2026-11-07')").run();
    fin.db.prepare("INSERT INTO transactions(profile,id,date,description,kind,amount_cents,category,origin) VALUES ('real','fake-001','2026-11-07','Teste fictício','expense',3599,'Outros','manual')").run();
    await fin.backupTo(file);
    return createPersonalSnapshotFromBackup(file);
  }finally{fin.close();fs.rmSync(dir,{recursive:true,force:true});}
}

test('stages validated personal rows atomically, replay is idempotent and nothing becomes active',async()=>{
  const payload=await syntheticPackage(),storage=memoryDO();
  try{
    const first=await stagePersonalSnapshot(storage,ID,payload);
    assert.equal(first.ok,true);
    assert.equal(first.replayed,false);
    assert.equal(first.rows,payload.manifest.rows);
    assert.equal(first.tables,17);
    assert.equal(first.cutoverEnabled,false);
    assert.equal(first.financialSyncEnabled,false);
    const saved=storage.sql.exec('SELECT row_json FROM mf_import_records WHERE table_name=?', 'transactions').toArray();
    assert.equal(saved.length,1);
    assert.equal(JSON.parse(saved[0].row_json).description,'Teste fictício');
    const replay=await stagePersonalSnapshot(storage,ID,payload);
    assert.equal(replay.replayed,true);
    assert.equal(replay.rows,first.rows);
    const records=storage.sql.exec('SELECT COUNT(*) AS n FROM mf_import_records').one().n;
    assert.equal(records,first.rows);
    assert.deepEqual(storage.sql.exec("SELECT name FROM sqlite_master WHERE name='sync_documents' OR name='mf_stage_transactions'").toArray(),[]);
    await assert.rejects(()=>stagePersonalSnapshot(storage,OTHER,payload),/Já existe uma migração/);
    assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_import_manifest').one().n,1);
    const rollback=discardPersonalQuarantine(storage,ID);
    assert.equal(rollback.discarded,true);
    assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_import_records').one().n,0);
    const aborted=storage.sql.exec('SELECT state FROM mf_import_manifest').one().state;
    assert.equal(aborted,'aborted');
    await assert.rejects(()=>stagePersonalSnapshot(storage,ID,payload),/outro pacote/);
    const next=await stagePersonalSnapshot(storage,OTHER,payload);
    assert.equal(next.replayed,false);
  }finally{storage.close();}
});

test('rejects tampered or malformed personal payload before any financial write',async()=>{
  const storage=memoryDO();
  try{
    const payload=await syntheticPackage();
    payload.tables.transactions.rows[0].amount_cents=99999;
    await assert.rejects(()=>stagePersonalSnapshot(storage,ID,payload),/Hash ou contagem/);
    assert.deepEqual(storage.sql.exec("SELECT name FROM sqlite_master WHERE name='mf_import_manifest'").toArray(),[]);
    const clean=await syntheticPackage();
    await assert.rejects(()=>stagePersonalSnapshot(storage,'not-uuid',clean),/Identificador/);
    assert.deepEqual(storage.sql.exec("SELECT name FROM sqlite_master WHERE name='mf_import_manifest'").toArray(),[]);
  }finally{storage.close();}
});

test('duplicate keys rejected and aborting a nonexistent quarantine changes nothing',async()=>{
  const storage=memoryDO();
  try{
    const payload=await syntheticPackage();
    payload.tables.transactions.rows.push({...payload.tables.transactions.rows[0]});
    await assert.rejects(()=>stagePersonalSnapshot(storage,ID,payload),/Hash ou contagem|Chave duplicada/);
    assert.equal(discardPersonalQuarantine(storage,ID).discarded,false);
    assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_import_manifest').one().n,0);
  }finally{storage.close();}
});
