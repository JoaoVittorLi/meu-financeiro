'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
const {RCCategoryGateway}=require('../electron/intelligence-category-rc.cjs');
const MONTH='2026-11',OWNER=192,SETTINGS={opening:0,income:0,fixed:0,existing:0,reserve:0};
function fixture(){
 const personalDb=new FinanceDB(':memory:');
 personalDb.save('demo',{version:5,transactions:[],budgets:{},settings:SETTINGS});
 const financial=new LocalFinancialIntelligence(personalDb,new PlanningStore(personalDb));
 const grant=financial.authorize({consent:CONSENT,source:'manual',profile:'demo',planning:false},OWNER);
 const gateway=new RCCategoryGateway({db:personalDb,localFinancial:financial});
 const scope={token:grant.token,source:'manual',profile:'demo',month:MONTH};
 return {personalDb,financial,grant,scope,gateway,close(){
  gateway.stopAll();personalDb.close();
 }};
}
const hasCategory=(db,name)=>db.listCategories().categories.some(c=>c.name===name);
const propose=(s,action,params)=>({sessionId:s.sessionId,method:'propose',action,params});
const doConfirm=(s,p)=>({sessionId:s.sessionId,method:'confirm',
 proposalId:p.proposalId,confirmationNonce:p.confirmationNonce});
