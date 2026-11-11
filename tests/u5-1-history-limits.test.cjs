'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {FinanceDB}=require('../electron/db.cjs');
const renderer=fs.readFileSync(path.join(__dirname,'../src/app.ts'),'utf8');
const ITEM='88888888-8888-4888-8888-888888888888';
const ACCOUNT='99999999-9999-4999-8999-999999999999';
test('U5.1.1 — SQLite real informa histórico parcial com 2.501 transações sintéticas',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mf-u511-'));
 const file=path.join(folder,'test.sqlite');
 const db=new FinanceDB(file);
 try{
  const rows=Array.from({length:2501},(_,i)=>({
    id:'synthetic-'+String(i).padStart(5,'0'),date:'2026-11-10',
    amount:-1.25,description:'Compra sintética '+i,status:'POSTED',category:'Alimentação'
  }));
  db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{
    account:{id:ACCOUNT,name:'Banco totalmente sintético',balance:null,type:'BANK',currencyCode:'BRL'},
    transactions:rows
  }]});
  const state=db.bankOverview();
  assert.equal(state.totalTransactions,2501);
  assert.equal(state.transactions.length,2500);
  assert.equal(state.truncated,true);
  assert.equal(state.transactions.reduce((sum,tx)=>sum+Math.abs(tx.amount),0),2500*125);
  assert.deepEqual(db.integrity(),['ok']);
  const rawCount=db.db.prepare('SELECT COUNT(*) AS n FROM bank_transactions').get().n;
  assert.equal(rawCount,2501,'Database retains all 2501 records; only view is capped');
  assert.equal(state.accounts[0].balance,null,'Unknown balance must remain unknown');
 }finally{db.close();fs.rmSync(folder,{recursive:true,force:true})}
});
test('U5.1.1 — aviso é junto dos cartões e números indicam subconjunto carregado',()=>{
 const section=renderer.slice(renderer.indexOf(' renderTransactions(){'),renderer.indexOf(' renderCategories(){'));
 assert.match(section,/const partialBank=this\.state\.mode!=='demo'&&!!this\.state\.bank\.data\.truncated/);
 assert.match(section,/Histórico bancário parcial:/);
 assert.match(section,/não representam o histórico completo/);
 assert.match(section,/linhas carregadas/);
 assert.match(section,/somente as linhas carregadas/);
 assert.match(section,/filtered\.length\+' resultados nos dados carregados'/);
 assert.doesNotMatch(section,/resumo inclui todos os resultados/);
});
