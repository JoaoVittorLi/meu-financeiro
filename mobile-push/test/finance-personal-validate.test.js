import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {validatePersonalMigrationPackage,PERSONAL_COLUMNS} from '../src/finance-personal-validate.js';
const require=createRequire(import.meta.url);
const {FinanceDB}=require('../../electron/db.cjs');
const {PlanningStore}=require('../../electron/planning.cjs');
const {createPersonalSnapshotFromBackup}=require('../../electron/cloud-personal-snapshot.cjs');

async function snapshot(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-cloud-validator-'));
  const live=path.join(dir,'live.sqlite'),copy=path.join(dir,'copy.sqlite');
  const fin=new FinanceDB(live);
  try{
    new PlanningStore(fin);
    fin.db.prepare("INSERT INTO profiles(profile,initialized_at) VALUES ('real','2026-11-07')").run();
    fin.db.prepare("INSERT INTO categories(name,color,built_in,created_at,emoji,kind) VALUES ('Teste','#ffffff',0,'2026-11-07','💜','expense')").run();
    fin.db.prepare("INSERT INTO category_rules(pattern,match_mode,category,scope,priority,enabled) VALUES ('TESTE','contains','Teste','both',7,1)").run();
    fin.db.prepare("INSERT INTO transactions(profile,id,date,description,kind,amount_cents,category,origin) VALUES ('real','manual-test','2026-11-07','Compra fictícia','expense',3279,'Teste','manual')").run();
    fin.db.prepare("INSERT INTO bank_items(item_id,institution,status) VALUES ('fake-item','FICTÍCIO','UPDATED')").run();
    fin.db.prepare("INSERT INTO bank_accounts(account_id,item_id,name,currency,updated_at) VALUES ('fake-account','fake-item','Conta teste','BRL','2026-11-07')").run();
    fin.db.prepare("INSERT INTO bank_transactions(account_id,external_id,date,description,amount_cents,status,category,updated_at) VALUES ('fake-account','fake-tx','2026-11-07','BANCO ORIGINAL',-3279,'POSTED','Teste','2026-11-07')").run();
    fin.db.prepare("INSERT INTO bank_manual_links(account_id,external_id,manual_id,linked_at) VALUES ('fake-account','fake-tx','manual-test','2026-11-07')").run();
    await fin.backupTo(copy);
    return createPersonalSnapshotFromBackup(copy);
  }finally{fin.close();fs.rmSync(dir,{recursive:true,force:true});}
}
async function sha(value){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function resign(snap){
 // Only test fixtures use this helper; attacker-controlled manifests are
 // never trustworthy without authenticated owner/pairing, still TODO.
 const enc=new TextEncoder();
 let root='',bytes=0,rows=0;
 for(const [table,block] of Object.entries(snap.tables)){
   const lines=block.rows.map(row=>{
     const s=JSON.stringify(row);
     bytes+=enc.encode(s).byteLength;
     rows++;
     return s+'\n';
   }).join('');
   const digest=await sha(lines);
   snap.manifest.byTable[table]={rows:block.rows.length,digest};
   root+=table+':'+block.rows.length+':'+digest+'\n';
 }
 snap.manifest.rows=rows;
 snap.manifest.bytes=bytes;
 snap.manifest.digest=await sha(root);
 return snap;
}
test('Cloudflare validates exact personal snapshot from actual Electron SQLite schema',async()=>{
  const snap=await snapshot();
  const result=await validatePersonalMigrationPackage(snap);
  assert.equal(result.valid,true);
  assert.equal(result.personalTables,17);
  assert.equal(result.personalRecords,snap.manifest.rows);
  assert.equal(result.deferredBankReferences,1);
  assert.equal(result.storedInCloud,false);
  assert.equal(result.cutoverAllowed,false);
  assert.deepEqual(Object.keys(snap.tables),Object.keys(PERSONAL_COLUMNS));
  assert.equal(snap.tables.bank_transactions,undefined,'Bank rows must be obtained from server Pluggy provider');
  assert.equal(snap.tables.transactions.rows[0].amount_cents,3279);
});
test('even checksum-preserving tampering cannot invent a transaction or eliminate a profile',async()=>{
  const snap=await snapshot();
  snap.tables.transactions.rows[0].amount_cents=3.79;
  await resign(snap);
  await assert.rejects(()=>validatePersonalMigrationPackage(snap),/Inteiro inválido/);
  const other=await snapshot();
  other.tables.profiles.rows=[];
  await resign(other);
  await assert.rejects(()=>validatePersonalMigrationPackage(other),/Referência de perfil/);
});
test('rejects tampered manifest, extra credentials, bank rows and duplicate primary keys',async()=>{
  const snap=await snapshot();
  snap.tables.transactions.rows[0].description='Changed without updating digest';
  await assert.rejects(()=>validatePersonalMigrationPackage(snap),/Hash ou contagem divergente/);
  const extra=await snapshot();
  extra.tables.transactions.rows[0].clientSecret='secret-token';
  await resign(extra);
  await assert.rejects(()=>validatePersonalMigrationPackage(extra),/colunas inesperadas/);
  const bank=await snapshot();
  bank.tables.bank_transactions={columns:[],rows:[]};
  await assert.rejects(()=>validatePersonalMigrationPackage(bank),/Tabelas contém colunas inesperadas/);
  const duplicate=await snapshot();
  duplicate.tables.transactions.rows.push({...duplicate.tables.transactions.rows[0]});
  await resign(duplicate);
  await assert.rejects(()=>validatePersonalMigrationPackage(duplicate),/Chave duplicada/);
});
test('bank-linked personal overrides remain deferred until their provider IDs are reconciled',async()=>{
  const snap=await snapshot();
  assert.equal(snap.tables.bank_manual_links.rows.length,1);
  const result=await validatePersonalMigrationPackage(snap);
  assert.equal(result.bankIdsRequireReconciliation,true);
  assert.equal(result.deferredBankReferences,1);
  assert.equal(result.storedInCloud,false);
});

test('D05 v7: all 17 snapshot columns match actual SQLite PRAGMA order; hierarchy IDs and legacy nulls survive',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-v7-transfer-contract-'));
 const file=path.join(dir,'finance.sqlite'),backup=path.join(dir,'backup.sqlite');
 const fin=new FinanceDB(file);
 try{
  new PlanningStore(fin);
  for(const [table,columns] of Object.entries(PERSONAL_COLUMNS)){
   const actual=fin.db.prepare('PRAGMA table_info("'+table+'")').all().map(r=>r.name);
   assert.deepEqual(actual,columns,'Schema mismatch in '+table);
  }
  const parent=fin.db.prepare("SELECT id,name FROM categories WHERE name='Moradia'").get();
  const child=fin.db.prepare('SELECT id FROM subcategories WHERE parent_category_id=? LIMIT 1').get(parent.id);
  assert(child?.id);
  fin.db.prepare("INSERT INTO profiles(profile,initialized_at) VALUES('real','2026-11-07')").run();
  fin.db.prepare('INSERT INTO transactions(profile,id,date,description,kind,amount_cents,category,origin,category_id,subcategory_id) VALUES(?,?,?,?,?,?,?,?,?,?)')
   .run('real','d05-child','2026-11-07','Aluguel simulado','expense',151234,parent.name,'manual',parent.id,child.id);
  fin.db.prepare('INSERT INTO transactions(profile,id,date,description,kind,amount_cents,category,origin) VALUES(?,?,?,?,?,?,?,?)')
   .run('real','legacy-null','2026-11-08','Legado','expense',3700,parent.name,'manual');
  fin.upsertCategory({name:'Custom Sem Ícone',color:'#4489ba',emoji:'✨',kind:'expense'});
  await fin.backupTo(backup);
  const snap=createPersonalSnapshotFromBackup(backup);
  assert.equal(snap.schemaVersion,7);
  assert.deepEqual(snap.tables.transactions.columns,PERSONAL_COLUMNS.transactions);
  assert.equal(snap.tables.transactions.rows.find(r=>r.id==='d05-child').subcategory_id,child.id);
  assert.equal(snap.tables.transactions.rows.find(r=>r.id==='d05-child').category_id,parent.id);
  assert.equal(snap.tables.transactions.rows.find(r=>r.id==='legacy-null').subcategory_id,null);
  assert.equal(snap.tables.transactions.rows.find(r=>r.id==='legacy-null').category_id,null);
  assert.equal(snap.tables.categories.rows.find(r=>r.name==='Custom Sem Ícone').icon_key,null);
  const verified=await validatePersonalMigrationPackage(snap);
  assert.equal(verified.valid,true);
  assert.equal(verified.cutoverAllowed,false);
  assert.equal(verified.storedInCloud,false);
 }finally{fin.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('D05 v7: signed payload with a missing hierarchy column or stale schema version is rejected before import',async()=>{
 const old=await snapshot();
 old.schemaVersion=6;
 await assert.rejects(()=>validatePersonalMigrationPackage(old),/Versão do pacote não reconhecida/);
 const missing=await snapshot();
 missing.tables.transactions.columns=missing.tables.transactions.columns.filter(c=>c!=='subcategory_id');
 await assert.rejects(()=>validatePersonalMigrationPackage(missing),/Colunas divergentes em transactions/);
 const altered=await snapshot();
 delete altered.tables.transactions.rows[0].category_id;
 await resign(altered);
 await assert.rejects(()=>validatePersonalMigrationPackage(altered),/colunas inesperadas/);
 const unknown=await snapshot();
 unknown.tables.transactions.rows[0].category_id='cat:nonexistent';
 await resign(unknown);
 await assert.rejects(()=>validatePersonalMigrationPackage(unknown),/Referência D05 de categoria inexistente/);
 const orphan=await snapshot();
 orphan.tables.transactions.rows[0].subcategory_id='sub:orphan';
 orphan.tables.transactions.rows[0].category_id=null;
 await resign(orphan);
 await assert.rejects(()=>validatePersonalMigrationPackage(orphan),/Referência D05 sem categoria-pai/);
});
