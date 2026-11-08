import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {
 beginPersonalTransfer,applyPersonalChunk,verifyPersonalTransfer,cancelPersonalTransfer
} from '../src/finance-personal-batches.js';
const require=createRequire(import.meta.url);
const {FinanceDB}=require('../../electron/db.cjs');
const {PlanningStore}=require('../../electron/planning.cjs');
const {createPersonalSnapshotFromBackup}=require('../../electron/cloud-personal-snapshot.cjs');
const ID='7532671a-5441-4f92-ad16-684aff5849e2';
const OTHER='7b4c9012-8a40-4964-a365-9dd8a4e8799c';

function memoryDO(){
 const db=new DatabaseSync(':memory:');
 const sql={exec(query,...args){
  if(/^\s*SELECT\b/i.test(query)){
   const rows=db.prepare(query).all(...args);
   return {toArray:()=>rows,one:()=>rows[0]};
  }
  if(args.length)db.prepare(query).run(...args);
  else db.exec(query);
  return {toArray:()=>[],one:()=>undefined};
 }};
 return {sql,close:()=>db.close(),transactionSync(fn){
  db.exec('BEGIN IMMEDIATE');
  try{const value=fn();db.exec('COMMIT');return value;}
  catch(error){db.exec('ROLLBACK');throw error;}
 }};
}

async function makePackage(count=191){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mf-batches-'));
 const finance=new FinanceDB(path.join(folder,'live.sqlite'));
 try{
  new PlanningStore(finance);
  finance.db.prepare("INSERT INTO profiles(profile,initialized_at) VALUES ('real','2026-11-07')").run();
  const insert=finance.db.prepare('INSERT INTO transactions(profile,id,date,description,kind,amount_cents,category,origin) VALUES (?,?,?,?,?,?,?,?)');
  for(let i=0;i<count;i++)insert.run('real','fake-'+String(i).padStart(4,'0'),
    '2026-11-07','Despesa fictícia '+i,'expense',100+i,'Moradia','manual');
  const backup=path.join(folder,'backup.sqlite');
  await finance.backupTo(backup);
  const snap=createPersonalSnapshotFromBackup(backup);
  return snap;
 }finally{finance.close();fs.rmSync(folder,{recursive:true,force:true});}
}
function manifest(snap){return {...snap.manifest,format:snap.format,schemaVersion:snap.schemaVersion};}
function fill(storage,snap,id=ID){
 let firstReplay=false;
 for(const [table,block] of Object.entries(snap.tables)){
  for(let offset=0;offset<block.rows.length;offset+=80){
   const payload={importId:id,table,offset,rows:block.rows.slice(offset,offset+80)};
   const value=applyPersonalChunk(storage,payload);
   assert.equal(value.ok,true);
   if(table==='transactions'&&offset===0){
    const replay=applyPersonalChunk(storage,payload);
    assert.equal(replay.replayed,Math.min(block.rows.length,80));
    assert.equal(replay.inserted,0);
    firstReplay=true;
   }
  }
 }
 assert.equal(firstReplay,true);
}

test('large personal snapshot transfers in 80-row idempotent blocks, restores exact hashes and never activates finance',async()=>{
 const snap=await makePackage(191),storage=memoryDO();
 try{
  const start=beginPersonalTransfer(storage,{importId:ID,manifest:manifest(snap)});
  assert.equal(start.stage,'receiving');
  assert.equal(start.replayed,false);
  assert.equal(start.expectedRows,snap.manifest.rows);
  assert.equal(beginPersonalTransfer(storage,{importId:ID,manifest:manifest(snap)}).replayed,true);
  fill(storage,snap);
  const verified=await verifyPersonalTransfer(storage,ID);
  assert.equal(verified.ok,true);
  assert.equal(verified.stage,'quarantine_verified');
  assert.equal(verified.personalTables,17);
  assert.equal(verified.personalRecords,snap.manifest.rows);
  assert.equal(verified.financialSyncEnabled,false);
  assert.equal(verified.cutoverAllowed,false);
  assert.equal(verified.realDataPublished,false);
  assert.equal((await verifyPersonalTransfer(storage,ID)).stage,'quarantine_verified');
  assert.equal(storage.sql.exec("SELECT COUNT(*) AS n FROM mf_transfer_rows").one().n,snap.manifest.rows);
  assert.deepEqual(storage.sql.exec("SELECT name FROM sqlite_master WHERE name='sync_documents' OR name='bank_transactions'").toArray(),[]);
  assert.throws(()=>applyPersonalChunk(storage,{
   importId:ID,table:'transactions',offset:0,rows:[snap.tables.transactions.rows[0]]
  }),/não está aberta/);
  const rollback=cancelPersonalTransfer(storage,ID);
  assert.equal(rollback.discarded,true);
  assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_rows').one().n,0);
  assert.equal(storage.sql.exec('SELECT state FROM mf_transfer_session').one().state,'aborted');
  await assert.rejects(()=>verifyPersonalTransfer(storage,ID),/cancelada/);
 }finally{storage.close();}
});

