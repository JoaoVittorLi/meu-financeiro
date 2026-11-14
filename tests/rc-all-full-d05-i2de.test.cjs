'use strict';
// Real Node/SQLite regression tests; not V8/parser-only evidence.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const ts=require('typescript');
const {webcrypto}=require('node:crypto');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
const {D05CategoryService}=require('../electron/d05-category-service.cjs');
const {D05RCSecureGate}=require('../electron/d05-rc-gate.cjs');
const {RCCategoryGateway}=require('../electron/intelligence-category-rc.cjs');
const {installD05Ipc}=require('../electron/d05-ipc-adapter.cjs');
const SETTINGS={opening:0,income:0,fixed:0,existing:0,reserve:0};
const OWNER=66,MONTH='2026-11';
function fixture({approve=true}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-rc-d05-'));
 const finance=new FinanceDB(path.join(dir,'finance.sqlite'));
 finance.save('demo',{version:5,settings:SETTINGS,budgets:{},transactions:[
  {id:'manual-1',date:'2026-11-05',description:'Mercado sintético',kind:'expense',
   amount:4500,category:'Alimentação'}]});
 const app={sender:{id:OWNER,isDestroyed:()=>false}};
 const gate=new D05RCSecureGate({finance:()=>finance,isIsolated:()=>true,
  backupDirectory:()=>path.join(dir,'backups'),
  confirm:async()=>approve});
 const close=()=>{gate.stopAll();finance.close();fs.rmSync(dir,{recursive:true,force:true})};
 return {dir,finance,app,gate,close};
}
const target={categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'};
test('RC FULL D05 — native-consented synthetic demo write + backup and atomic durable receipt',async()=>{
 const f=fixture();try{
  const s=await f.gate.authorize(f.app,{profile:'demo'});
  const input={sessionToken:s.token,profile:'demo',id:'manual-1',target};
  const service=new D05CategoryService(f.finance);
  const first=await f.gate.write(f.app,'manual.categorize',input,()=>service.assignManual(input));
  assert.equal(first.categoryId,target.categoryId);
  assert.equal(first.subcategoryId,target.subcategoryId);
  assert.equal(first.syntheticOnly,true);
  assert.equal(f.finance.db.prepare("SELECT COUNT(*) AS n FROM d05_rc_atomic_receipts").get().n,1);
  const row=f.finance.db.prepare("SELECT category_id AS categoryId,subcategory_id AS subcategoryId FROM transactions WHERE id='manual-1'").get();
  assert.equal(row.categoryId,target.categoryId);
  assert.equal(row.subcategoryId,target.subcategoryId);
  const receipt=f.gate.receipt(f.app,{sessionToken:s.token,receiptId:first.rcReceiptId});
  assert.equal(receipt.status,'applied');
  assert.equal(receipt.result.categoryId,target.categoryId);
  assert(fs.readdirSync(path.join(f.dir,'backups')).some(n=>n.endsWith('.sqlite')));
  const retry=await f.gate.write(f.app,'manual.categorize',input,()=>{throw Error('duplicate executed');});
  assert.equal(retry.replayed,true);
  assert.equal(retry.rcReceiptId,first.rcReceiptId);
  assert.equal(f.finance.db.prepare("SELECT COUNT(*) AS n FROM d05_rc_atomic_receipts").get().n,1);
 }finally{f.close();}
});
test('RC FULL D05 — cancel native confirmation cannot mutate and creates no receipt',async()=>{
 const f=fixture({approve:false});try{
  const s=await f.gate.authorize(f.app,{profile:'demo'});
  await assert.rejects(f.gate.write(f.app,'manual.categorize',{
   sessionToken:s.token,profile:'demo',id:'manual-1',target
  },()=>{throw Error('should not run')}),/cancelada/);
  assert.equal(f.finance.db.prepare("SELECT COUNT(*) AS n FROM d05_rc_atomic_receipts").get().n,0);
  assert.equal(f.finance.db.prepare("SELECT subcategory_id AS id FROM transactions WHERE id='manual-1'").get().id,null);
 }finally{f.close();}
});
test('RC FULL D05 — revoked/foreign grant, wrong profile, account and personal writes denied',async()=>{
 const f=fixture();try{
  const s=await f.gate.authorize(f.app,{profile:'demo'});
  const req={sessionToken:s.token,profile:'demo',id:'manual-1',target};
  assert.equal(f.gate.read(f.app,{source:'manual'},req),true);
  assert.equal(f.gate.read(f.app,{source:'bank'},req),false);
  assert.equal(f.gate.read(f.app,{source:'manual'},{...req,profile:'real'}),false);
  await assert.rejects(f.gate.write(f.app,'bank.categorize',req,()=>({})),/indisponível/);
  await assert.rejects(f.gate.write(f.app,'rule.save',req,()=>({})),/indisponível/);
  await assert.rejects(f.gate.write(f.app,'manual.categorize',{...req,sessionToken:'wrong'},()=>({})),/sessão/);
  await assert.rejects(f.gate.write({sender:{id:OWNER+1,isDestroyed:()=>false}},
   'manual.categorize',req,()=>({})),/sessão/);
  f.gate.stopAll();
  await assert.rejects(f.gate.write(f.app,'manual.categorize',req,()=>({})),/sessão/);
 }finally{f.close();}
});
test('RC FULL D05 — changed SQLite while native modal open fails revalidation',async()=>{
 const f=fixture();try{
  const s=await f.gate.authorize(f.app,{profile:'demo'});
  f.gate.confirm=async()=>{f.finance.db.prepare("UPDATE transactions SET amount_cents=8900 WHERE id='manual-1'").run();return true;};
  const req={sessionToken:s.token,profile:'demo',id:'manual-1',target};
  await assert.rejects(f.gate.write(f.app,'manual.categorize',req,()=>({})),/alterada/);
  assert.equal(f.finance.db.prepare('SELECT COUNT(*) AS n FROM d05_rc_atomic_receipts').get().n,0);
 }finally{f.close();}
});
test('RC FULL D05 — official MAIN adapter keeps real sender/profile, applies only with gate',async()=>{
 const f=fixture();try{
  const routes=new Map(),s=await f.gate.authorize(f.app,{profile:'demo'});
  installD05Ipc({ipcMain:{handle:(n,fn)=>routes.set(n,fn)},finance:()=>f.finance,
   requireAppSender:event=>{if(event!==f.app)throw Error('sender unknown')},
   authorizeRead:(event,scope,input)=>f.gate.read(event,scope,input),
   authorizeWrite:(event,action,input,execute)=>f.gate.write(event,action,input,execute)});
  const catalog=routes.get('d05:catalog')(f.app,{sessionToken:s.token});
  assert.equal(catalog.parents.length,14);
  const result=await routes.get('d05:assign-manual')(f.app,{
   sessionToken:s.token,profile:'demo',id:'manual-1',target});
  assert.equal(result.subcategoryId,target.subcategoryId);
  await assert.rejects(routes.get('d05:assign-bank')(f.app,{
   sessionToken:s.token,accountId:'bank',externalId:'x',target}),/indisponível/);
 }finally{f.close();}
});
test('RC FULL I2-E — quality-only personal entry and bank owner permission, no I2-D bypass',async()=>{
 const f=fixture();try{
  const local=new LocalFinancialIntelligence(f.finance,new PlanningStore(f.finance));
  const read=local.authorize({consent:CONSENT,source:'manual',profile:'demo'},OWNER);
  const gateway=new RCCategoryGateway({db:f.finance,localFinancial:local});
  const scope={token:read.token,source:'manual',profile:'demo',month:MONTH};
  const capa=await gateway.personalCall({method:'qualityCapabilities',scope},OWNER);
  assert.equal(capa.status,'ready');
  assert.equal(capa.data.personalWrites,false);
  const denied=await gateway.personalCall({method:'draftOpportunity',scope,
   opportunityId:'fake'},OWNER);
  assert.equal(denied.status,'denied');
  const quality=await gateway.personalCall({method:'qualityScan',scope},OWNER);
  assert.equal(quality.changesApplied,false);
  const unsupported=await gateway.personalCall({method:'qualityDraft',scope,action:'historical',
   qualityId:'fake',target:{categoryId:'cat:fake',subcategoryId:null}},OWNER);
  assert(['denied','review_required','stale'].includes(unsupported.status));
  const forbidden=await gateway.personalCall({method:'confirm',scope},OWNER);
  assert.equal(forbidden.status,'denied');
 }finally{f.close();}
});
test('RC FULL CSV — strict parser handles quoted delimiter/newline, rejects formulas and malformed rows',async()=>{
 const file=fs.readFileSync(path.join(__dirname,'../src/d05-csv.ts'),'utf8');
 const js=ts.transpileModule(file,{compilerOptions:{target:ts.ScriptTarget.ES2019,
  module:ts.ModuleKind.None}}).outputText;
 const api=new Function('crypto','TextEncoder',js+';return {d05CsvTable,d05CsvSafeText,d05CsvDate,d05CsvDigest,d05CsvFormulaSafe};')
  (webcrypto,TextEncoder);
 const csv='data;descricao;valor;tipo;categoria\r\n2026-11-01;"Mercado; Padaria";-15,90;despesa;Alimentação\r\n';
 const table=api.d05CsvTable(csv);
 assert.equal(table.rows.length,1);
 assert.equal(table.rows[0][1],'Mercado; Padaria');
 assert.equal((await api.d05CsvDigest(csv)).length,64);
 assert.equal(api.d05CsvDate('14/11/2026'),'2026-11-14');
 assert.throws(()=>api.d05CsvDate('31/02/2026'),/impossível/);
 assert.throws(()=>api.d05CsvSafeText('=HYPERLINK()',150,'Descrição'),/fórmula/);
 assert.equal(api.d05CsvFormulaSafe('=1+1'),"'=1+1");
 assert.throws(()=>api.d05CsvTable('data;descricao;valor\n2026-11-01;"quebrado;20'),/aspas/);
 assert.throws(()=>api.d05CsvTable('data;descricao;valor\n2026-11-01;x;10;extra'),/colunas/);
});
test('RC FULL contract — D05, I2-D/E and CSV wired into React16/MAIN without generic IPC',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const main=read('electron/main.cjs'),preload=read('electron/preload.cjs'),
  rc=read('electron/intelligence-category-rc.cjs'),ui=read('src/intelligence-category-rc.ts'),
  qualityUI=read('src/intelligence-quality-rc.ts'),ts=read('tsconfig.json'),
  app=read('src/app.ts'),d05=read('src/d05-movements.ts');
 assert.match(main,/installD05Ipc\(/);
 assert.match(main,/d05:session-authorize/);
 assert.match(main,/d05:account-authorize/);
 assert.match(main,/activeAccountId:d05Gate\.trustedAccount/);
 assert.match(preload,/createD05PreloadBridge\(ipcRenderer\)/);
 assert.match(rc,/new EvidenceQualityBridge/);
 assert.match(rc,/new D05CategoryService\(this\.finance\)\.previewBankBatch/);
 assert.match(ui,/mfI2QualityPanel\(app\)/);
 assert.match(qualityUI,/qualityDraft/);
 assert.match(d05,/d05SessionAuthorize/);
 assert.match(app,/renderCSVPreview\(\)/);
 assert.match(ts,/src\/d05-csv\.ts/);
 assert.doesNotMatch(preload,/ipcRenderer:\s*ipcRenderer/);
 assert.match(read('src/d05-movements.ts'),/class D05Movements extends React\.Component/);
});

test('RC FULL D05 — real bank account identity requires trusted MAIN approval',async()=>{
 const f=fixture();try{
  const item='11111111-1111-4111-8111-111111111111';
  const account='22222222-2222-4222-8222-222222222222';
  f.finance.ingestBank(item,{item:{status:'UPDATED'},data:[{
   account:{id:account,name:'Conta sintética',balance:500},
   transactions:[{id:'bank-1',date:'2026-11-05',amount:-45,status:'POSTED',
    description:'Mercado fictício',category:'Groceries'}]
  }]});
  const session=await f.gate.authorize(f.app,{profile:'real'});
  assert.equal(f.gate.trustedAccount(f.app),null);
  await assert.rejects(f.gate.authorizeAccount(f.app,{
   sessionToken:session.token,accountId:'foreign-bank'}),/não encontrada/);
  const authorized=await f.gate.authorizeAccount(f.app,{
   sessionToken:session.token,accountId:account});
  assert.equal(authorized.accountId,account);
  assert.equal(f.gate.trustedAccount(f.app),account);
  assert.equal(f.gate.read(f.app,{source:'bank'},{
   sessionToken:session.token,accountId:account}),true);
  f.gate.stopAll();
  assert.equal(f.gate.trustedAccount(f.app),null);
  await assert.rejects(f.gate.authorizeAccount(f.app,{
   sessionToken:session.token,accountId:account}),/sessão/);
 }finally{f.close();}
});
test('RC FULL D05 — 632 synthetic movements retain parent/child IDs through backup and reopen',async()=>{
 const f=fixture();try{
  const entries=Array.from({length:632},(_,i)=>({
   id:'mass-'+i,date:'2026-11-'+String(i%27+1).padStart(2,'0'),
   description:'Compra sintética '+i,kind:'expense',
   amount:i+1,category:'Alimentação',
   categoryId:target.categoryId,subcategoryId:target.subcategoryId
  }));
  const full={version:5,settings:SETTINGS,budgets:{},transactions:entries};
  f.finance.save('demo',full);
  const count=f.finance.db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE profile='demo' AND subcategory_id=?")
   .get(target.subcategoryId).n;
  assert.equal(count,632);
  const backup=path.join(f.dir,'full-backup.sqlite');
  await f.finance.backupTo(backup);
  assert(fs.statSync(backup).size>0);
  const copy=new FinanceDB(backup);try{
   const svc=new D05CategoryService(copy);
   const rows=svc.listManual({profile:'demo',limit:1000});
   assert.equal(rows.total,632);
   assert.equal(rows.items.length,632);
   assert(rows.items.every(x=>x.categoryId===target.categoryId&&x.subcategoryId===target.subcategoryId));
   assert.equal(copy.integrity()[0],'ok');
  }finally{copy.close();}
 }finally{f.close();}
});
