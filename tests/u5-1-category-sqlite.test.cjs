'use strict';
// U5.1 bank/category invariants: real SQLite database, exclusively synthetic fixtures.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const ITEM='11111111-1111-4111-8111-111111111111';
const A='22222222-2222-4222-8222-222222222222';
const B='33333333-3333-4333-8333-333333333333';
const EXT='shared-external-42';
const data=()=>({version:5,transactions:[{id:'manual-shared',date:'2026-11-10',
 description:'Lançamento pessoal de teste',kind:'expense',amount:1256,category:'Alimentação',origin:'manual'}],
 budgets:{},settings:{opening:0,income:0,fixed:0,existing:0,reserve:0}});
const bank=()=>({item:{status:'UPDATED'},data:[A,B].map((accountId,i)=>({
 account:{id:accountId,name:'CONTA SINTÉTICA '+i,balance:120,type:'BANK',currencyCode:'BRL'},
 transactions:[{id:EXT,amount:-12.56,date:'2026-11-10T00:00:00Z',
  description:'Transação sintética compartilhada',status:'POSTED',category:'Outros'}]
}))});
function fixture(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-u51-cat-sqlite-')),
 filename=path.join(dir,'finance.sqlite');const db=new FinanceDB(filename);
 try{db.save('real',data());db.ingestBank(ITEM,bank());return fn({db,filename});}
 finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
}
function stored(db){return db.db.prepare(
 'SELECT account_id AS id,external_id AS external,category FROM bank_transactions ORDER BY account_id').all();}
test('U5.1 — override pessoal distingue contas diferentes com mesmo externalId, extrato original intacto',()=>fixture(({db})=>{
 const original=stored(db);
 const first=db.overrideBankCategory({accountId:A,externalId:EXT,category:'Alimentação'});
 assert.equal(first.transactions.find(t=>t.accountId===A).category,'Alimentação');
 assert.equal(first.transactions.find(t=>t.accountId===B).category,'Outros');
 const second=db.overrideBankCategory({accountId:B,externalId:EXT,category:'Transporte'});
 assert.equal(second.transactions.find(t=>t.accountId===A).category,'Alimentação');
 assert.equal(second.transactions.find(t=>t.accountId===B).category,'Transporte');
 assert.deepEqual(stored(db),original);
 assert.equal(db.load('real').transactions[0].amount,1256);
 assert.deepEqual(db.integrity(),['ok']);
}));
test('U5.1 — classificação inválida não persiste nem altera overrides existentes',()=>fixture(({db})=>{
 db.overrideBankCategory({accountId:A,externalId:EXT,category:'Alimentação'});
 const before=db.bankOverview(),raw=stored(db);
 assert.throws(()=>db.overrideBankCategory({accountId:B,externalId:EXT,category:'Categoria inexistente'}),/Categoria inexistente/);
 assert.throws(()=>db.overrideBankCategory({accountId:'conta-errada',externalId:EXT,category:'Transporte'}),/Movimentação não encontrada/);
 assert.equal(db.bankOverview().transactions.find(t=>t.accountId===A).category,'Alimentação');
 assert.equal(db.bankOverview().transactions.find(t=>t.accountId===B).category,'Outros');
 assert.deepEqual(stored(db),raw);
 assert.equal(db.bankOverview().totalTransactions,before.totalTransactions);
}));
test('U5.1 — categorias pessoais são persistidas depois de reabrir banco sintético',()=>fixture(({db,filename})=>{
 db.overrideBankCategory({accountId:A,externalId:EXT,category:'Alimentação'});
 db.overrideBankCategory({accountId:B,externalId:EXT,category:'Transporte'});
 const copy=new FinanceDB(filename);
 try{
  const rows=copy.bankOverview().transactions;
  assert.equal(rows.find(t=>t.accountId===A).category,'Alimentação');
  assert.equal(rows.find(t=>t.accountId===B).category,'Transporte');
  assert.equal(copy.load('real').transactions[0].amount,1256);
  assert.deepEqual(copy.integrity(),['ok']);
 }finally{copy.close()}
}));
test('U5.1 — alterar categoria manual por save não modifica id, centavos, data ou extrato Pluggy',()=>fixture(({db})=>{
 const before=stored(db),manual=db.load('real'),tx=manual.transactions[0];
 db.save('real',{...manual,transactions:[{...tx,category:'Transporte'}]});
 const updated=db.load('real').transactions[0];
 assert.deepEqual(updated,{...tx,category:'Transporte'});
 assert.deepEqual(stored(db),before);
 assert.equal(db.bankOverview().transactions.length,2);
}));
