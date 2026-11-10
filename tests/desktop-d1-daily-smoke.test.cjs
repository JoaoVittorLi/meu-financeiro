'use strict';
// D1.1: isolated real SQLite integration smoke. No Electron renderer, Pluggy,
// Cloudflare, finance user profile or external credentials are touched.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {automaticBackup,restoreBackup,validateBackupFile}=require('../electron/recovery.cjs');

const ITEM='11111111-1111-4111-8111-111111111111';
const ACCOUNT='22222222-2222-4222-8222-222222222222';
const settings={opening:100000,income:0,fixed:0,existing:0,reserve:0};
const local=label=>({version:5,transactions:[{
  id:'synthetic-'+label,date:'2026-11-10',description:'SYNTHETIC: '+label,
  kind:'expense',amount:1234,category:'Outros',origin:'manual'
}],budgets:{Alimentação:0,Moradia:90000},settings});

test('D1.1 — SQLite isolado preserva perfis, orçamento zero, banco, categorias e planejamento após backup/restore',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d1-daily-'));
 const active=path.join(root,'finance.sqlite');
 const folder=path.join(root,'backups');
 let db;
 try{
  db=new FinanceDB(active);
  db.save('real',local('real'));
  db.save('demo',{...local('demo'),budgets:{Lazer:12000},settings});
  db.upsertCategory({name:'Pets',color:'#aabbcc',emoji:'🐾'});
  db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{
    account:{id:ACCOUNT,name:'SYNTHETIC: banco',balance:1500,type:'BANK',currencyCode:'BRL'},
    transactions:[{id:'posted',date:'2026-11-10',
      description:'SYNTHETIC: gasto bancário',amount:-12.34,
      status:'POSTED',category:'Groceries'}]
  }]});
  db.overrideBankCategory({accountId:ACCOUNT,externalId:'posted',category:'Pets'});
  const planner=new PlanningStore(db);
  const plannedId=planner.create({title:'SYNTHETIC: aluguel',kind:'expense',
    amount:90000,dueDate:'2026-11-20',category:'Moradia',certainty:'confirmed'}).ids[0];
  const saved=await automaticBackup(db,folder,{now:new Date('2026-11-10T12:00:00.000Z')});
  assert.equal(saved.created,true);
  assert.equal(validateBackupFile(saved.file).ok,true);
  db.close();db=null;

  db=new FinanceDB(active);
  const reopenedPlan=new PlanningStore(db);
  assert.equal(db.load('real').transactions[0].id,'synthetic-real');
  assert.equal(db.load('demo').transactions[0].id,'synthetic-demo');
  assert.equal(db.load('real').budgets.Alimentação,0);
  assert.equal(db.load('demo').budgets.Lazer,12000);
  assert.equal(db.listCategories().categories.find(x=>x.name==='Pets').emoji,'🐾');
  assert.equal(reopenedPlan.list({today:'2026-11-10'}).find(x=>x.id===plannedId).amount,90000);
  assert.equal(db.bankOverview().transactions.find(x=>x.id==='posted').category,'Pets');

  db.save('real',local('edited'));
  assert.equal(db.load('real').transactions[0].id,'synthetic-edited');
  const recovered=await restoreBackup(db,saved.file,active,folder);
  db=recovered.db;
  const restoredPlan=new PlanningStore(db);
  assert.equal(db.load('real').transactions[0].id,'synthetic-real');
  assert.equal(db.load('demo').transactions[0].id,'synthetic-demo');
  assert.equal(db.load('real').budgets.Alimentação,0);
  assert.equal(restoredPlan.list({today:'2026-11-10'}).find(x=>x.id===plannedId).amount,90000);
  assert.equal(db.bankOverview().transactions.find(x=>x.id==='posted').category,'Pets');
  assert.equal(validateBackupFile(recovered.recovery).ok,true);
  assert.deepEqual(db.integrity(),['ok']);
 }finally{
  if(db)db.close();
  fs.rmSync(root,{recursive:true,force:true});
 }
});
