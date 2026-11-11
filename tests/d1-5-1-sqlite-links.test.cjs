'use strict';
// Authoritative regression suite using real node:sqlite and synthetic data ONLY.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const ITEM='11111111-1111-4111-8111-111111111111';
const ACCOUNT='22222222-2222-4222-8222-222222222222';
const EXTERNAL='33333333-3333-4333-8333-333333333333';
const manual=()=>({id:'manual-1',date:'2026-11-10',description:'Compra sintética',kind:'expense',amount:1256,category:'Alimentação',origin:'manual'});
const other=()=>({id:'manual-2',date:'2026-11-11',description:'Outros sintéticos',kind:'income',amount:2500,category:'Salário',origin:'manual'});
const dataset=txs=>({version:5,transactions:txs,budgets:{Alimentação:25000},settings:{opening:10000,income:0,fixed:0,existing:0,reserve:0}});
const bankPayload=()=>({item:{status:'UPDATED'},data:[{
 account:{id:ACCOUNT,name:'BANCO 100% SINTÉTICO',balance:50,type:'BANK',currencyCode:'BRL'},
 transactions:[{id:EXTERNAL,amount:-12.56,date:'2026-11-10T00:00:00Z',description:'EXTRATO ORIGINAL SINTÉTICO',status:'POSTED',category:'Alimentação'}]
}]});
async function fixture(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d151-sqlite-'));
 const filename=path.join(dir,'finance.sqlite');
 const db=new FinanceDB(filename);
 try{
  db.save('real',dataset([manual(),other()]));
  db.ingestBank(ITEM,bankPayload());
  db.linkManualTransaction({accountId:ACCOUNT,externalId:EXTERNAL,manualId:'manual-1'});
  assert.equal(db.bankOverview().transactions.find(t=>t.id===EXTERNAL).linkedManualId,'manual-1');
  return await fn({db,dir,filename});
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
}
function rawBank(db){
 return {...db.db.prepare('SELECT date,description,amount_cents,status FROM bank_transactions WHERE account_id=? AND external_id=?').get(ACCOUNT,EXTERNAL)};
}
function linked(db){
 return db.db.prepare('SELECT manual_id AS id FROM bank_manual_links WHERE account_id=? AND external_id=?').get(ACCOUNT,EXTERNAL)?.id;
}
function failedSaveLeavesEverythingIntact(db,changed){
 // The renderer has NO bank link in its snapshot. Call the persistence boundary directly.
 const beforeData=db.load('real');
 const beforeBank=rawBank(db);
 const beforeLink=linked(db);
 assert.throws(()=>db.save('real',changed),/Desvincule antes de alterar data, valor, tipo ou excluir/);
 assert.deepEqual(db.load('real'),beforeData,'No financial transaction, budget or setting changed');
 assert.deepEqual(rawBank(db),beforeBank,'Pluggy raw row must not change');
 assert.equal(linked(db),beforeLink,'Bank link must survive rejected save');
 assert.deepEqual(db.integrity(),['ok']);
}
test('D1.5.1 / SQLite — vínculo que existe só no banco impede exclusão e rollback é total',()=>fixture(({db})=>{
 const changed=dataset([other()]);
 changed.settings.opening=999999;
 changed.budgets.Alimentação=1;
 failedSaveLeavesEverythingIntact(db,changed);
}));
test('D1.5.1 / SQLite — vínculo real impede alterar valor mesmo com renderer desatualizado',()=>fixture(({db})=>{
 const changed=dataset([{...manual(),amount:1300},other()]);
 failedSaveLeavesEverythingIntact(db,changed);
}));
test('D1.5.1 / SQLite — alteração de data dentro e fora da tolerância também exige desvincular',()=>fixture(({db})=>{
 for(const date of ['2026-11-11','2026-11-20']){
  failedSaveLeavesEverythingIntact(db,dataset([{...manual(),date},other()]));
 }
}));
test('D1.5.1 / SQLite — tipo não pode ser modificado por persistência genérica',()=>fixture(({db})=>{
 failedSaveLeavesEverythingIntact(db,dataset([{...manual(),kind:'income'},other()]));
}));
test('D1.5.1 / SQLite — descrição/categoria são editáveis sem alterar identidade bancária',()=>fixture(({db})=>{
 const bankBefore=rawBank(db);
 const result=db.save('real',dataset([{...manual(),description:'Nova descrição',category:'Transporte'},other()]));
 assert.equal(result.ok,true);
 const saved=db.load('real').transactions.find(t=>t.id==='manual-1');
 assert.equal(saved.description,'Nova descrição');assert.equal(saved.category,'Transporte');
 assert.equal(saved.amount,1256);assert.equal(saved.date,'2026-11-10');
 assert.equal(linked(db),'manual-1');
 assert.deepEqual(rawBank(db),bankBefore);
}));
test('D1.5.1 / SQLite — uma nova instância lê o vínculo persistido e o bloqueio continua',()=>fixture(({db,filename})=>{
 // Open a second SQLite connection to simulate a fresh app instance.
 const reopened=new FinanceDB(filename);
 try{
  assert.equal(linked(reopened),'manual-1');
  failedSaveLeavesEverythingIntact(reopened,dataset([{...manual(),amount:9999},other()]));
  assert.deepEqual(reopened.integrity(),['ok']);
 }finally{
  // Replace original closed connection for fixture cleanup.
  reopened.close();
 }
}));
test('D1.5.1 / SQLite — perfil demo isolado não é bloqueado por vínculos reais',()=>fixture(({db})=>{
 db.save('demo',dataset([{...manual(),id:'demo-1'}]));
 db.save('demo',dataset([]));
 assert.deepEqual(db.load('demo').transactions,[]);
 assert.equal(linked(db),'manual-1');
 assert.equal(db.load('real').transactions.length,2);
}));
test('D1.5.1 / SQLite — desvinculação explícita libera a exclusão sem apagar o extrato',()=>fixture(({db})=>{
 const bankBefore=rawBank(db);
 db.linkManualTransaction({accountId:ACCOUNT,externalId:EXTERNAL,manualId:null});
 assert.equal(linked(db),undefined);
 db.save('real',dataset([other()]));
 assert.deepEqual(db.load('real').transactions.map(t=>t.id),['manual-2']);
 assert.deepEqual(rawBank(db),bankBefore);
 assert.deepEqual(db.integrity(),['ok']);
}));
test('D1.5.1 / SQLite — backup SQLite preserva vínculos; abrir cópia permite restauração autorizada',()=>fixture(async ({db,dir})=>{
 const copy=path.join(dir,'backup.sqlite');
 await db.backupTo(copy);
 const restored=new FinanceDB(copy);
 try{
  assert.equal(linked(restored),'manual-1');
  assert.equal(restored.load('real').transactions.find(t=>t.id==='manual-1').amount,1256);
  failedSaveLeavesEverythingIntact(restored,dataset([other()]));
  assert.deepEqual(restored.integrity(),['ok']);
 }finally{restored.close()}
}));
test('D1.5.1 / SQLite — importação JSON destrutiva via save exige desvinculação, sem limpeza silenciosa',()=>fixture(({db})=>{
 failedSaveLeavesEverythingIntact(db,dataset([]));
 db.linkManualTransaction({accountId:ACCOUNT,externalId:EXTERNAL,manualId:null});
 db.save('real',dataset([]));
 assert.equal(db.load('real').transactions.length,0);
 assert.equal(linked(db),undefined);
 assert.equal(db.bankOverview().transactions.find(t=>t.id===EXTERNAL).amount,-1256);
}));
