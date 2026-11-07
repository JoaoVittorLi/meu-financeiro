'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {prepareCloudMigration,migrationLocalStatus}=require('../electron/cloud-onboarding.cjs');

const UUID_A='a0bc4fab-8fa0-4da0-96b6-b31fc78c215a';
const UUID_B='bb13f1a3-2dad-4295-8991-7406677cb01e';
const TIME=new Date('2026-11-07T18:45:00.000Z');

test('single-click cloud preparation performs native SQLite backup and 22-table audit without network',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mf-cloud-click-'));
 const live=path.join(folder,'active.sqlite');
 const backups=path.join(folder,'backups');
 const fin=new FinanceDB(live);
 try{
   new PlanningStore(fin);
   fin.db.prepare("INSERT INTO profiles(profile) VALUES ('real')").run();
   fin.db.prepare("INSERT INTO transactions(profile,id,date,description,kind,amount_cents,category,origin) VALUES ('real','sample-manual','2026-11-07','LANÇAMENTO FICTÍCIO','expense',10123,'Moradia','manual')").run();
   assert.deepEqual(migrationLocalStatus(backups),{
     stage:'not_started',cloudConnected:false,financialSyncEnabled:false,
     backupPresent:false,latestBackupAt:null
   });
   const result=await prepareCloudMigration({finance:fin,backupFolder:backups,now:TIME,id:UUID_A});
   assert.equal(result.stage,'prepared_locally');
   assert.equal(result.backupVerified,true);
   assert.equal(result.cloudConnected,false);
   assert.equal(result.financialSyncEnabled,false);
   assert.equal(result.recordsSent,0);
   assert.equal(result.checkedTables,22);
   assert.ok(result.checkedRecords>0);
   assert.equal(result.next,'secure_cloud_pairing_not_yet_available');
   const filenames=fs.readdirSync(backups).filter(name=>name.endsWith('.sqlite'));
   assert.equal(filenames.length,1);
   assert.match(filenames[0],/^antes-da-sincronizacao-2026-11-07-/);
   const backup=new (require('node:sqlite').DatabaseSync)(path.join(backups,filenames[0]),{readOnly:true});
   try{
     const row=backup.prepare('SELECT description,amount_cents FROM transactions WHERE id=?').get('sample-manual');
     assert.deepEqual(row,{description:'LANÇAMENTO FICTÍCIO',amount_cents:10123});
   }finally{backup.close();}
   assert.equal(fin.db.prepare('PRAGMA quick_check').get().quick_check,'ok');
   const status=migrationLocalStatus(backups);
   assert.equal(status.stage,'prepared_locally');
   assert.equal(status.backupPresent,true);
   assert.equal(status.cloudConnected,false);
   const output=JSON.stringify(result);
   assert.doesNotMatch(output,/LANÇAMENTO FICTÍCIO|sample-manual|10123|active.sqlite|[0-9a-f]{64}/);
   await prepareCloudMigration({finance:fin,backupFolder:backups,now:TIME,id:UUID_B});
   assert.equal(fs.readdirSync(backups).filter(name=>name.endsWith('.sqlite')).length,2,'Subsequent clicks preserve previous backup');
   assert.rejects(()=>prepareCloudMigration({finance:fin,backupFolder:backups,now:TIME,id:UUID_B}),/já existe/);
 }finally{fin.close();fs.rmSync(folder,{recursive:true,force:true});}
});

test('single-click cloud preparation refuses incompatible or missing planning schema and never enables cloud',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mf-cloud-incompatible-'));
 const fin=new FinanceDB(':memory:');
 try{
   await assert.rejects(
     ()=>prepareCloudMigration({finance:fin,backupFolder:folder,now:TIME,id:UUID_A}),
     /não passou na conferência/
   );
   assert.equal(migrationLocalStatus(folder).cloudConnected,false);
   assert.equal(migrationLocalStatus(folder).financialSyncEnabled,false);
 }finally{fin.close();fs.rmSync(folder,{recursive:true,force:true});}
});

test('status ignores unrelated backups and never falsely claims cloud activation',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mf-cloud-status-'));
 try{
   fs.writeFileSync(path.join(folder,'meu-financeiro-2026-11-07.sqlite'),'x');
   fs.writeFileSync(path.join(folder,'antes-da-sincronizacao-2026-11-07-invalid.sqlite'),'x');
   assert.equal(migrationLocalStatus(folder).backupPresent,false);
   assert.equal(migrationLocalStatus(folder).stage,'not_started');
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