test('partial data and wrong or conflicting replay cannot pass financial verification',async()=>{
 const snap=await makePackage(89),storage=memoryDO();
 try{
  beginPersonalTransfer(storage,{importId:ID,manifest:manifest(snap)});
  assert.throws(()=>applyPersonalChunk(storage,{
   importId:ID,table:'transactions',offset:99,rows:snap.tables.transactions.rows.slice(0,1)
  }),/excede a contagem/);
  const first=snap.tables.transactions.rows.slice(0,80);
  const chunk={importId:ID,table:'transactions',offset:0,rows:first};
  assert.equal(applyPersonalChunk(storage,chunk).inserted,80);
  const changed=first.map(row=>({...row}));
  changed[0].description='ALTERADA';
  assert.throws(()=>applyPersonalChunk(storage,{...chunk,rows:changed}),/conteúdo diferente/);
  assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_rows').one().n,80);
  await assert.rejects(()=>verifyPersonalTransfer(storage,ID),/incompleta/);
  assert.throws(()=>beginPersonalTransfer(storage,{importId:OTHER,manifest:manifest(snap)}),/transferência ativa/);
  assert.equal(cancelPersonalTransfer(storage,ID).discarded,true);
  assert.equal(beginPersonalTransfer(storage,{importId:OTHER,manifest:manifest(snap)}).stage,'receiving');
 }finally{storage.close();}
});

test('invalid manifest, credentials, malformed chunks and duplicate row mutation fail closed',async()=>{
 const snap=await makePackage(3),storage=memoryDO();
 try{
  assert.throws(()=>beginPersonalTransfer(storage,{importId:ID,manifest:{
   ...manifest(snap),rows:9999999
  }}),/limites/);
  assert.throws(()=>beginPersonalTransfer(storage,{importId:ID,manifest:{
   ...manifest(snap),byTable:{...snap.manifest.byTable,bank_transactions:{rows:0,digest:'a'.repeat(64)}}
  }}),/tabelas/);
  const okay=beginPersonalTransfer(storage,{importId:ID,manifest:manifest(snap)});
  assert.equal(okay.ok,true);
  const valid=snap.tables.transactions.rows[0];
  assert.throws(()=>applyPersonalChunk(storage,{importId:ID,table:'bank_transactions',offset:0,rows:[valid]}),/tabela desconhecida/);
  assert.throws(()=>applyPersonalChunk(storage,{importId:ID,table:'transactions',offset:0,rows:[{...valid,clientSecret:'PRIVATE'}]}),/colunas não conferem/);
  assert.throws(()=>applyPersonalChunk(storage,{importId:ID,table:'transactions',offset:0,rows:[{...valid,amount_cents:3.56}]}),/tipo de valor/);
  assert.throws(()=>applyPersonalChunk(storage,{importId:ID,table:'transactions',offset:0,rows:Array(81).fill(valid)}),/fora dos limites/);
  assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_rows').one().n,0);
 }finally{storage.close();}
});

test('a missing block cannot be hidden by claiming all counters are complete',async()=>{
 const snap=await makePackage(2),storage=memoryDO();
 try{
  beginPersonalTransfer(storage,{importId:ID,manifest:manifest(snap)});
  fill(storage,snap);
  storage.sql.exec('DELETE FROM mf_transfer_rows WHERE import_id=? AND table_name=? AND ordinal=?',ID,'transactions',0);
  await assert.rejects(()=>verifyPersonalTransfer(storage,ID),/tabela não foi recebida|transferência incompleta|Hash ou contagem/);
 }finally{storage.close();}
});
