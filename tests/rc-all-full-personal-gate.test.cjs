'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createSyntheticFinanceVault,assertSyntheticVault}=require('../electron/intelligence-category-vault.cjs');
const {D05RCSecureGate}=require('../electron/d05-rc-gate.cjs');
const {D05PersonalWriteGateway}=require('../electron/d05-personal-gate.cjs');
const target={categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'};
const event={sender:{id:18,isDestroyed:()=>false}};
const SETTINGS={opening:0,income:0,fixed:0,existing:0,reserve:0};
function fixture({accept=true,synthetic=true}={}){
 const vault=createSyntheticFinanceVault();
 assertSyntheticVault(vault,vault.db);
 vault.db.save('demo',{version:5,settings:SETTINGS,budgets:{},
  transactions:[{id:'test-1',date:'2026-11-05',description:'Mercado sintético',
   kind:'expense',amount:4900,category:'Alimentação'}]});
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d05-personal-gate-test-'));
 const read=new D05RCSecureGate({finance:()=>vault.db,
  confirm:async()=>true,backupDirectory:()=>folder,isIsolated:()=>true});
 const gateway=new D05PersonalWriteGateway({finance:()=>vault.db,
  readSession:(event,input)=>read.require(event,input),
  confirm:async()=>accept,backupDirectory:()=>folder,
  approvedForPersonal:()=>false,syntheticVault:synthetic?vault:null});
 return {vault,folder,read,gateway,close(){
  gateway.stopAll();read.stopAll();vault.destroy();
  fs.rmSync(folder,{recursive:true,force:true});
 }};
}
test('PersonalGate — separate from I2-C, preview before/after is read-only and nonce scoped',async()=>{
 const f=fixture();try{
  const session=await f.read.authorize(event,{profile:'demo'});
  const p=await f.gateway.prepare(event,{sessionToken:session.token,
   action:'manual.categorize',profile:'demo',id:'test-1',target});
  assert.equal(p.contract,'D05/PERSONAL-SUPERVISED-PREVIEW-V1');
  assert.equal(p.before.category,'Alimentação');
  assert.equal(p.after.subcategoryId,target.subcategoryId);
  assert.equal(p.personalWriteAuthorized,false);
  assert.equal(f.vault.db.load('demo').transactions[0].subcategoryId??null,null);
  const rejected=await f.gateway.confirmPreview(event,{
   sessionToken:session.token,proposalId:p.proposalId,nonce:'bad'});
  assert.equal(rejected.status,'stale');
  assert.equal(f.vault.db.load('demo').transactions[0].subcategoryId??null,null);
 }finally{f.close();}
});
test('PersonalGate — synthetic QA native consent, backup, atomic receipt and replay',async()=>{
 const f=fixture();try{
  const s=await f.read.authorize(event,{profile:'demo'});
  const p=await f.gateway.prepare(event,{sessionToken:s.token,action:'manual.categorize',
   profile:'demo',id:'test-1',target});
  const result=await f.gateway.confirmPreview(event,{sessionToken:s.token,
   proposalId:p.proposalId,nonce:p.nonce});
  assert.equal(result.status,'applied');
  assert.equal(result.receipt.syntheticOnly,true);
  assert.equal(result.receipt.backupVerified,true);
  assert.equal(f.vault.db.load('demo').transactions[0].subcategoryId,target.subcategoryId);
  const sql=f.vault.db.db;
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM d05_personal_supervised_receipts').get().n,1);
  assert(fs.readdirSync(f.folder).some(n=>n.endsWith('.sqlite')));
  const again=await f.gateway.confirmPreview(event,{sessionToken:s.token,
   proposalId:p.proposalId,nonce:p.nonce});
  assert.equal(again.status,'applied');assert.equal(again.replayed,true);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM d05_personal_supervised_receipts').get().n,1);
  const receipt=f.gateway.receipt(event,{sessionToken:s.token,proposalId:p.proposalId});
  assert.equal(receipt.status,'applied');
 }finally{f.close();}
});
test('PersonalGate — native denial, stale row and wrong session never write',async()=>{
 const f=fixture({accept:false});try{
  const s=await f.read.authorize(event,{profile:'demo'});
  const input={sessionToken:s.token,action:'manual.categorize',
   profile:'demo',id:'test-1',target};
  const p=await f.gateway.prepare(event,input);
  const denied=await f.gateway.confirmPreview(event,{sessionToken:s.token,
   proposalId:p.proposalId,nonce:p.nonce});
  assert.equal(denied.status,'denied');
  assert.equal(f.vault.db.load('demo').transactions[0].subcategoryId??null,null);
  f.vault.db.db.prepare("UPDATE transactions SET amount_cents=6000 WHERE id='test-1'").run();
  const stale=await f.gateway.confirmPreview(event,{sessionToken:s.token,
   proposalId:p.proposalId,nonce:p.nonce});
  assert.equal(stale.status,'stale');
  assert.equal(f.vault.db.load('demo').transactions[0].subcategoryId??null,null);
  await assert.rejects(f.gateway.prepare({sender:{id:19}},input),/sessão/);
  f.read.stopAll();
  await assert.rejects(f.gateway.prepare(event,input),/sessão/);
 }finally{f.close();}
});
test('PersonalGate — production real and demo writes remain disabled without vault/owner approval',async()=>{
 const f=fixture({synthetic:false});try{
  const s=await f.read.authorize(event,{profile:'demo'});
  const p=await f.gateway.prepare(event,{sessionToken:s.token,action:'manual.categorize',
   profile:'demo',id:'test-1',target});
  const result=await f.gateway.confirmPreview(event,{sessionToken:s.token,
   proposalId:p.proposalId,nonce:p.nonce});
  assert.equal(result.status,'denied');
  assert.equal(result.personalWriteAuthorized,false);
  assert.equal(f.vault.db.load('demo').transactions[0].subcategoryId??null,null);
 }finally{f.close();}
});
