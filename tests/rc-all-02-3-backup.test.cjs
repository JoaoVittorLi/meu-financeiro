'use strict';
// RC-ALL-02.3 — real SQLite/WAL regression with exclusively synthetic data.
// Does not touch the user's Windows profile, accounts, Pluggy or cloud.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {stablePreMigrationBackup}=require('../electron/release-channel.cjs');
const VERSION='0.9.5-beta.8';
async function sandbox(fn){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-rc23-synthetic-'));
 try{return await fn(root)}finally{fs.rmSync(root,{recursive:true,force:true});}
}
function seed(file){
 const db=new DatabaseSync(file);
 try{
  db.exec("CREATE TABLE profiles (id TEXT PRIMARY KEY);"+
   "INSERT INTO profiles VALUES ('synthetic-only');"+
   "CREATE TABLE bank_transactions (id TEXT PRIMARY KEY, amount_cents INTEGER NOT NULL);"+
   "CREATE TABLE budgets (category TEXT PRIMARY KEY, amount_cents INTEGER NOT NULL);"+
   "INSERT INTO budgets VALUES ('Alimentacao', 0);"+
   "CREATE TABLE planned_items (id TEXT PRIMARY KEY, amount_cents INTEGER NOT NULL);"+
   "INSERT INTO planned_items VALUES ('plan-1', 7350);");
  const insert=db.prepare('INSERT INTO bank_transactions VALUES (?,?)');
  db.exec('BEGIN');
  try{
   for(let i=0;i<600;i++)insert.run('tx-'+i,-1234-i);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }finally{db.close();}
}
function snapshotState(file){
 const db=new DatabaseSync(file,{readOnly:true});
 try{
  const rows=db.prepare('SELECT COUNT(*) AS n, SUM(amount_cents) AS cents FROM bank_transactions').get();
  const budget=db.prepare("SELECT amount_cents AS cents FROM budgets WHERE category='Alimentacao'").get();
  const planned=db.prepare('SELECT COUNT(*) AS n, SUM(amount_cents) AS cents FROM planned_items').get();
  const wal=db.prepare("SELECT 1 AS found FROM sqlite_master WHERE type='table' AND name='qa_wal_marker'").get();
  const marker=wal?db.prepare("SELECT value FROM qa_wal_marker WHERE id=1").get():null;
  return {transactions:rows.n,transactionCents:rows.cents,budgetCents:budget.cents,
   planned:planned.n,planCents:planned.cents,walMarker:marker?.value||null};
 }finally{db.close();}
}
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const backupFiles=root=>fs.readdirSync(path.join(root,'copias-de-seguranca')).filter(
 name=>name.endsWith('.sqlite')&&name.startsWith('pre-upgrade-'+VERSION));
test('RC2.3 unchanged same-version startup reuses verified snapshot without duplicate',()=>sandbox(async root=>{
 const file=path.join(root,'meu-financeiro.sqlite');seed(file);
 const first=await stablePreMigrationBackup(root,VERSION);
 assert.equal(first.existing,true);
 assert.equal(path.basename(first.backup),'pre-upgrade-'+VERSION+'.sqlite');
 assert.deepEqual(snapshotState(first.backup),snapshotState(file));
 const repeat=await stablePreMigrationBackup(root,VERSION);
 assert.equal(repeat.backup,first.backup);
 assert.deepEqual(backupFiles(root),[path.basename(first.backup)]);
 assert.equal(fs.existsSync(first.backup+'.partial'),false);
}));
test('RC2.3 changed financial rows and uncheckpointed WAL create new immutable same-version backup',()=>sandbox(async root=>{
 const file=path.join(root,'meu-financeiro.sqlite');seed(file);
 const vault=path.join(root,'pluggy-credentials.enc');
 fs.writeFileSync(vault,'SYNTHETIC-VAULT-NOT-A-CREDENTIAL');
 const initial=await stablePreMigrationBackup(root,VERSION);
 const initialState=snapshotState(initial.backup);
 const initialHash=digest(initial.backup);
 assert.equal(initialState.transactions,600);
 assert.equal(initialState.budgetCents,0);
 assert.equal(initialState.planned,1);
 const writer=new DatabaseSync(file);
 try{
  const mode=writer.prepare('PRAGMA journal_mode=WAL').get();
  assert.equal(mode.journal_mode,'wal');
  writer.prepare('INSERT INTO bank_transactions VALUES (?,?)').run('tx-600',-98500);
  writer.prepare("UPDATE budgets SET amount_cents=12345 WHERE category='Alimentacao'").run();
  writer.prepare('INSERT INTO planned_items VALUES (?,?)').run('plan-2',9999);
  writer.exec("CREATE TABLE qa_wal_marker (id INTEGER PRIMARY KEY,value TEXT NOT NULL)");
  writer.prepare('INSERT INTO qa_wal_marker VALUES (?,?)').run(1,'WAL-UNFLUSHED');
  assert.equal(fs.existsSync(file+'-wal'),true,'Source must have active WAL');
  const beforeSecond=snapshotState(file);
  assert.equal(beforeSecond.transactions,601);
  const second=await stablePreMigrationBackup(root,VERSION);
  assert.notEqual(second.backup,initial.backup);
  assert.match(path.basename(second.backup),/^pre-upgrade-0\.9\.5-beta\.8-[0-9a-f-]{36}\.sqlite$/i);
  assert.deepEqual(snapshotState(second.backup),beforeSecond);
  assert.deepEqual(snapshotState(initial.backup),initialState,'Original snapshot immutable');
  assert.equal(digest(initial.backup),initialHash);
  assert.equal(fs.readFileSync(vault,'utf8'),'SYNTHETIC-VAULT-NOT-A-CREDENTIAL');
  const unchanged=await stablePreMigrationBackup(root,VERSION);
  assert.equal(unchanged.backup,second.backup,'Identical same-version SQLite state must reuse latest snapshot');
  writer.prepare('INSERT INTO bank_transactions VALUES (?,?)').run('tx-601',-4555);
  writer.prepare("UPDATE budgets SET amount_cents=0 WHERE category='Alimentacao'").run();
  const third=await stablePreMigrationBackup(root,VERSION);
  assert.notEqual(third.backup,second.backup);
  assert.notEqual(third.backup,initial.backup);
  assert.equal(snapshotState(third.backup).transactions,602);
  assert.equal(snapshotState(third.backup).budgetCents,0);
  assert.deepEqual(snapshotState(second.backup),beforeSecond,'Second snapshot immutable');
  assert.equal(digest(initial.backup),initialHash,'First snapshot immutable after third run');
  assert.equal(backupFiles(root).length,3,'No snapshot overwritten or proliferated on identical retries');
 }finally{writer.close();}
}));
test('RC2.3 invalid previous snapshot blocks migration and preserves source SQLite',()=>sandbox(async root=>{
 const file=path.join(root,'meu-financeiro.sqlite');seed(file);
 const first=await stablePreMigrationBackup(root,VERSION);
 const before=snapshotState(file);
 fs.writeFileSync(first.backup,'CORRUPTED-ARCHIVE');
 await assert.rejects(stablePreMigrationBackup(root,VERSION));
 assert.deepEqual(snapshotState(file),before);
 assert.equal(fs.readFileSync(first.backup,'utf8'),'CORRUPTED-ARCHIVE');
 assert.equal(fs.existsSync(first.backup+'.partial'),false);
}));
test('RC2.3 symlinked UUID archive blocks snapshot reuse without altering current bank',()=>sandbox(async root=>{
 const file=path.join(root,'meu-financeiro.sqlite');seed(file);
 const first=await stablePreMigrationBackup(root,VERSION);
 const before=snapshotState(file);
 const linked=path.join(root,'copias-de-seguranca','pre-upgrade-'+VERSION+'-'+randomUUID()+'.sqlite');
 try{fs.symlinkSync(first.backup,linked,'file');}
 catch(error){
  if(process.platform==='win32'&&error?.code==='EPERM')return;
  throw error;
 }
 await assert.rejects(stablePreMigrationBackup(root,VERSION),/Backup existente inválido/);
 assert.deepEqual(snapshotState(file),before);
 assert.equal(fs.existsSync(first.backup+'.partial'),false);
}));
test('RC2.3 existing partial backup refuses continuation without modifying source',()=>sandbox(async root=>{
 const file=path.join(root,'meu-financeiro.sqlite');seed(file);
 const first=await stablePreMigrationBackup(root,VERSION);
 const before=snapshotState(file);
 fs.writeFileSync(first.backup+'.partial','INCOMPLETE-FROM-PRIOR-ATTEMPT');
 await assert.rejects(stablePreMigrationBackup(root,VERSION),/Backup parcial anterior/);
 assert.deepEqual(snapshotState(file),before);
 assert.equal(fs.readFileSync(first.backup+'.partial','utf8'),'INCOMPLETE-FROM-PRIOR-ATTEMPT');
}));
