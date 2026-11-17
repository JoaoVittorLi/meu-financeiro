'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {migrateCat01,persistEvidenceBatch}=require('../electron/cat01-evidence-store.cjs');
const {Cat03PreviewService,accountsOf,PAGE}=require('../electron/cat03-history-preview.cjs');
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec([
  "PRAGMA foreign_keys=ON;",
  "CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT);",
  "CREATE TABLE bank_items(item_id TEXT PRIMARY KEY,institution TEXT);",
  "CREATE TABLE bank_accounts(account_id TEXT PRIMARY KEY,item_id TEXT,name TEXT);",
  "CREATE TABLE bank_transactions(account_id TEXT,external_id TEXT,date TEXT,description TEXT,",
   "amount_cents INTEGER,status TEXT,category TEXT,PRIMARY KEY(account_id,external_id));",
  "CREATE TABLE bank_category_overrides(account_id TEXT,external_id TEXT,category TEXT);",
  "CREATE TABLE bank_transaction_notes(account_id TEXT,external_id TEXT,nature TEXT,reviewed_at TEXT);",
  "CREATE TABLE bank_transaction_splits(account_id TEXT,external_id TEXT,position INTEGER);",
  "CREATE TABLE bank_manual_links(account_id TEXT,external_id TEXT,manual_id TEXT);"
 ].join(''));
 const add=db.prepare("INSERT INTO bank_transactions VALUES(?,?,?,?,?,?,?)");
 const metadata=[];
 for(let account=1;account<=3;account++){
  db.prepare('INSERT INTO bank_items VALUES(?,?)').run('item-'+account,'Banco sintético');
  db.prepare('INSERT INTO bank_accounts VALUES(?,?,?)').run('a-'+account,'item-'+account,'Conta '+account);
  for(let i=0;i<210;i++){
   const id='t-'+String(i).padStart(4,'0');
   add.run('a-'+account,id,'2026-11-16','Supermercado Exemplo',-1400,'POSTED','Groceries');
   metadata.push({accountId:'a-'+account,transaction:{
    id,accountId:'a-'+account,description:'Supermercado Exemplo',status:'POSTED',
    type:'DEBIT',date:'2026-11-16',amount:-14,category:'Supermarkets',
    creditCardMetadata:{payeeMCC:5411}
   }});
  }
 }
 migrateCat01(db);persistEvidenceBatch(db,metadata,{observedAt:'2026-11-17T12:00:00Z'});
 const scope={owner:1,profile:'real',readGrantId:'trusted-grant-1234'},accounts=['a-1','a-2','a-3'];
 let revoked=false;
 const service=new Cat03PreviewService({db,authorizeRead:({scope:s})=>{
  if(revoked||s.readGrantId!==scope.readGrantId||s.owner!==scope.owner)throw Error('Permissão negada');
 },historyFor:()=>[],approvedRulesFor:()=>[],clock:()=>Date.parse('2026-11-17T13:00:00Z')});
 return {db,service,scope,accounts,revoke:()=>{revoked=true}};
}
function finish(x){
 let r=x.service.start({accountIds:x.accounts,scope:x.scope});
 while(r.state==='scanning')r=x.service.next(r.id,x.scope);
 return r;
}
test('CAT03 T1 — keyset scans 630 transactions, never just 2.500 GUI subset',()=>{
 const f=fixture();try{
  const r=finish(f);assert.equal(r.total,630);assert.equal(r.processed,630);
  assert.equal(r.counts.apply,630);assert.equal(r.state,'review_ready');
  const manifest=f.service.manifest(r.id,f.scope,r.previewVersion);
  assert.equal(manifest.items.length,630);assert(manifest.items.every(i=>i.rowVersion.length===64));
 }finally{f.db.close();}
});
test('CAT03 T2 — first run with zero human labels can use concordant external evidence',()=>{
 const f=fixture();try{
  const r=finish(f);
  const a=f.service.manifest(r.id,f.scope,r.previewVersion).items[0];
  assert.deepEqual(a.target,{categoryId:'cat:alimentacao',
   subcategoryId:'sub:alimentacao/supermercados'});
 }finally{f.db.close();}
});
test('CAT03 T3 — pause, resume, cancel do not write personal categories',()=>{
 const f=fixture();try{
  const x=f.service.start({accountIds:f.accounts,scope:f.scope});
  f.service.pause(x.id,f.scope);
  assert.throws(()=>f.service.next(x.id,f.scope),/parada/);
  f.service.resume(x.id,f.scope);
  const p=f.service.next(x.id,f.scope,{limit:200});assert.equal(p.processed,200);
  assert.deepEqual(f.service.cancel(x.id,f.scope),{cancelled:true,readOnly:true,changesApplied:false});
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bank_category_overrides').get().n,0);
 }finally{f.db.close();}
});
test('CAT03 T4 — invalid grants and wrong owner prevent preview',()=>{
 const f=fixture();try{
  const r=f.service.start({accountIds:f.accounts,scope:f.scope});
  assert.throws(()=>f.service.next(r.id,{...f.scope,owner:2}),/inválida/);
  f.revoke();assert.throws(()=>f.service.next(r.id,f.scope),/negada/);
 }finally{f.db.close();}
});
test('CAT03 T5 — previewVersion mismatches are rejected',()=>{
 const f=fixture();try{const r=finish(f);
  assert.throws(()=>f.service.manifest(r.id,f.scope,'a'.repeat(64)),/divergente/);
 }finally{f.db.close();}
});
test('CAT03 T6 — changing row count mid-analysis invalidates manifest',()=>{
 const f=fixture();try{
  const r=f.service.start({accountIds:f.accounts,scope:f.scope});
  f.service.next(r.id,f.scope);
  f.db.prepare('DELETE FROM bank_transactions WHERE account_id=? AND external_id=?').run('a-1','t-0209');
  let step=f.service.status(r.id,f.scope);
  assert.throws(()=>{while(step.state==='scanning')step=f.service.next(r.id,f.scope);},/alteradas|mudou/);
 }finally{f.db.close();}
});
test('CAT03 T7 — manual override, splits and transfer remain protected',()=>{
 const f=fixture();try{
  f.db.prepare('INSERT INTO bank_category_overrides VALUES(?,?,?)').run('a-1','t-0000','Alimentação');
  f.db.prepare('INSERT INTO bank_transaction_splits VALUES(?,?,?)').run('a-1','t-0001',0);
  f.db.prepare('INSERT INTO bank_transaction_notes VALUES(?,?,?,?)').run('a-1','t-0002','transfer',null);
  const r=finish(f);
  assert.equal(r.counts.protected,3);assert.equal(r.counts.apply,627);
 }finally{f.db.close();}
});
test('CAT03 T8 — catalog/account IDs always validated before scanning',()=>{
 assert.throws(()=>accountsOf(['a-1','a-1']),/inválidas/);
 assert.throws(()=>accountsOf([]),/inválidas/);
 assert.equal(PAGE,250);
});
test('CAT03 T9 — scanning more than PAGE cannot be forced by caller',()=>{
 const f=fixture();try{
  const r=f.service.start({accountIds:f.accounts,scope:f.scope});
  assert.throws(()=>f.service.next(r.id,f.scope,{limit:251}),/limite/);
 }finally{f.db.close();}
});
