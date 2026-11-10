'use strict';
// D1.2 — these tests run real node:sqlite with invented values in a new tmpdir.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {automaticBackup,validateBackupFile,restoreBackup}=require('../electron/recovery.cjs');
const ITEM='11111111-1111-4111-8111-111111111111';
const ACCOUNT='22222222-2222-4222-8222-222222222222';
const SETTINGS={opening:0,income:0,fixed:0,existing:0,reserve:0};
const manual=(id,amount=1234,desc='SYNTHETIC COMPRA')=>({
 id,date:'2026-11-10',description:desc,kind:'expense',amount,
 category:'Outros',origin:'manual'
});
const payload=(transactions=[],budgets={})=>({version:5,transactions,budgets,settings:{...SETTINGS}});
function isolated(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d1-2-fictitious-'));
 return {dir,file:path.join(dir,'desktop.sqlite'),backups:path.join(dir,'backups')};
}
function fakeBank(balance=null){
 return {item:{status:'UPDATED'},data:[{
  account:{id:ACCOUNT,name:'SYNTHETIC ACCOUNT',balance,type:'BANK',currencyCode:'BRL'},
  transactions:[
   {id:'bank-manual',date:'2026-11-10',description:'SYNTHETIC COMPRA',amount:-12.34,status:'POSTED',category:'Groceries'},
   {id:'bank-plan',date:'2026-11-10',description:'SYNTHETIC CONTA',amount:-50,status:'POSTED',category:'Utilities'}
  ]
 }]};
}
test('D1.2 — limite explícito R$0 impede exclusão de categoria e persiste após reiniciar',()=>{
 const f=isolated();let db;
 try{
  db=new FinanceDB(f.file);
  db.upsertCategory({name:'Reserva zero',color:'#aabbcc',emoji:'🎯'});
  db.save('real',payload([],{ 'Reserva zero':0 }));
  assert.equal(db.load('real').budgets['Reserva zero'],0);
  assert.throws(()=>db.deleteCategory('Reserva zero'),/Categoria em uso/);
  assert.equal(db.listCategories().categories.some(c=>c.name==='Reserva zero'),true);
  db.close();db=new FinanceDB(f.file);
  assert.equal(db.load('real').budgets['Reserva zero'],0);
  assert.throws(()=>db.deleteCategory('Reserva zero'),/Categoria em uso/);
  db.save('real',payload());
  assert.equal(db.deleteCategory('Reserva zero').categories.some(c=>c.name==='Reserva zero'),false);
  assert.equal(Object.hasOwn(db.load('real').budgets,'Reserva zero'),false);
  assert.deepEqual(db.integrity(),['ok']);
 }finally{if(db)db.close();fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('D1.2 — edição manual, vínculo, saldo desconhecido e sync idempotente sobrevivem a reinício',()=>{
 const f=isolated();let db;
 try{
  db=new FinanceDB(f.file);
  db.save('real',payload([manual('m1')],{Alimentação:0}));
  db.save('demo',payload([manual('demo-only')],{Lazer:24000}));
  db.ingestBank(ITEM,fakeBank());
  db.ingestBank(ITEM,fakeBank());
  assert.equal(db.bankOverview().accounts.find(a=>a.id===ACCOUNT).balance,null);
  assert.equal(db.bankOverview().totalTransactions,2);
  assert.equal(db.bankOverview().transactions.length,2);
  db.linkManualTransaction({accountId:ACCOUNT,externalId:'bank-manual',manualId:'m1'});
  db.editBankTransaction({accountId:ACCOUNT,externalId:'bank-manual',
    merchant:'SYNTHETIC STORE',note:'Synthetic review',nature:'expense',reviewed:true});
  const updated=payload([manual('m1',1234,'SYNTHETIC COMPRA EDITADA')],{Alimentação:0});
  db.save('real',updated);
  db.close();db=new FinanceDB(f.file);
  assert.equal(db.load('real').transactions[0].description,'SYNTHETIC COMPRA EDITADA');
  assert.equal(db.load('demo').transactions[0].id,'demo-only');
  assert.equal(db.load('real').budgets.Alimentação,0);
  const bank=db.bankOverview().transactions.find(t=>t.id==='bank-manual');
  assert.equal(bank.linkedManualId,'m1');
  assert.equal(bank.merchant,'SYNTHETIC STORE');
  assert.equal(bank.reviewed,true);
  assert.equal(db.bankOverview().accounts[0].balance,null);
  assert.equal(db.bankOverview().totalTransactions,2);
  assert.deepEqual(db.integrity(),['ok']);
 }finally{if(db)db.close();fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('D1.2 — parcelas editadas, backup/restore e rejeição de backup inválido preservam histórico',async()=>{
 const f=isolated();let db;
 try{
  db=new FinanceDB(f.file);
  db.save('real',payload([manual('original')],{Moradia:70000}));
  db.ingestBank(ITEM,fakeBank(null));
  const plan=new PlanningStore(db);
  const recurring=plan.create({title:'SYNTHETIC PARCELAS',kind:'expense',amount:10001,
    dueDate:'2026-11-20',category:'Compras',certainty:'confirmed',mode:'installments',count:3}).ids;
  assert.equal(recurring.length,3);
  assert.equal(plan.list({today:'2026-11-10'}).filter(x=>recurring.includes(x.id)).reduce((s,x)=>s+x.amount,0),10001);
  plan.edit({id:recurring[1],title:'SYNTHETIC PARCELA ALTERADA'});
  const obligation=plan.create({title:'SYNTHETIC COMPROMISSO',kind:'expense',amount:5000,
    dueDate:'2026-11-12',category:'Contas'}).ids[0];
  plan.link({itemId:obligation,accountId:ACCOUNT,externalId:'bank-plan'});
  assert.equal(plan.list({today:'2026-11-10'}).find(x=>x.id===obligation).effectiveStatus,'paid');
  const saved=await automaticBackup(db,f.backups,{now:new Date('2026-11-10T10:00:00Z')});
  assert.equal(saved.created,true);
  assert.equal(validateBackupFile(saved.file).ok,true);
  const corrupted=path.join(f.dir,'fake.sqlite');fs.writeFileSync(corrupted,'NOT SQLITE');
  await assert.rejects(()=>restoreBackup(db,corrupted,f.file,f.backups));
  assert.equal(db.load('real').transactions[0].id,'original');
  db.save('real',payload([manual('later')]));
  const restored=await restoreBackup(db,saved.file,f.file,f.backups);db=restored.db;
  const after=new PlanningStore(db),rows=after.list({today:'2026-11-10'});
  assert.equal(db.load('real').transactions[0].id,'original');
  assert.equal(db.load('real').budgets.Moradia,70000);
  assert.equal(rows.find(x=>x.id===recurring[1]).title,'SYNTHETIC PARCELA ALTERADA');
  assert.equal(rows.find(x=>x.id===obligation).effectiveStatus,'paid');
  assert.equal(validateBackupFile(restored.recovery).ok,true);
  assert.deepEqual(db.integrity(),['ok']);
 }finally{if(db)db.close();fs.rmSync(f.dir,{recursive:true,force:true});}
});