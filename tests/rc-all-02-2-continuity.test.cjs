'use strict';
// RC-ALL-02.2 synthetic stable-upgrade/RC isolation, real SQLite and no network.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {PluggyVault}=require('../electron/pluggy-vault.cjs');
const {releaseChannel,stableProfileDirectory,experimentalProfileDirectory,
 stablePreMigrationBackup,STABLE_NAME,EXPERIMENTAL_NAME,ISOLATED_DIR}=require('../electron/release-channel.cjs');
const fakeApp=(root,name=STABLE_NAME,isPackaged=true)=>({
 isPackaged,getName:()=>name,getPath:key=>{
  assert.equal(key,'appData');return root;
 }});
const tmp=fn=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-rc-continuity-'));
 try{return fn(root)}finally{fs.rmSync(root,{recursive:true,force:true})}
};
const itemIds=['11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '55555555-5555-4555-8555-555555555555'];
const accountIds=['22222222-2222-4222-8222-222222222222',
 '44444444-4444-4444-8444-444444444444',
 '66666666-6666-4666-8666-666666666666'];
function seed(file){
 const db=new FinanceDB(file);
 try{
  db.save('real',{version:5,transactions:[{
   id:'manual-original',date:'2026-10-17',description:'Aluguel sintético',
   kind:'expense',amount:100000,category:'Moradia'
  }],budgets:{Alimentação:0,Transporte:25000},settings:{
   opening:123456,income:310000,fixed:100000,existing:15000,reserve:20000
  }});
  for(let n=0;n<3;n++){
   const transactions=Array.from({length:200},(_,i)=>({
    id:'tr-'+n+'-'+i,date:'2026-'+String(i%2===0?10:11)+'-'+String(i%27+1).padStart(2,'0'),
    description:'Movimentação sintética '+n+'-'+i,
    amount:-(12.34+(i%10)),status:i%9===0?'PENDING':'POSTED',category:'Groceries'
   }));
   db.ingestBank(itemIds[n],{item:{status:'UPDATED'},data:[{
    account:{id:accountIds[n],name:'BANCO FICTÍCIO '+n,balance:50,type:'CHECKING',currencyCode:'BRL'},
    transactions
   }]});
  }
  new PlanningStore(db).create({title:'Compromisso sintético',kind:'expense',
   amount:7350,dueDate:'2026-12-15',category:'Contas'});
 }finally{db.close();}
}
function financialRows(file){
 const db=new FinanceDB(file);
 try{
  const tables=['profiles','transactions','budgets','financial_settings','bank_items',
   'bank_accounts','bank_transactions','bank_sync_history','categories','category_rules',
   'planned_items'];
  const payload={};
  for(const name of tables){
   const exists=db.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
   if(exists)payload[name]=db.db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all();
  }
  const bank=db.bankOverview(),data=db.load('real');
  return {payload,bankCount:bank.totalTransactions,accounts:bank.accounts.length,
   manualIds:data.transactions.map(x=>x.id),budgetZero:data.budgets.Alimentação===0,
   integrity:db.integrity()};
 }finally{db.close();}
}
test('RC2.2 stable and experimental distributions cannot be selected by runtime environment variables',()=>{
 const stable=fakeApp('/unused');
 const experimental=fakeApp('/unused',EXPERIMENTAL_NAME);
 assert.equal(releaseChannel(stable,{mfDistributionChannel:'stable'}),'stable');
 assert.equal(releaseChannel(experimental,{}),'experimental');
 assert.throws(()=>releaseChannel(experimental,{mfDistributionChannel:'stable'}),/incompatível/);
 assert.throws(()=>releaseChannel(stable,{mfDistributionChannel:'experimental'}),/incompatível/);
 assert.throws(()=>releaseChannel(stable,{mfDistributionChannel:'unknown'}),/inválida/);
 assert.equal(releaseChannel({isPackaged:false},{}),'development');
});
test('RC2.2 detects exact prior stable profile and keeps RC data separated',()=>tmp(root=>{
 const stable=path.join(root,'Meu Financeiro'),legacy=path.join(root,'meu-financeiro-desktop');
 fs.mkdirSync(legacy,{recursive:true});seed(path.join(legacy,'meu-financeiro.sqlite'));
 assert.equal(stableProfileDirectory(fakeApp(root)),legacy);
 const rc=experimentalProfileDirectory(fakeApp(root,EXPERIMENTAL_NAME));
 assert.equal(rc,path.join(root,ISOLATED_DIR));assert.notEqual(rc,legacy);
 assert.equal(fs.existsSync(path.join(rc,'meu-financeiro.sqlite')),false);
 assert.equal(fs.existsSync(stable),false,'Do not manufacture a fresh empty stable profile');
}));
test('RC2.2 stable upgrade backs up 600 bank rows and retains exact prior IDs/cents/plan and Pluggy vault',async()=> {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-rc-continuity-'));
 try{
  const stable=path.join(root,STABLE_NAME);fs.mkdirSync(stable);
  const file=path.join(stable,'meu-financeiro.sqlite');seed(file);
  const safeStorage={
   isAsyncEncryptionAvailable:async()=>true,
   encryptStringAsync:async str=>Buffer.from('encrypted:'+str,'utf8'),
   decryptStringAsync:async data=>({result:data.toString('utf8').slice('encrypted:'.length)})
  };
  const vault=new PluggyVault(stable,safeStorage);
  await vault.put({clientId:'TEST-ID-NOT-REAL',clientSecret:'SYNTHETIC-NEVER-REAL',
   itemIds:[itemIds[0]]});
  const before=financialRows(file);
  assert.equal(before.bankCount,600);assert.equal(before.accounts,3);
  assert.equal(before.budgetZero,true);
  const pre=await stablePreMigrationBackup(stable,'0.9.5-beta.8');
  assert.equal(pre.existing,true);assert(pre.backup&&fs.existsSync(pre.backup));
  assert.deepEqual(financialRows(pre.backup),before);
  // Simulate an update on EXACTLY the original data directory, not a copy.
  const existing=stableProfileDirectory(fakeApp(root));assert.equal(existing,stable);
  assert.deepEqual(financialRows(path.join(existing,'meu-financeiro.sqlite')),before);
  assert.deepEqual(await vault.get(),{clientId:'TEST-ID-NOT-REAL',
   clientSecret:'SYNTHETIC-NEVER-REAL',itemIds:[itemIds[0]]});
  const repeat=await stablePreMigrationBackup(stable,'0.9.5-beta.8');
  assert.equal(repeat.backup,pre.backup);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('RC2.2 ambiguous earlier profiles fail closed without touching existing files',()=>tmp(root=>{
 const first=path.join(root,STABLE_NAME),second=path.join(root,'meu-financeiro-desktop');
 for(const p of [first,second]){fs.mkdirSync(p);seed(path.join(p,'meu-financeiro.sqlite'));}
 assert.throws(()=>stableProfileDirectory(fakeApp(root)),/dois perfis/);
 assert.equal(fs.existsSync(path.join(first,'meu-financeiro.sqlite')),true);
 assert.equal(fs.existsSync(path.join(second,'meu-financeiro.sqlite')),true);
}));
test('RC2.2 corrupted SQLite cannot trigger upgrade or manufacture backup',async()=> {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-rc-continuity-'));
 try{
  const stable=path.join(root,STABLE_NAME);fs.mkdirSync(stable);
  const file=path.join(stable,'meu-financeiro.sqlite');
  fs.writeFileSync(file,Buffer.from('CORRUPTED-SQLITE-NOT-DATABASE'));
  await assert.rejects(stablePreMigrationBackup(stable,'0.9.5-beta.8'));
  assert.equal(fs.readFileSync(file,'utf8'),'CORRUPTED-SQLITE-NOT-DATABASE');
  assert.equal(fs.existsSync(path.join(stable,'copias-de-seguranca','pre-upgrade-0.9.5-beta.8.sqlite')),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('RC2.2 partial backup and symlinked profile cannot bypass integrity checks',async()=> {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-rc-continuity-'));
 try{
  const stable=path.join(root,STABLE_NAME);fs.mkdirSync(stable);
  seed(path.join(stable,'meu-financeiro.sqlite'));
  const dir=path.join(stable,'copias-de-seguranca');fs.mkdirSync(dir);
  const partial=path.join(dir,'pre-upgrade-0.9.5-beta.8.sqlite.partial');
  fs.writeFileSync(partial,'PARTIAL');
  await assert.rejects(stablePreMigrationBackup(stable,'0.9.5-beta.8'),/parcial/);
  fs.rmSync(partial);
  const other=path.join(root,'outside');fs.mkdirSync(other);
  const link=path.join(root,'meu-financeiro-desktop');
  fs.symlinkSync(other,link,'dir');
  // Both known names still exist; neither may be opened via symlink.
  assert.throws(()=>stableProfileDirectory(fakeApp(root)),/simbólico/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('RC2.2 app code guards channel before single-instance lock and protects history when vault is unreadable',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8');
 const select=source.indexOf("const runtimeChannel=smokeProfileActive?'smoke':releaseChannel(app)");
 const lock=source.indexOf('app.requestSingleInstanceLock()');
 const sqlite=source.indexOf('db=new FinanceDB(filename)');
 const backup=source.indexOf('await stablePreMigrationBackup(');
 assert(select>=0&&select<lock&&lock<backup&&backup<sqlite);
 assert.match(source,/catch\(_\)\{ \/\/ Vault error must not hide\/erase historical bank rows/);
 assert.match(source,/approvedForPersonal:\(\)=>false/);
 assert.match(source,/if\(smokeProfileActive\|\|experimentalPackaged\)/);
});
test('RC2.2 stable build metadata is explicit and ordinary RC build remains experimental',()=>{
 const pkg=require('../package.json');
 const script=fs.readFileSync(path.join(__dirname,'../scripts/build-stable-windows.cjs'),'utf8');
 assert.equal(pkg.build.appId,'app.local.meufinanceiro.rcall01');
 assert.equal(pkg.build.productName,EXPERIMENTAL_NAME);
 assert.match(pkg.scripts['dist:windows:stable'],/build-stable-windows/);
 assert.match(script,/mfDistributionChannel:'stable'/);
 assert.match(script,/productName:STABLE_NAME/);
 assert.match(script,/appId:STABLE_ID/);
 assert.doesNotMatch(pkg.scripts['dist:windows'],/build-stable-windows/);
});
test('RC2.2 CSS composer overrides are scoped to B05 and keep one visible outline',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../app/intelligence-b05.css'),'utf8');
 const view=fs.readFileSync(path.join(__dirname,'../src/intelligence-b05-chat.ts'),'utf8');
 assert.match(view,/h\('div',\{className:'mf-b05-chat-composer'\},renderIntelligenceComposer\(app\)\)/);
 assert.match(css,/\.mf-b05-chat-composer>\.mf-chat-composer\.mf-ai-composer/);
 assert.match(css,/\.mf-b05-chat-composer>\.mf-chat-composer textarea\{min-height:44px/);
 assert.doesNotMatch(css,/\.mf-ai-drawer-composer\s*\{/);
});
