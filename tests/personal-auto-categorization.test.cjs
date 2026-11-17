'use strict';
// 100% synthetic; never use any personal Pluggy, Electron userData or external LLM.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {D05CategoryService}=require('../electron/d05-category-service.cjs');
const {PersonalAutoCategorizer,merchant,snapshot,CONTRACT}=require('../electron/personal-auto-categorizer.cjs');
const ACCOUNT='22222222-2222-4222-8222-222222222222';
const OTHER='44444444-4444-4444-8444-444444444444';
function sandbox(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf1-auto-synthetic-'));return Promise.resolve().then(()=>fn(dir)).finally(()=>fs.rmSync(dir,{recursive:true,force:true}));}
function transactions(n=620,prefix='tx'){
 return Array.from({length:n},(_,i)=>({
  id:prefix+'-'+i,date:'2026-11-'+String(i%27+1).padStart(2,'0'),
  description:i===615?'COMPRA SEM HISTORICO': 'MERCADO VILA LOJA '+(i%9),
  amount:-(15.01+i%10),status:i===609?'PENDING':'POSTED',category:'Other'
 }));
}
function make(dir,{second=false}={}){
 const file=path.join(dir,'finance.sqlite'),finance=new FinanceDB(file),rows=transactions();
 const data=[{account:{id:ACCOUNT,name:'CONTA FICTICIA',type:'CHECKING',balance:100},transactions:rows}];
 if(second)data.push({account:{id:OTHER,name:'OUTRA CONTA FICTICIA',type:'CHECKING',balance:100},transactions:transactions(40,'other')});
 finance.ingestBank('11111111-1111-4111-8111-111111111111',{item:{status:'UPDATED'},data});
 const d05=new D05CategoryService(finance),parent=d05.listCatalog().parents.find(p=>p.name==='Alimentação');
 assert(parent,'D05 food parent missing');
 const sub=parent.subcategories.find(s=>/supermercad|mercado/i.test(s.name))||parent.subcategories[0];
 assert(sub,'D05 child required');
 const target={categoryId:parent.id,subcategoryId:sub.id};
 finance.db.prepare('INSERT INTO merchant_aliases(pattern,display_name) VALUES (?,?)').run('MERCADO VILA','MERCADO VILA');
 for(const i of [0,1,2])d05.assignBank({accountId:ACCOUNT,externalId:'tx-'+i,target});
 return {finance,rows,target,dir};
}
function service(f,dir){return new PersonalAutoCategorizer({finance:()=>f,backupDirectory:()=>path.join(dir,'verified-auto-backups'),allowed:()=>true});}
test('MF1 auto: 620 synthetic movements, 3-day manual consensus and D05 parent/child receipt',()=>sandbox(async dir=>{
 const {finance,target}=make(dir);try{
  const auto=service(finance,dir);
  assert.equal(auto.status().enabled.length,0);
  assert.equal(auto.status().usesLLM,false);
  assert.equal(auto.status().contract,CONTRACT);
  auto.consent({accountIds:[ACCOUNT],enabled:true});
  const outcome=await auto.run();
  assert.equal(outcome.status,'completed');
  assert(outcome.applied>500&&outcome.applied<620);
  assert(outcome.review>=1);
  const row=finance.bankOverview().transactions.find(x=>x.id==='tx-10');
  assert.equal(row.categorySource,'auto');
  const bank=new D05CategoryService(finance).bankView({accountId:ACCOUNT});
  const labeled=bank.items.find(x=>x.id==='tx-10');
  assert.equal(labeled.categoryId,target.categoryId);
  assert.equal(labeled.subcategoryId,target.subcategoryId);
  assert.equal(finance.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_receipt_items WHERE receipt_id=?').get(outcome.receiptId).n,outcome.applied);
  const audit=finance.db.prepare('SELECT before_category,after_category_id,after_subcategory_id FROM mf_auto_receipt_items WHERE receipt_id=? LIMIT 1').get(outcome.receiptId);
  assert.equal(audit.before_category,'Other','Preserve the prior provider classification');
  assert.equal(audit.after_category_id,target.categoryId);
  assert.equal(audit.after_subcategory_id,target.subcategoryId);
  assert.equal(finance.db.prepare('SELECT status FROM bank_transactions WHERE account_id=? AND external_id=?').get(ACCOUNT,'tx-10').status,'POSTED');

  assert.equal(finance.db.prepare('PRAGMA foreign_key_check').all().length,0);
  assert(fs.readdirSync(path.join(dir,'verified-auto-backups')).some(n=>n.endsWith('.sqlite')));
 }finally{finance.close();}
}));
test('MF1 auto: opt-in is account scoped and disabled by default',()=>sandbox(async dir=>{
 const {finance}=make(dir,{second:true});try{
  const auto=service(finance,dir);
  assert.deepEqual((await auto.run()).status,'disabled');
  assert.throws(()=>auto.consent({accountIds:['not-a-real-account'],enabled:true}));
  auto.consent({accountIds:[ACCOUNT],enabled:true});
  await auto.run();
  assert.equal(finance.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels WHERE account_id=?').get(OTHER).n,0);
  assert.equal(auto.status().enabled.includes(OTHER),false);
  auto.consent({accountIds:[ACCOUNT],enabled:false});
  assert.equal((await auto.run()).status,'disabled');
  assert.equal(auto.status().enabled.length,0);
 }finally{finance.close();}
}));
test('MF1 auto: PENDING, transfer, ignore, splits, reviewed and linked rows never auto-apply',()=>sandbox(async dir=>{
 const {finance,target}=make(dir);try{
  const sql=finance.db,d05=new D05CategoryService(finance);
  sql.prepare('INSERT INTO bank_transaction_notes(account_id,external_id,nature) VALUES (?,?,?)').run(ACCOUNT,'tx-610','transfer');
  sql.prepare('INSERT INTO bank_transaction_notes(account_id,external_id,nature) VALUES (?,?,?)').run(ACCOUNT,'tx-611','ignore');
  sql.prepare('INSERT INTO bank_transaction_splits(account_id,external_id,position,category,amount_cents,category_id,subcategory_id) VALUES (?,?,?,?,?,?,?)').run(ACCOUNT,'tx-612',0,'Alimentação',1501,target.categoryId,target.subcategoryId);
  sql.prepare('INSERT INTO bank_transaction_notes(account_id,external_id,nature,reviewed_at) VALUES (?,?,?,?)').run(ACCOUNT,'tx-613','auto',new Date().toISOString());
  sql.prepare('INSERT INTO bank_transaction_notes(account_id,external_id,nature,merchant) VALUES (?,?,?,?)').run(ACCOUNT,'tx-614','auto','Manual merchant');
  const auto=service(finance,dir);auto.consent({accountIds:[ACCOUNT],enabled:true});
  await auto.run();
  for(const n of [609,610,611,612,613,614,615]){
   assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT,'tx-'+n).n,0);
  }
 }finally{finance.close();}
}));
test('MF1 auto: manual D05 correction remains stronger, rule remains stronger, and repeated sync is idempotent',()=>sandbox(async dir=>{
 const {finance,rows,target}=make(dir);try{
  const auto=service(finance,dir);auto.consent({accountIds:[ACCOUNT],enabled:true});
  const first=await auto.run();
  new D05CategoryService(finance).assignBank({accountId:ACCOUNT,externalId:'tx-10',target});
  assert.equal(finance.bankOverview().transactions.find(x=>x.id==='tx-10').categorySource,'manual');
  finance.db.prepare("INSERT INTO category_rules(pattern,match_mode,category,scope,priority,enabled,category_id,subcategory_id) VALUES (?, 'exact', ?, 'bank', 1, 1, ?, NULL)").run('MERCADO VILA LOJA 4','Outros','cat:outros');
  const ruled=finance.bankOverview().transactions.find(x=>x.id==='tx-4');
  assert.equal(ruled.categorySource,'rule');
  finance.ingestBank('11111111-1111-4111-8111-111111111111',{item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'CONTA FICTICIA',balance:100,type:'CHECKING'},transactions:rows}]});
  const repeat=await auto.run();
  assert.equal(repeat.applied,0);
  assert.equal(finance.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE kind=?').get('apply').n,1);
  assert.equal(finance.bankOverview().transactions.find(x=>x.id==='tx-10').categorySource,'manual');
  assert.notEqual(first.receiptId,null);
 }finally{finance.close();}
}));
test('MF1 auto: source change or PENDING transition invalidates auto label without changing original cents',()=>sandbox(async dir=>{
 const {finance}=make(dir);try{
  const auto=service(finance,dir);auto.consent({accountIds:[ACCOUNT],enabled:true});await auto.run();
  const before=finance.db.prepare('SELECT amount_cents FROM bank_transactions WHERE account_id=? AND external_id=?').get(ACCOUNT,'tx-10').amount_cents;
  finance.db.prepare('UPDATE bank_transactions SET description=? WHERE account_id=? AND external_id=?').run('ANOTHER UNVERIFIED MERCHANT',ACCOUNT,'tx-10');
  const now=finance.bankOverview().transactions.find(x=>x.id==='tx-10');
  assert.notEqual(now.categorySource,'auto');
  assert.equal(finance.db.prepare('SELECT amount_cents FROM bank_transactions WHERE account_id=? AND external_id=?').get(ACCOUNT,'tx-10').amount_cents,before);
  finance.db.prepare('UPDATE bank_transactions SET status=? WHERE account_id=? AND external_id=?').run('PENDING',ACCOUNT,'tx-11');
  assert.notEqual(finance.bankOverview().transactions.find(x=>x.id==='tx-11').categorySource,'auto');
 }finally{finance.close();}
}));
test('MF1 auto: rollback on insert failure leaves receipts and originals unchanged',()=>sandbox(async dir=>{
 const {finance}=make(dir);try{
  const auto=service(finance,dir);auto.consent({accountIds:[ACCOUNT],enabled:true});
  finance.db.exec("CREATE TRIGGER mf_test_abort BEFORE INSERT ON mf_auto_labels BEGIN SELECT RAISE(ABORT,'synthetic injected fault'); END;");
  const before=finance.db.prepare('SELECT COUNT(*) AS n FROM bank_transactions').get().n;
  await assert.rejects(auto.run(),/synthetic injected fault/);
  assert.equal(finance.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_receipts').get().n,0);
  assert.equal(finance.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n,0);
  assert.equal(finance.db.prepare('SELECT COUNT(*) AS n FROM bank_transactions').get().n,before);
 }finally{finance.close();}
}));
test('MF1 auto: supervised undo removes only auto labels, keeps manual override, and persists receipt after restart',()=>sandbox(async dir=>{
 const {finance}=make(dir);let receiptId;
 try{
  const auto=service(finance,dir);auto.consent({accountIds:[ACCOUNT],enabled:true});
  const first=await auto.run();receiptId=first.receiptId;
  const parentId=new D05CategoryService(finance).resolveLegacy('Alimentação').categoryId;
  new D05CategoryService(finance).assignBank({accountId:ACCOUNT,externalId:'tx-10',target:{categoryId:parentId,subcategoryId:null}});
  const result=await auto.undo(receiptId);assert.equal(result.status,'undone');assert(result.removed>500);
  assert.equal(finance.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n,0);
  assert(finance.db.prepare('SELECT 1 FROM bank_category_overrides WHERE account_id=? AND external_id=?').get(ACCOUNT,'tx-10'));
  assert.equal((await auto.undo(receiptId)).removed,0);
 }finally{finance.close();}
 const reopened=new FinanceDB(path.join(dir,'finance.sqlite'));
 try{const auto=service(reopened,dir);const receipts=auto.status().receipts;
  assert(receipts.some(x=>x.id===receiptId&&x.kind==='apply'));
  assert(receipts.some(x=>x.kind==='undo'));
 }finally{reopened.close();}
}));
test('MF1 auto: merchant aliases reconcile description variants only when owner alias is unambiguous',()=>{
 const alias=[{pattern:'MERCADO VILA',display_name:'MERCADO VILA'}];
 assert.equal(merchant('PAGAMENTO MERCADO VILA 837',alias),merchant('MERCADO VILA POS TERMINAL',alias));
 assert.equal(merchant('PAGAMENTO MERCADO VILA 837',[...alias,{pattern:'PAGAMENTO MERCADO',display_name:'OUTRO'}]),null);
 assert.equal(merchant('PIX',[...alias]),null);
});

test('MF1 auto: PENDING to POSTED reconciliation keeps a single external identity and exactly one auto assignment',()=>sandbox(async dir=>{
 const {finance,rows}=make(dir);try{
  const auto=service(finance,dir);auto.consent({accountIds:[ACCOUNT],enabled:true});
  await auto.run();
  assert.equal(finance.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT,'tx-609').n,0);
  const tx={...rows[609],status:'POSTED'};
  finance.ingestBank('11111111-1111-4111-8111-111111111111',{item:{status:'UPDATED'},data:[{
   account:{id:ACCOUNT,name:'CONTA FICTICIA',balance:100,type:'CHECKING'},transactions:[tx]}]});
  const second=await auto.run();
  assert.equal(second.applied,1);
  assert.equal(finance.db.prepare('SELECT COUNT(*) AS n FROM bank_transactions WHERE account_id=? AND external_id=?').get(ACCOUNT,'tx-609').n,1);
  assert.equal(finance.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT,'tx-609').n,1);
  assert.equal((await auto.run()).applied,0);
 }finally{finance.close();}
}));
test('MF1 auto: a legacy manual category without D05 IDs blocks automatic overwrite',()=>sandbox(async dir=>{
 const {finance}=make(dir);try{
  finance.db.prepare('INSERT INTO bank_category_overrides(account_id,external_id,category) VALUES (?,?,?)').run(ACCOUNT,'tx-30','Moradia');
  const auto=service(finance,dir);auto.consent({accountIds:[ACCOUNT],enabled:true});await auto.run();
  assert.equal(finance.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT,'tx-30').n,0);
  assert.equal(finance.db.prepare('SELECT category FROM bank_category_overrides WHERE account_id=? AND external_id=?').get(ACCOUNT,'tx-30').category,'Moradia');
 }finally{finance.close();}
}));
test('MF1 auto: unauthorized runtime cannot even create auto tables on a personal-looking profile',()=>sandbox(async dir=>{
 const {finance}=make(dir);try{
  const off=new PersonalAutoCategorizer({finance:()=>finance,backupDirectory:()=>path.join(dir,'backups'),allowed:()=>false});
  assert.equal(off.status().available,false);
  assert.throws(()=>off.consent({accountIds:[ACCOUNT],enabled:true}),/permission denied/);
  await assert.rejects(off.run(),/denied/);
  assert.equal(finance.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'mf_auto_%'").get().n,0);
 }finally{finance.close();}
}));
