'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {FinanceDB}=require('../electron/db.cjs'),{PlanningStore}=require('../electron/planning.cjs');
const {LocalFinancialIntelligence}=require('../electron/financial-intelligence.cjs'),{CategoryReviewService}=require('../electron/category-review.cjs'),{CategoryReviewBackupGate}=require('../electron/category-review-backup.cjs');
const {restoreBackup}=require('../electron/recovery.cjs'),{seedQ1}=require('../scripts/q1-fixture.cjs');
for(const synthetic of [false,true])for(const recovered of [false,true])test('restored SQLite rebinds intelligence and invalidates old grants; synthetic='+synthetic+', recovered='+recovered,async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-recovery-service-'));seedQ1(dir);
 const file=path.join(dir,'meu-financeiro.sqlite');let db=new FinanceDB(file);
 try{
  if(!synthetic)db.db.exec('DROP TABLE IF EXISTS category_review_applied_labels; DROP TABLE IF EXISTS category_rule_constraints; DROP TABLE IF EXISTS category_review_decisions; DROP TABLE IF EXISTS category_review_commands');
  const source=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8'),start=source.indexOf(' let localFinancial,categoryReview,reviewBackupGate;'),end=source.indexOf(" ipcMain.handle('finance:review-status'",start);
  assert(start>0&&end>start);
  const c=vm.createContext({db,planner:new PlanningStore(db),LocalFinancialIntelligence,CategoryReviewService,CategoryReviewBackupGate,IntelligenceOperational:require('../electron/intelligence-operational.cjs').IntelligenceOperational,smokeProfileActive:synthetic,path,app:{getPath:()=>dir}});
  vm.runInContext(source.slice(start,end)+';this.services=()=>({localFinancial,categoryReview,reviewBackupGate,operationalIntelligence});this.rebind=bindLocalFinancialServices;',c);
  const before=c.services(),read=before.localFinancial.authorize({consent:'LOCAL_FINANCIAL_READ_V1',source:'bank',profile:'real',planning:true},1);
  const oldReview=synthetic?before.categoryReview.authorize({consent:'SYNTHETIC_CATEGORY_REVIEW_V1'},1):null;
  const backup=path.join(dir,'snapshot.sqlite');await db.backupTo(backup);
  let handler,reloads=0;
  Object.assign(c,{fs,PlanningStore,filename:file,restoring:false,syncing:false,autoBackupBusy:false,cloudPreparationBusy:false,
   ipcMain:{handle:(_name,fn)=>handler=fn},requireAppSender:()=>{},
   dialog:{showOpenDialog:async()=>({filePaths:[backup]}),showMessageBox:async()=>({response:1})},
   backupsDirectory:()=>path.join(dir,'rescue'),restoreBackup:async(...args)=>{const result=await restoreBackup(...args);if(recovered)throw Object.assign(Error('Synthetic recovered failure'),{recoveredDb:result.db});return result;},validateBackupFile:require('../electron/recovery.cjs').validateBackupFile,
   markerFile:()=>path.join(dir,'synthetic-marker.json'),mainWindow:{webContents:{reload:()=>reloads++}}});
  const restoreStart=source.indexOf(" ipcMain.handle('finance:restore'"),restoreEnd=source.indexOf('\n function titledBankData',restoreStart);
  vm.runInContext(source.slice(restoreStart,restoreEnd),c);
  if(synthetic){before.reviewBackupGate.pending.set('in-flight',Promise.resolve());await assert.rejects(handler({sender:{id:1}}),/Conclua/);before.reviewBackupGate.pending.clear();}
  if(recovered)await assert.rejects(handler({sender:{id:1}}),/Synthetic recovered failure/);else await handler({sender:{id:1}});
  db=c.db;assert.equal(reloads,recovered?0:1);
  const after=c.services();assert.notEqual(after.operationalIntelligence,before.operationalIntelligence);assert.equal(after.operationalIntelligence.db,db);const stale=after.operationalIntelligence.overview({month:'2026-11',token:read.token},1);assert(stale.cards.some(r=>r.uiState==='denied'||r.uiState==='expired'));const newGrant=after.localFinancial.authorize({consent:'LOCAL_FINANCIAL_READ_V1',source:'bank',profile:'real',planning:true},1);assert.equal(after.operationalIntelligence.overview({month:'2026-11',token:newGrant.token},1).cards.length,8);assert.doesNotThrow(()=>after.operationalIntelligence.ask({month:'2026-11',token:newGrant.token,question:'Mostre meu radar'},1));assert.notEqual(after.localFinancial,before.localFinancial);
  assert.throws(()=>after.localFinancial.query({token:read.token,intent:'radar',month:'2026-11'},1),/Autorização/);
  const fresh=after.localFinancial.authorize({consent:'LOCAL_FINANCIAL_READ_V1',source:'bank',profile:'real',planning:true},1);
  assert.doesNotThrow(()=>after.localFinancial.query({token:fresh.token,intent:'radar',month:'2026-11'},1));
  if(synthetic){assert.throws(()=>after.categoryReview.list({token:oldReview.token},1),/Autorização/);const g=after.categoryReview.authorize({consent:'SYNTHETIC_CATEGORY_REVIEW_V1'},1);assert.equal(after.categoryReview.list({token:g.token},1).scanned,77);assert.equal(after.reviewBackupGate.service.finance,db);}
  else{assert.equal(after.categoryReview,null);assert.equal(after.reviewBackupGate,null);assert.equal(db.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'category_review_%'").get().n,0);}
  const endpoints=new Map();c.ipcMain={handle:(name,fn)=>endpoints.set(name,fn)};
  const epStart=source.indexOf(" ipcMain.handle('intelligence:operational-overview'"),epEnd=source.indexOf('\n vault=',epStart);
  vm.runInContext(source.slice(epStart,epEnd),c);
  const grant=after.localFinancial.authorize({consent:'LOCAL_FINANCIAL_READ_V1',source:'bank',profile:'real',planning:true},1),event={sender:{id:1}};
  assert.equal(endpoints.get('intelligence:operational-overview')(event,{month:'2026-11',token:grant.token}).cards.length,8);
  assert.equal(endpoints.get('intelligence:operational-ask')(event,{month:'2026-11',token:grant.token,question:'Quanto gastei?'}).changesApplied,false);
  assert.notEqual(endpoints.get('intelligence:operational-ask')(event,{month:'2026-11',token:read.token,question:'Quanto gastei?'}).uiState,'ready');
  assert.deepEqual(db.integrity(),['ok']);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
