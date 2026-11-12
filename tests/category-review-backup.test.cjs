'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs'),{CategoryReviewService,READ_CONSENT,WRITE_CONSENT}=require('../electron/category-review.cjs');
const {CategoryReviewBackupGate}=require('../electron/category-review-backup.cjs'),{seedQ1,ACCOUNT}=require('../scripts/q1-fixture.cjs');
const {validateBackupFile,restoreBackup}=require('../electron/recovery.cjs');
async function fixture(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-review-backup-'));seedQ1(dir);
 const filename=path.join(dir,'meu-financeiro.sqlite');let db=new FinanceDB(filename);
 try{
  const service=new CategoryReviewService(db,{syntheticProfile:true}),grant=service.authorize({consent:READ_CONSENT},1);
  const p=service.prepare({token:grant.token,action:'classify',payload:{items:[service.publicRow(service.row({accountId:ACCOUNT,externalId:'cafe-4'}))],category:'Alimentação'}},1);
  const input={token:grant.token,id:p.id,digest:p.digest,consent:WRITE_CONSENT},folder=path.join(dir,'review-backups'),gate=new CategoryReviewBackupGate(service,folder,{syntheticProfile:true});
  await fn({db,service,gate,input,folder,dir,filename,setDb:value=>db=value});
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
}
test('backup gate refuses personal profiles before touching service or disk',()=>{
 assert.throws(()=>new CategoryReviewBackupGate(null,'unused'),/sintético/);
});
test('verified backup precedes write, survives restart and restores exact pre-action state',()=>fixture(async f=>{
 const receipt=await f.gate.confirm(f.input,1);assert.equal(receipt.backup.verified,true);
 const files=fs.readdirSync(f.folder).filter(n=>n.endsWith('.sqlite'));assert.equal(files.length,1);
 const backup=path.join(f.folder,files[0]);assert.equal(validateBackupFile(backup).bytes,receipt.backup.bytes);
 assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='cafe-4').category,'Alimentação');
 const reopened=new FinanceDB(backup);try{assert.equal(reopened.bankOverview().transactions.find(t=>t.id==='cafe-4').category,'Outros');assert.equal(reopened.db.prepare('SELECT COUNT(*) n FROM category_review_commands').get().n,0);}finally{reopened.close();}
 const restored=await restoreBackup(f.db,backup,f.filename,path.join(f.dir,'rescue'));f.setDb(restored.db);
 assert.deepEqual(restored.db.integrity(),['ok']);assert.equal(restored.db.bankOverview().transactions.find(t=>t.id==='cafe-4').category,'Outros');
}));
test('failed backup and invalid consent cannot write or create an audit command',()=>fixture(async f=>{
 f.db.backupTo=async()=>{throw Error('Disco indisponível');};
 await assert.rejects(f.gate.confirm({...f.input,consent:'wrong'},1),/explicitamente/);
 await assert.rejects(f.gate.confirm(f.input,1),/não aplicada.*Disco/);
 assert.equal(f.db.db.prepare('SELECT COUNT(*) n FROM category_review_commands').get().n,0);
 assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='cafe-4').category,'Outros');
}));
test('concurrent double confirmation produces one verified backup and one command; replay creates none',()=>fixture(async f=>{
 const results=await Promise.all([f.gate.confirm(f.input,1),f.gate.confirm(f.input,1)]);
 assert.equal(results[0].id,results[1].id);assert.equal(f.db.db.prepare('SELECT COUNT(*) n FROM category_review_commands').get().n,1);
 assert.equal((await f.gate.confirm(f.input,1)).replayed,true);
 assert.equal(fs.readdirSync(f.folder).filter(n=>n.endsWith('.sqlite')).length,1);
 await assert.rejects(f.gate.confirm({...f.input,digest:'bad'},1),/inválida/);
}));
test('a change during asynchronous backup invalidates the preview and preserves the manual correction',()=>fixture(async f=>{
 const backup=f.db.backupTo.bind(f.db);f.db.backupTo=async file=>{await backup(file);f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'cafe-4',category:'Transporte'});};
 await assert.rejects(f.gate.confirm(f.input,1),/desatualizada/);
 assert.equal(f.db.db.prepare('SELECT COUNT(*) n FROM category_review_commands').get().n,0);
 assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='cafe-4').category,'Transporte');
}));
test('SQLite failure rolls back labels and audit while preserving verified rescue backup',()=>fixture(async f=>{
 f.db.db.exec("CREATE TRIGGER fail_q1 BEFORE INSERT ON category_review_commands BEGIN SELECT RAISE(ABORT,'Q1 rollback'); END");
 await assert.rejects(f.gate.confirm(f.input,1),/Q1 rollback/);
 assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='cafe-4').category,'Outros');
 assert.equal(f.db.db.prepare('SELECT COUNT(*) n FROM category_review_applied_labels').get().n,0);
 assert.equal(fs.readdirSync(f.folder).filter(n=>n.endsWith('.sqlite')).length,1);
}));