test('RC I2-B: personal catalog and category preview are read-only, confirm denied',async()=>{
 const f=fixture();try{
  const catalog=await f.gateway.personalCall({method:'analyze',scope:f.scope},OWNER);
  assert.equal(catalog.mode,'READ_ONLY_PERSONAL');
  assert.equal(catalog.changesApplied,false);
  assert.equal(catalog.data.modelCalled,false);
  assert(catalog.data.catalog.categories.length>0);
  const preview=await f.gateway.personalCall({method:'propose',scope:f.scope,
   action:'category.create',params:{name:'PersonalDraftOnly',color:'#2aa898',
    emoji:'🐾',kind:'expense'}},OWNER);
  assert.equal(preview.status,'ready');
  assert.equal(preview.data.mayExecuteSynthetic,undefined);
  assert.equal(hasCategory(f.personalDb,'PersonalDraftOnly'),false);
  const denied=await f.gateway.personalCall({method:'confirm',scope:f.scope,
   proposalId:preview.data.proposalId,confirmationNonce:preview.data.confirmationNonce},OWNER);
  assert.equal(denied.status,'denied');
  assert.equal(denied.changesApplied,false);
  assert.equal(hasCategory(f.personalDb,'PersonalDraftOnly'),false);
 }finally{f.close();}
});
test('RC I2-C: native rejection then explicit consent changes only file-backed synthetic SQLite',async()=>{
 const f=fixture();try{
  const s=f.gateway.startSandbox(MONTH,OWNER);
  assert.equal(s.mode,'SYNTHETIC_PREVIEW');
  assert.equal(s.source,'manual');assert.equal(s.profile,'demo');
  assert.equal(Object.prototype.hasOwnProperty.call(s,'token'),false);
  assert.notEqual(f.gateway.sandbox.vault.filename,':memory:');
  const p=(await f.gateway.sandboxCall(propose(s,'category.create',
   {name:'LabPets',color:'#2aa898',emoji:'🐾',kind:'expense'}),OWNER)).data;
  assert.equal(p.status,'ready');assert.equal(p.mayExecuteSynthetic,true);
  let nativeCallbacks=0;
  const cancelled=await f.gateway.sandboxCall(doConfirm(s,p),OWNER,async()=>{
   nativeCallbacks++;return false;
  });
  assert.equal(cancelled.status,'denied');
  assert.equal(hasCategory(f.gateway.sandbox.vault.db,'LabPets'),false);
  const applied=await f.gateway.sandboxCall(doConfirm(s,p),OWNER,async preview=>{
   nativeCallbacks++;assert.equal(preview.syntheticOnly,true);return true;
  });
  assert.equal(applied.status,'applied');
  assert.equal(applied.changesApplied,true);
  assert.equal(applied.data.receipt.syntheticOnly,true);
  assert.equal(nativeCallbacks,2);
  assert.equal(hasCategory(f.gateway.sandbox.vault.db,'LabPets'),true);
  assert.equal(hasCategory(f.personalDb,'LabPets'),false);
  const receipt=await f.gateway.sandboxCall({sessionId:s.sessionId,
   method:'receipt',proposalId:p.proposalId},OWNER);
  assert.equal(receipt.status,'applied');assert.equal(receipt.data.receipt.syntheticOnly,true);
 }finally{f.close();}
});
test('RC I2-C: no native-confirm callback and wrong nonce cannot mutate',async()=>{
 const f=fixture();try{
  const s=f.gateway.startSandbox(MONTH,OWNER);
  const p=(await f.gateway.sandboxCall(propose(s,'category.create',
   {name:'NoTrust',color:'#2aa898',emoji:'🐾',kind:'expense'}),OWNER)).data;
  const denied=await f.gateway.sandboxCall({...doConfirm(s,p),
   confirmationNonce:'x'.repeat(30)},OWNER,async()=>true);
  assert.equal(denied.status,'stale');
  await assert.rejects(f.gateway.sandboxCall(doConfirm(s,p),OWNER),/nativa/i);
  assert.equal(hasCategory(f.gateway.sandbox.vault.db,'NoTrust'),false);
 }finally{f.close();}
});
test('RC I2-C: sender, grant, month, injected owner/SQL scope fail closed',async()=>{
 const f=fixture();try{
  const s=f.gateway.startSandbox(MONTH,OWNER);
  await assert.rejects(f.gateway.sandboxCall({sessionId:s.sessionId,
   method:'analyze'},OWNER+1),/ausente|expirad/);
  await assert.rejects(f.gateway.sandboxCall({sessionId:s.sessionId,
   method:'analyze',scope:f.scope},OWNER),/inválido/);
  await assert.rejects(f.gateway.sandboxCall({sessionId:s.sessionId,
   method:'analyze',verifiedGesture:true},OWNER),/inválido/);
  const personal=await f.gateway.personalCall({method:'confirm',scope:f.scope},OWNER);
  assert.equal(personal.status,'denied');
  f.gateway.sandbox.local.authorize({consent:CONSENT,source:'manual',profile:'demo'},OWNER);
  await assert.rejects(f.gateway.sandboxCall({sessionId:s.sessionId,
   method:'analyze'},OWNER),/Autorização|autorização|expirada/i);
 }finally{f.close();}
});
test('RC I2-C: deterministic manual transaction preview uses real service and never personal DB',async()=>{
 const f=fixture();try{
  const s=f.gateway.startSandbox(MONTH,OWNER);
  const p=(await f.gateway.sandboxCall(propose(s,'transaction.categorize',
   {category:'Transporte',items:[{id:'demo-market'}]}),OWNER)).data;
  assert.equal(p.status,'ready');
  assert.equal(p.impact.count,1);
  assert.equal(p.impact.amountCents,4500);
  const saved=await f.gateway.sandboxCall(doConfirm(s,p),OWNER,async()=>true);
  assert.equal(saved.status,'applied');
  assert.equal(f.gateway.sandbox.vault.db.load('demo').transactions.find(x=>x.id==='demo-market').category,'Transporte');
  assert.equal(f.personalDb.load('demo').transactions.length,0);
 }finally{f.close();}
});
test('RC I2-C: D05 subcategory object remains unsupported, never coerced to parent',async()=>{
 const f=fixture();try{
  const s=f.gateway.startSandbox(MONTH,OWNER);
  const r=await f.gateway.sandboxCall({sessionId:s.sessionId,method:'propose',
   action:'transaction.categorize',params:{category:'Alimentação',items:[{id:'demo-market'}]},
   target:{categoryId:'cat',subcategoryId:'sub'}},OWNER);
  assert.equal(r.status,'unsupported');assert.equal(r.changesApplied,false);
  assert.equal(f.gateway.sandbox.vault.db.load('demo').transactions.find(x=>x.id==='demo-market').category,'Alimentação');
 }finally{f.close();}
});
test('RC I2-C: sandbox restart and stop destroy only synthetic storage',async()=>{
 const f=fixture();try{
  const s=f.gateway.startSandbox(MONTH,OWNER),file=f.gateway.sandbox.vault.filename;
  assert.equal(fs.existsSync(file),true);
  const newSession=f.gateway.startSandbox(MONTH,OWNER);
  assert.notEqual(s.sessionId,newSession.sessionId);
  assert.equal(fs.existsSync(file),false);
  await assert.rejects(f.gateway.sandboxCall({sessionId:s.sessionId,method:'list'},OWNER),/ausente|expirad/);
  assert.deepEqual(f.gateway.stopSandbox(newSession.sessionId,OWNER),{closed:true});
  assert.equal(f.gateway.sandbox,null);
  assert.equal(f.personalDb.integrity()[0],'ok');
 }finally{f.close();}
});
test('RC I2-B/C: Electron binds explicit IPC and userData remains isolated',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const main=read('electron/main.cjs'),preload=read('electron/preload.cjs'),
  ui=read('src/intelligence-review-v11.ts'),
  tsconfig=read('tsconfig.json'),gateway=read('electron/intelligence-category-rc.cjs');
 assert.match(main,/ipcMain\.handle\('intelligence:category-personal'/);
 assert.match(main,/ipcMain\.handle\('intelligence:category-sandbox-command'/);
 assert.match(main,/dialog\.showMessageBox\(mainWindow,/);
 assert.match(main,/requireAppSender\(event\)/);
 assert.match(main,/MeuFinanceiro-RC-ALL-01-Experimental/);
 assert.match(main,/app\.setPath\('userData',isolated\)/);
 assert.match(preload,/intelligenceCategoryPersonal:/);
 assert.match(preload,/intelligenceCategorySandboxStart:/);
 assert.match(preload,/intelligenceCategorySandboxStop:/);
 assert.doesNotMatch(preload,/ipcRenderer:\s*ipcRenderer/);
 assert.match(ui,/mfI2CategoryPanel\(app\)/);
 assert.match(tsconfig,/src\/intelligence-category-rc\.ts/);
 assert.match(gateway,/this\.personal=new IntelligenceCategoryBridge/);
 assert.match(gateway,/createSyntheticFinanceVault\(\)/);
});
